import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
  Lock,
  Loader2,
  Sparkles,
  Info
} from 'lucide-react';
import {
  getClientCaptchaConfig,
  fetchServerChallenge,
  verifyServerChallenge,
  executeGoogleRecaptcha,
  CryptographicChallenge,
} from '../../services/captchaClientService';

interface SecurityCaptchaProps {
  action: 'login' | 'register' | 'forgotPassword' | 'withdrawal' | 'swap' | 'buyNode' | 'general';
  onVerify: (token: string, details?: { answer?: string; visualCode?: string }) => void;
  onReset?: () => void;
  className?: string;
  theme?: 'dark' | 'glass';
  label?: string;
  required?: boolean;
}

export const SecurityCaptcha: React.FC<SecurityCaptchaProps> = ({
  action,
  onVerify,
  onReset,
  className = '',
  label = 'Security Verification',
  required = true,
}) => {
  const [challenge, setChallenge] = useState<CryptographicChallenge | null>(null);
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [userVisualCode, setUserVisualCode] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [verifiedToken, setVerifiedToken] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingChallenge, setLoadingChallenge] = useState<boolean>(true);
  const [interactiveMode, setInteractiveMode] = useState<boolean>(false);

  // Keep ref to callback props to avoid triggering loadChallenge when inline callbacks re-create
  const onVerifyRef = React.useRef(onVerify);
  const onResetRef = React.useRef(onReset);

  useEffect(() => {
    onVerifyRef.current = onVerify;
    onResetRef.current = onReset;
  }, [onVerify, onReset]);

  // Load challenge or try background Enterprise execution
  const loadChallenge = useCallback(async () => {
    setLoadingChallenge(true);
    setErrorMsg(null);
    setIsVerified(false);
    setUserAnswer('');
    setUserVisualCode('');
    if (onResetRef.current) onResetRef.current();

    try {
      const config = await getClientCaptchaConfig();

      // If action is not enforced or globally disabled, auto-pass
      const actionKey = action.toLowerCase() as keyof typeof config.enforcedActions;
      if (!config.enabled || (actionKey in config.enforcedActions && !config.enforcedActions[actionKey])) {
        setIsVerified(true);
        const bypassToken = `CAPTCHA_BYPASS_DISABLED_${Date.now()}`;
        setVerifiedToken(bypassToken);
        if (onVerifyRef.current) onVerifyRef.current(bypassToken);
        setLoadingChallenge(false);
        return;
      }

      // Try Google reCAPTCHA Enterprise if available
      const googleToken = await executeGoogleRecaptcha(action);
      if (googleToken && googleToken.length > 20) {
        setIsVerified(true);
        setVerifiedToken(googleToken);
        if (onVerifyRef.current) onVerifyRef.current(googleToken);
        setLoadingChallenge(false);
        return;
      }

      // Otherwise fetch an interactive cryptographic challenge
      const srvChallenge = await fetchServerChallenge(action);
      if (srvChallenge) {
        setChallenge(srvChallenge);
        setInteractiveMode(true);
      }
    } catch (err) {
      console.warn('[SecurityCaptcha] Error initiating verification:', err);
    } finally {
      setLoadingChallenge(false);
    }
  }, [action]);

  useEffect(() => {
    loadChallenge();
  }, [loadChallenge]);

  // Handle User Solving Challenge
  const handleSolve = async (e?: React.FormEvent, overrideCode?: string) => {
    if (e) e.preventDefault();
    if (!challenge) return;

    const codeToVerify = (overrideCode !== undefined ? overrideCode : userVisualCode).trim().toUpperCase();

    if (!userAnswer.trim() && !codeToVerify) {
      setErrorMsg('Please enter the 4-character verification code.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg(null);

    try {
      const res = await verifyServerChallenge(
        challenge.token,
        action,
        userAnswer.trim(),
        codeToVerify
      );

      if (res.success && res.verificationToken) {
        setIsVerified(true);
        setVerifiedToken(res.verificationToken);
        if (onVerifyRef.current) {
          onVerifyRef.current(res.verificationToken, {
            answer: userAnswer.trim(),
            visualCode: codeToVerify,
          });
        }
      } else {
        setErrorMsg(res.message || 'Incorrect verification code. Please try again.');
        // Refresh challenge on error
        const next = await fetchServerChallenge(action);
        if (next) setChallenge(next);
        setUserAnswer('');
        setUserVisualCode('');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification connection failed');
    } finally {
      setIsVerifying(false);
    }
  };

  // Quick 1-click Verify Button (Auto-human check)
  const handleQuickVerify = async () => {
    if (!challenge) return;
    setIsVerifying(true);
    setErrorMsg(null);

    try {
      // Direct token verification handshake
      const res = await verifyServerChallenge(challenge.token, action, undefined, undefined);
      if (res.success && res.verificationToken) {
        setIsVerified(true);
        setVerifiedToken(res.verificationToken);
        if (onVerifyRef.current) {
          onVerifyRef.current(res.verificationToken);
        }
      } else {
        setInteractiveMode(true);
      }
    } catch {
      setInteractiveMode(true);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className={`w-full rounded-xl border border-white/[0.08] bg-[#07101D]/70 p-3.5 backdrop-blur-md transition-all ${className}`}>
      {/* Header bar */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
          {isVerified ? (
            <CheckCircle2 className="w-4 h-4 text-[#32D583]" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-[#00CFFF]" />
          )}
          <span>{label}</span>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-[#98A2B3] font-mono">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#32D583] animate-pulse"></span>
          <span>reCAPTCHA Enterprise</span>
        </div>
      </div>

      {/* Loading state */}
      {loadingChallenge && (
        <div className="py-3 flex items-center justify-center gap-2 text-xs text-[#98A2B3]">
          <Loader2 className="w-4 h-4 animate-spin text-[#00CFFF]" />
          <span>Initializing security shield...</span>
        </div>
      )}

      {/* Verified state */}
      {!loadingChallenge && isVerified && (
        <div className="py-2 px-3 rounded-lg bg-[#32D583]/10 border border-[#32D583]/30 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#32D583]" />
            <span className="text-xs text-[#32D583] font-medium">Verification Passed</span>
          </div>
          <span className="text-[10px] text-[#32D583]/80 font-mono">Real-time Protected</span>
        </div>
      )}

      {/* Interactive Challenge Mode */}
      {!loadingChallenge && !isVerified && challenge && (
        <div className="space-y-2.5 pt-1">
          {errorMsg && (
            <div className="p-2 rounded-lg bg-[#F04438]/10 border border-[#F04438]/30 text-[11px] text-[#F04438] flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Simple check button or math/visual solve */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Visual Security Code Box */}
            <div className="flex items-center gap-2 bg-[#05070B] border border-[#00CFFF]/30 rounded-lg px-3 py-1.5 select-none shrink-0 shadow-inner">
              <span className="text-sm font-mono font-extrabold tracking-[0.25em] text-[#00CFFF] bg-[#00CFFF]/10 px-2.5 py-1 rounded border border-[#00CFFF]/30">
                {challenge.visualCode}
              </span>
              <button
                type="button"
                onClick={loadChallenge}
                title="Refresh verification code"
                className="p-1 rounded text-[#98A2B3] hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Input code */}
            <input
              type="text"
              placeholder="ENTER 4-CHAR CODE"
              maxLength={6}
              value={userVisualCode}
              onChange={(e) => {
                const val = e.target.value.toUpperCase();
                setUserVisualCode(val);
                if (val.length === (challenge?.visualCode?.length || 4) && !isVerifying) {
                  setTimeout(() => handleSolve(undefined, val), 50);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSolve();
                }
              }}
              className="flex-1 bg-[#05070B] border border-white/[0.1] focus:border-[#00CFFF] rounded-lg px-3 py-1.5 text-xs text-white uppercase font-mono tracking-widest placeholder:text-white/30 placeholder:tracking-normal focus:outline-none min-h-[36px]"
            />

            {/* Verify Button */}
            <button
              type="button"
              onClick={() => handleSolve()}
              disabled={isVerifying || !userVisualCode.trim()}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#00CFFF] to-[#168BFF] text-[#05070B] font-semibold text-xs hover:brightness-110 disabled:opacity-40 transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[36px]"
            >
              {isVerifying ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verify</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center justify-between text-[10px] text-[#98A2B3]">
            <span>Anti-bot cryptographic protocol</span>
            <span className="font-mono text-[#00CFFF]">TLS Secured</span>
          </div>
        </div>
      )}
    </div>
  );
};
