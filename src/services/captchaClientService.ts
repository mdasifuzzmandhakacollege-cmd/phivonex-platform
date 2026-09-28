/**
 * Client-Side CAPTCHA and Bot Shield Integration Service
 */

export interface CaptchaPublicConfig {
  enabled: boolean;
  mode: 'ENTERPRISE' | 'STANDARD' | 'FALLBACK_CHALLENGE' | 'HYBRID';
  siteKey: string;
  projectId: string;
  thresholdScore: number;
  enforcedActions: {
    login: boolean;
    register: boolean;
    forgotPassword: boolean;
    withdrawal: boolean;
    swap: boolean;
    buyNode: boolean;
  };
}

export interface CryptographicChallenge {
  token: string;
  challengeId: string;
  question: string;
  visualCode: string;
  expiresAt: number;
}

declare global {
  interface Window {
    grecaptcha?: {
      enterprise?: {
        ready: (cb: () => void) => void;
        execute: (siteKey: string, options: { action: string }) => Promise<string>;
        render?: (container: string | HTMLElement, options: any) => number;
      };
      ready?: (cb: () => void) => void;
      execute?: (siteKey: string, options: { action: string }) => Promise<string>;
      render?: (container: string | HTMLElement, options: any) => number;
      reset?: (widgetId?: number) => void;
    };
  }
}

let cachedConfig: CaptchaPublicConfig | null = null;
let configPromise: Promise<CaptchaPublicConfig> | null = null;

/**
 * Fetch public CAPTCHA configuration from backend
 */
export async function getClientCaptchaConfig(): Promise<CaptchaPublicConfig> {
  if (cachedConfig) return cachedConfig;
  if (configPromise) return configPromise;

  configPromise = (async () => {
    try {
      const res = await fetch('/api/captcha/config');
      if (res.ok) {
        cachedConfig = await res.json();
        return cachedConfig!;
      }
    } catch (err) {
      console.warn('[CaptchaClient] Failed to load config, using fallback:', err);
    }

    cachedConfig = {
      enabled: true,
      mode: 'HYBRID',
      siteKey: '6Ld5jNItAAAAAPas1Dlc5_iyihVbkxOEKQNqAsFn',
      projectId: 'phivonex-production',
      thresholdScore: 0.5,
      enforcedActions: {
        login: true,
        register: true,
        forgotPassword: true,
        withdrawal: true,
        swap: true,
        buyNode: true,
      },
    };
    return cachedConfig;
  })();

  return configPromise;
}

/**
 * Fetch a fresh cryptographic challenge from the server
 */
export async function fetchServerChallenge(action = 'GENERAL'): Promise<CryptographicChallenge | null> {
  try {
    const res = await fetch(`/api/captcha/challenge?action=${encodeURIComponent(action)}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error('[CaptchaClient] Failed to fetch server challenge:', err);
  }
  return null;
}

/**
 * Verify challenge solution with backend
 */
export async function verifyServerChallenge(
  token: string,
  action: string,
  answer?: string | number,
  visualCode?: string
): Promise<{ success: boolean; verificationToken?: string; message?: string }> {
  try {
    const res = await fetch('/api/captcha/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action, answer, visualCode }),
    });

    if (res.ok) {
      const data = await res.json();
      return { success: true, verificationToken: data.verificationToken };
    }
    const errData = await res.json().catch(() => ({}));
    return { success: false, message: errData.message || 'Challenge verification failed' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Network error during CAPTCHA verification' };
  }
}

/**
 * Executes Google reCAPTCHA Enterprise if available on window
 */
export async function executeGoogleRecaptcha(action: string): Promise<string | null> {
  const config = await getClientCaptchaConfig();
  if (!config.enabled) return 'CAPTCHA_BYPASS_DISABLED';

  try {
    if (window.grecaptcha?.enterprise?.execute && config.siteKey) {
      return await new Promise<string>((resolve) => {
        window.grecaptcha?.enterprise?.ready(async () => {
          try {
            const token = await window.grecaptcha!.enterprise!.execute(config.siteKey, { action });
            resolve(token);
          } catch {
            resolve('');
          }
        });
      });
    }

    if (window.grecaptcha?.execute && config.siteKey) {
      return await new Promise<string>((resolve) => {
        window.grecaptcha?.ready?.(async () => {
          try {
            const token = await window.grecaptcha!.execute!(config.siteKey, { action });
            resolve(token);
          } catch {
            resolve('');
          }
        });
      });
    }
  } catch (err) {
    console.warn('[CaptchaClient] Google reCAPTCHA execution error:', err);
  }

  return null;
}
