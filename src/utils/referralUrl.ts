/**
 * Protocol Referral URL Utility
 * Ensures generated referral URLs always use the public-facing endpoint (ais-pre- / custom domain)
 * so that invited guests never hit Google Cloud Run IAP "403 Forbidden" errors.
 */

export function getPublicBaseUrl(inputUrl?: string): string {
  let base = inputUrl;
  if (!base && typeof window !== 'undefined') {
    base = window.location.origin;
  }
  if (!base) {
    base = 'https://phivonex.com';
  }

  // Convert internal Google AI Studio dev cluster URL to public shared URL
  if (base.includes('ais-dev-')) {
    base = base.replace('ais-dev-', 'ais-pre-');
  }

  return base.replace(/\/$/, '');
}

export function buildPublicReferralUrl(referralCode: string, customBaseUrl?: string): string {
  const code = (referralCode || '').trim().toUpperCase();
  const base = getPublicBaseUrl(customBaseUrl);
  return `${base}/register?ref=${encodeURIComponent(code)}`;
}

/**
 * Stores pending referral code from URL in localStorage
 */
export function capturePendingReferralCode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref && ref.trim()) {
      const clean = ref.trim().toUpperCase();
      localStorage.setItem('phivonex_pending_ref', clean);
      return clean;
    }
    return localStorage.getItem('phivonex_pending_ref');
  } catch {
    return null;
  }
}
