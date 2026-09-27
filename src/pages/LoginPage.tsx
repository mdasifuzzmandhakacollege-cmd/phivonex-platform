import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  User,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  KeyRound,
  X
} from 'lucide-react';
import { PhivonexLogo } from '../components/brand/PhivonexLogo';
import { useAuth } from '../context/AuthContext';
import { SecurityCaptcha } from '../components/common/SecurityCaptcha';

interface LoginPageProps {
  onNavigate: (route: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onNavigate,
}) => {
  const { login, forgotPassword, loginWithGoogle } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Captcha token state
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const [forgotCaptchaToken, setForgotCaptchaToken] = useState<string>('');

  // States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loginSuccessNotice, setLoginSuccessNotice] = useState(false);

  // Forgot password modal
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [isSendingForgot, setIsSendingForgot] = useState(false);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!identifier.trim()) {
      errs.identifier = 'Email address is required';
    }

    if (!password) {
      errs.password = 'Password is required';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsSubmitting(true);
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy.general;
      return copy;
    });

    try {
      await login({
        identifier: identifier.trim(),
        password,
        rememberMe,
      });

      setLoginSuccessNotice(true);
      setTimeout(() => {
        onNavigate('/app');
      }, 1200);
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, general: err.message || 'Invalid email or password.' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail.trim())) {
      setForgotError('Please enter a valid email address.');
      return;
    }

    setIsSendingForgot(true);
    setForgotError(null);

    try {
      const res = await forgotPassword(forgotEmail.trim().toLowerCase());
      setForgotSubmitted(true);
      setForgotMessage(res.message || 'If an account exists, reset instructions have been sent.');
    } catch (err: any) {
      setForgotError(err.message || 'Failed to process password recovery request.');
    } finally {
      setIsSendingForgot(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#05070B] text-[#F7FAFC] flex flex-col justify-between selection:bg-[#00CFFF]/20 selection:text-[#00CFFF]">
      
      {/* Top Header Bar */}
      <header className="border-b border-white/[0.04] bg-[#07101D]/50 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button
            onClick={() => onNavigate('/')}
            className="flex items-center gap-2 group focus:outline-none cursor-pointer"
            aria-label="Back to home"
          >
            <PhivonexLogo size="md" />
          </button>

          <div className="flex items-center gap-3 text-xs">
            <span className="hidden sm:inline text-[#98A2B3]">New to PHIVONEX?</span>
            <button
              onClick={() => onNavigate('/register')}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#00CFFF]/10 to-[#168BFF]/10 hover:from-[#00CFFF]/20 hover:to-[#168BFF]/20 border border-[#00CFFF]/30 hover:border-[#00CFFF]/50 text-[#00CFFF] font-medium transition-all cursor-pointer min-h-[36px]"
            >
              Create Account
            </button>
          </div>
        </div>
      </header>

      {/* Main Centered Container */}
      <main className="flex-1 flex items-center justify-center py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-[440px] space-y-6">
          
          <div className="bg-[#07101D]/80 border border-white/[0.08] rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-xl">
            
            {/* Form Header */}
            <div className="mb-6 text-center">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F7FAFC] tracking-tight font-sans">
                Welcome Back
              </h1>
              <p className="text-xs sm:text-sm text-[#98A2B3] mt-2 font-normal">
                Sign in to your PHIVONEX account.
              </p>
            </div>

            {/* General Error Banner */}
            {errors.general && (
              <div className="mb-5 p-3.5 rounded-xl bg-[#F04438]/10 border border-[#F04438]/30 flex items-start gap-2.5 text-xs text-[#F04438] animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errors.general}</span>
              </div>
            )}

            {/* Login Success Notification */}
            {loginSuccessNotice && (
              <div className="mb-6 p-4 rounded-xl bg-[#32D583]/10 border border-[#32D583]/30 text-xs text-[#32D583] flex items-start gap-3 animate-fadeIn">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-white font-semibold mb-1">Authenticated Successfully!</strong>
                  <span>
                    Welcome back. Initializing your secure session...
                  </span>
                </div>
              </div>
            )}

            {/* LOGIN FORM */}
            <form onSubmit={handleLogin} noValidate className="space-y-4 text-left">
              
              {/* 1. Email Address */}
              <div>
                <label className="block text-xs font-medium text-[#98A2B3] mb-1.5">
                  Email Address <span className="text-[#F04438]">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/30">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="email"
                    name="identifier"
                    autoComplete="username"
                    placeholder="operator@phivonex.com"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      if (errors.identifier) setErrors((prev) => ({ ...prev, identifier: '' }));
                    }}
                    className={`w-full bg-[#05070B] border ${
                      errors.identifier ? 'border-[#F04438]' : 'border-white/[0.1] focus:border-[#00CFFF]'
                    } rounded-lg pl-9 pr-3.5 py-2.5 text-xs text-white placeholder:text-white/20 focus:outline-none transition-colors min-h-[44px]`}
                  />
                </div>
                {errors.identifier && (
                  <span className="text-[11px] text-[#F04438] mt-1 block flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" /> {errors.identifier}
                  </span>
                )}
              </div>

              {/* 2. Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-[#98A2B3]">
                    Password <span className="text-[#F04438]">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotModalOpen(true);
                      setForgotSubmitted(false);
                      setForgotError(null);
                      setForgotEmail(identifier.includes('@') ? identifier : '');
                    }}
                    className="text-[11px] text-[#00CFFF] hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/30">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                    }}
                    className={`w-full bg-[#05070B] border ${
                      errors.password ? 'border-[#F04438]' : 'border-white/[0.1] focus:border-[#00CFFF]'
                    } rounded-lg pl-9 pr-9 py-2.5 text-xs text-white placeholder:text-white/20 focus:outline-none transition-colors min-h-[44px]`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/40 hover:text-white transition-colors cursor-pointer"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <span className="text-[11px] text-[#F04438] mt-1 block flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" /> {errors.password}
                  </span>
                )}
              </div>

              {/* 3. Remember Me */}
              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-[#05070B] text-[#00CFFF] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  <span className="text-xs text-[#98A2B3]">Remember Me</span>
                </label>
              </div>

              {/* Security CAPTCHA Barrier */}
              <div className="pt-2">
                <SecurityCaptcha
                  action="login"
                  label="Bot Protection Shield"
                  onVerify={(token) => setCaptchaToken(token)}
                  onReset={() => setCaptchaToken('')}
                />
              </div>

              {/* 4. Primary Button: Sign In */}
              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-4 rounded-lg bg-gradient-to-r from-[#00CFFF] to-[#168BFF] text-[#05070B] font-semibold text-xs flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer shadow-lg shadow-[#00CFFF]/20 min-h-[44px]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {/* Google Sign In Option */}
              <div className="pt-2">
                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-white/[0.08]"></div>
                  <span className="flex-shrink mx-3 text-[11px] text-[#98A2B3]">OR</span>
                  <div className="flex-grow border-t border-white/[0.08]"></div>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setIsSubmitting(true);
                      await loginWithGoogle();
                      setLoginSuccessNotice(true);
                      setTimeout(() => {
                        onNavigate('/app');
                      }, 1000);
                    } catch (err: any) {
                      setErrors((prev) => ({ ...prev, general: err.message || 'Google sign-in failed' }));
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 rounded-lg bg-white/[0.06] border border-white/[0.1] text-white hover:bg-white/[0.1] active:scale-[0.99] font-medium text-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer min-h-[44px]"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Continue with Google</span>
                </button>
              </div>

            </form>

            {/* Bottom: Don't have an account? Create Account */}
            <div className="mt-6 pt-6 border-t border-white/[0.08] text-center">
              <p className="text-xs text-[#98A2B3]">
                Don't have an account?{' '}
                <button
                  onClick={() => onNavigate('/register')}
                  className="text-[#00CFFF] font-semibold hover:underline cursor-pointer ml-1"
                >
                  Create Account
                </button>
              </p>
            </div>

          </div>
        </div>
      </main>

      {/* Forgot Password Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#07101D] border border-white/[0.1] rounded-2xl shadow-2xl p-6 font-sans text-xs">
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] mb-4">
              <div className="flex items-center gap-2 text-white font-bold font-mono">
                <KeyRound className="w-4 h-4 text-[#00CFFF]" />
                <span>Reset Account Password</span>
              </div>
              <button
                onClick={() => setIsForgotModalOpen(false)}
                className="p-1 rounded-md text-[#98A2B3] hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {forgotSubmitted ? (
              <div className="py-4 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-[#32D583]/10 border border-[#32D583]/30 text-[#32D583] mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Reset Instructions Dispatched</h4>
                  <p className="text-xs text-[#98A2B3] mt-1 leading-relaxed">
                    {forgotMessage || `If an account is associated with ${forgotEmail}, password reset instructions have been generated.`}
                  </p>
                </div>
                <button
                  onClick={() => setIsForgotModalOpen(false)}
                  className="w-full py-2.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-white font-medium text-xs cursor-pointer min-h-[44px]"
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <p className="text-xs text-[#98A2B3]">
                  Enter your registered email address. If an active account exists, password recovery instructions will be sent.
                </p>

                {forgotError && (
                  <div className="p-3 rounded-lg bg-[#F04438]/10 border border-[#F04438]/30 text-xs text-[#F04438] flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{forgotError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-[#98A2B3] mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="operator@phivonex.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full bg-[#05070B] border border-white/[0.1] focus:border-[#00CFFF] rounded-lg px-3.5 py-2.5 text-xs text-white placeholder:text-white/20 focus:outline-none min-h-[44px]"
                  />
                </div>

                <div className="pt-1">
                  <SecurityCaptcha
                    action="forgotPassword"
                    label="Verification Shield"
                    onVerify={(token) => setForgotCaptchaToken(token)}
                    onReset={() => setForgotCaptchaToken('')}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="flex-1 py-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[#98A2B3] font-medium text-xs cursor-pointer min-h-[44px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingForgot}
                    className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-[#00CFFF] to-[#168BFF] text-[#05070B] font-semibold text-xs hover:brightness-110 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5 min-h-[44px]"
                  >
                    {isSendingForgot ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Send Reset Link'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-4 border-t border-white/[0.06] text-center text-[11px] text-[#98A2B3] font-mono">
        © 2026 PHIVONEX. All rights reserved.
      </footer>
    </div>
  );
};
