import React, { useState, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  Lock,
  Mail,
  Globe,
  Tag,
  Loader2,
  Cpu,
  Layers,
  Check,
  X
} from 'lucide-react';
import { PhivonexLogo } from '../components/brand/PhivonexLogo';
import { PhivonexSymbol } from '../components/brand/PhivonexSymbol';
import { COUNTRIES } from '../data/countries';
import { useAuth } from '../context/AuthContext';

interface RegisterPageProps {
  initialReferralCode?: string;
  onNavigate: (route: string) => void;
  onOpenLegalModal?: (title: string) => void;
}

interface SponsorData {
  valid: boolean;
  referralCode?: string;
  sponsor?: {
    publicId: string;
    displayName: string;
  };
}

export const RegisterPage: React.FC<RegisterPageProps> = ({
  initialReferralCode = '',
  onNavigate,
  onOpenLegalModal,
}) => {
  const { register } = useAuth();

  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string>('United States');
  const [dialCode, setDialCode] = useState<string>('+1');
  const [referralCode, setReferralCode] = useState(initialReferralCode);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingReferral, setIsCheckingReferral] = useState(false);
  const [sponsorData, setSponsorData] = useState<SponsorData | null>(null);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  // Referral code resolution via backend API
  const handleReferralLookup = async (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setSponsorData(null);
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated.referralCode;
        return updated;
      });
      return;
    }

    setIsCheckingReferral(true);
    try {
      const res = await fetch(`/api/referrals/resolve/${encodeURIComponent(trimmed)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.valid) {
          setSponsorData(data);
          setErrors((prev) => {
            const updated = { ...prev };
            delete updated.referralCode;
            return updated;
          });
        } else {
          setSponsorData({ valid: false });
          setErrors((prev) => ({
            ...prev,
            referralCode: 'Referral code not found.',
          }));
        }
      } else {
        setSponsorData({ valid: false });
        setErrors((prev) => ({
          ...prev,
          referralCode: 'Referral code not found.',
        }));
      }
    } catch {
      setSponsorData({ valid: false });
      setErrors((prev) => ({
        ...prev,
        referralCode: 'Could not verify referral code.',
      }));
    } finally {
      setIsCheckingReferral(false);
    }
  };

  // Parse URL search params if ?ref= exists
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const refParam = params.get('ref') || initialReferralCode;
      if (refParam) {
        const cleanRef = refParam.trim().toUpperCase();
        setReferralCode(cleanRef);
        handleReferralLookup(cleanRef);
      }
    } catch {
      // safe fallback
    }
  }, [initialReferralCode]);

  // Debounced referral lookup when user types
  useEffect(() => {
    if (!referralCode.trim()) {
      setSponsorData(null);
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated.referralCode;
        return updated;
      });
      return;
    }
    const timer = setTimeout(() => {
      handleReferralLookup(referralCode);
    }, 450);
    return () => clearTimeout(timer);
  }, [referralCode]);

  // Handle country change
  const handleCountryChange = (countryName: string) => {
    setSelectedCountry(countryName);
    const found = COUNTRIES.find((c) => c.name === countryName);
    if (found) {
      setDialCode(found.dialCode);
    }
  };

  // Password strength calculations (min 10 chars, uppercase, number, symbol)
  const passwordCriteria = {
    length: password.length >= 10,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  const passwordStrengthScore = Object.values(passwordCriteria).filter(Boolean).length;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    // 1. Full Name
    if (!fullName.trim()) {
      errs.fullName = 'Full Name is required';
    } else if (fullName.trim().length < 2) {
      errs.fullName = 'Please enter your full legal name';
    }

    // 2. Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      errs.email = 'Email Address is required';
    } else if (!emailRegex.test(email.trim())) {
      errs.email = 'Please enter a valid email address';
    }

    // 3. Mobile Number
    const phoneClean = phone.replace(/[\s-]/g, '');
    if (!phoneClean) {
      errs.phone = 'Mobile Number is required';
    } else if (phoneClean.length < 6 || !/^\d+$/.test(phoneClean)) {
      errs.phone = 'Please enter a valid phone number';
    }

    // 4. Country
    if (!selectedCountry) {
      errs.country = 'Please select your country of residence';
    }

    // 5. Referral Code (if provided, must be valid)
    if (referralCode.trim() && sponsorData && !sponsorData.valid) {
      errs.referralCode = 'Referral code not found.';
    }

    // 6. Password (min 10 chars)
    if (!password) {
      errs.password = 'Password is required';
    } else if (password.length < 10) {
      errs.password = 'Password must be at least 10 characters long';
    }

    // 7. Confirm Password
    if (!confirmPassword) {
      errs.confirmPassword = 'Confirm your password';
    } else if (password !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match';
    }

    // 8. Terms & Privacy checkbox
    if (!agreeTerms) {
      errs.agreeTerms = 'You must accept the Terms & Privacy policy to proceed';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy.general;
      return copy;
    });

    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: `${dialCode} ${phone.trim()}`,
        country: selectedCountry,
        password,
        referralCode: referralCode.trim() || undefined,
      });

      setRegistrationSuccess(true);
      setTimeout(() => {
        onNavigate('/app');
      }, 1500);
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, general: err.message || 'An error occurred during registration.' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#05070B] text-[#F7FAFC] flex flex-col justify-between selection:bg-[#00CFFF]/20 selection:text-[#00CFFF]">
      
      {/* Top Navigation Bar */}
      <header className="border-b border-white/[0.08] bg-[#07101D]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button
            onClick={() => onNavigate('/')}
            className="flex items-center gap-2 group focus:outline-none cursor-pointer"
            aria-label="Back to home"
          >
            <PhivonexLogo size="md" />
          </button>

          <div className="flex items-center gap-3 text-xs">
            <span className="hidden sm:inline text-[#98A2B3]">Already have an account?</span>
            <button
              onClick={() => onNavigate('/login')}
              className="px-3.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] text-white font-medium transition-colors cursor-pointer min-h-[36px]"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      {/* Main Split Layout Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex items-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start w-full">
          
          {/* LEFT COLUMN: PHIVONEX Branding & Protocol Overview */}
          <div className="lg:col-span-5 space-y-6 pt-2 lg:sticky lg:top-24">
            
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] text-xs font-mono text-[#00CFFF]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>SECURE ACCESS GATEWAY</span>
            </div>

            <div className="space-y-3">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#F7FAFC] tracking-tight leading-tight">
                Decentralized Node &amp; Asset Infrastructure
              </h2>
              <p className="text-sm text-[#98A2B3] leading-relaxed">
                Connect to the PHIVONEX protocol. Authenticated operators receive a verified public ID, personal referral link, and direct cryptographic consensus attestation.
              </p>
            </div>

            {/* Protocol Pillars Summary Box */}
            <div className="p-5 rounded-2xl bg-[#07101D]/90 border border-white/[0.08] space-y-4">
              <div className="flex items-start gap-3 text-xs">
                <div className="w-8 h-8 rounded-lg bg-[#00CFFF]/10 border border-[#00CFFF]/30 flex items-center justify-center text-[#00CFFF] shrink-0 mt-0.5">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-white mb-0.5">Immutable Public User ID</h4>
                  <p className="text-[#98A2B3] leading-relaxed">
                    Every operator is assigned a unique non-sequential public ID (e.g. PHX-8F2K91).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-xs">
                <div className="w-8 h-8 rounded-lg bg-[#168BFF]/10 border border-[#168BFF]/30 flex items-center justify-center text-[#168BFF] shrink-0 mt-0.5">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-white mb-0.5">Verified Sponsor Relationship</h4>
                  <p className="text-[#98A2B3] leading-relaxed">
                    Cryptographically protected sponsor associations with zero post-creation modification.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-xs">
                <div className="w-8 h-8 rounded-lg bg-[#32D583]/10 border border-[#32D583]/30 flex items-center justify-center text-[#32D583] shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-white mb-0.5">Argon2id &amp; Session Protection</h4>
                  <p className="text-[#98A2B3] leading-relaxed">
                    No plain text storage. Memory-hard Argon2id key derivation and HttpOnly session cookies.
                  </p>
                </div>
              </div>
            </div>

            {/* Verification Guarantee */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center gap-3 text-xs font-mono text-[#98A2B3]">
              <PhivonexSymbol size={20} />
              <span>PostgreSQL Backend · Unique Public ID · TLS 1.3 Certified</span>
            </div>

          </div>

          {/* RIGHT COLUMN: Registration Form Card */}
          <div className="lg:col-span-7">
            <div className="bg-[#07101D]/90 border border-white/[0.08] rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-xl">
              
              {/* Form Header */}
              <div className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F7FAFC] tracking-tight font-sans">
                  Create Your PHIVONEX Account
                </h1>
                <p className="text-xs sm:text-sm text-[#98A2B3] mt-1.5 font-normal">
                  Join the PHIVONEX network and obtain your personal ID and referral credentials.
                </p>
              </div>

              {/* General Error Notification */}
              {errors.general && (
                <div className="mb-5 p-3.5 rounded-xl bg-[#F04438]/10 border border-[#F04438]/30 flex items-start gap-2.5 text-xs text-[#F04438] animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{errors.general}</span>
                </div>
              )}

              {/* Registration Success Notification */}
              {registrationSuccess && (
                <div className="mb-6 p-4 rounded-xl bg-[#32D583]/10 border border-[#32D583]/30 text-xs text-[#32D583] flex items-start gap-3 animate-fadeIn">
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-white font-semibold mb-1">Account Created Successfully!</strong>
                    <span>
                      Welcome to PHIVONEX, <strong className="text-white">{fullName}</strong>. Initializing your authenticated session...
                    </span>
                  </div>
                </div>
              )}

              {/* REGISTRATION FORM */}
              <form onSubmit={handleSubmit} noValidate className="space-y-4 text-left">
                
                {/* 1. Full Name */}
                <div>
                  <label className="block text-xs font-medium text-[#98A2B3] mb-1.5">
                    Full Name <span className="text-[#F04438]">*</span>
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    autoComplete="name"
                    placeholder="e.g. David Vance"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: '' }));
                    }}
                    className={`w-full bg-[#05070B] border ${
                      errors.fullName ? 'border-[#F04438]' : 'border-white/[0.1] focus:border-[#00CFFF]'
                    } rounded-lg px-3.5 py-2.5 text-xs text-white placeholder:text-white/20 focus:outline-none transition-colors min-h-[44px]`}
                  />
                  {errors.fullName && (
                    <span className="text-[11px] text-[#F04438] mt-1 block flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" /> {errors.fullName}
                    </span>
                  )}
                </div>

                {/* 2. Email Address & Mobile Number */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Email Address */}
                  <div>
                    <label className="block text-xs font-medium text-[#98A2B3] mb-1.5">
                      Email Address <span className="text-[#F04438]">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/30">
                        <Mail className="w-3.5 h-3.5" />
                      </div>
                      <input
                        type="email"
                        name="email"
                        autoComplete="email"
                        placeholder="operator@phivonex.org"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
                        }}
                        className={`w-full bg-[#05070B] border ${
                          errors.email ? 'border-[#F04438]' : 'border-white/[0.1] focus:border-[#00CFFF]'
                        } rounded-lg pl-9 pr-3.5 py-2.5 text-xs text-white placeholder:text-white/20 focus:outline-none transition-colors min-h-[44px]`}
                      />
                    </div>
                    {errors.email && (
                      <span className="text-[11px] text-[#F04438] mt-1 block flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" /> {errors.email}
                      </span>
                    )}
                  </div>

                  {/* Mobile Number */}
                  <div>
                    <label className="block text-xs font-medium text-[#98A2B3] mb-1.5">
                      Mobile Number <span className="text-[#F04438]">*</span>
                    </label>
                    <div className="flex gap-2">
                      <div className="px-2.5 flex items-center bg-[#05070B] border border-white/[0.1] rounded-lg text-xs font-mono text-[#00CFFF] shrink-0 min-h-[44px]">
                        {dialCode}
                      </div>
                      <input
                        type="tel"
                        name="phone"
                        autoComplete="tel"
                        placeholder="202 555 0192"
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value);
                          if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
                        }}
                        className={`w-full bg-[#05070B] border ${
                          errors.phone ? 'border-[#F04438]' : 'border-white/[0.1] focus:border-[#00CFFF]'
                        } rounded-lg px-3.5 py-2.5 text-xs text-white placeholder:text-white/20 focus:outline-none transition-colors min-h-[44px]`}
                      />
                    </div>
                    {errors.phone && (
                      <span className="text-[11px] text-[#F04438] mt-1 block flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" /> {errors.phone}
                      </span>
                    )}
                  </div>
                </div>

                {/* 3. Country */}
                <div>
                  <label className="block text-xs font-medium text-[#98A2B3] mb-1.5">
                    Country <span className="text-[#F04438]">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/30">
                      <Globe className="w-3.5 h-3.5" />
                    </div>
                    <select
                      value={selectedCountry}
                      onChange={(e) => handleCountryChange(e.target.value)}
                      className="w-full bg-[#05070B] border border-white/[0.1] focus:border-[#00CFFF] rounded-lg pl-9 pr-8 py-2.5 text-xs text-white focus:outline-none transition-colors appearance-none cursor-pointer min-h-[44px]"
                    >
                      {COUNTRIES.map((country) => (
                        <option key={country.code} value={country.name} className="bg-[#07101D] text-white">
                          {country.flag} {country.name} ({country.dialCode})
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-white/40 text-[10px]">
                      ▼
                    </div>
                  </div>
                  {errors.country && (
                    <span className="text-[11px] text-[#F04438] mt-1 block flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" /> {errors.country}
                    </span>
                  )}
                </div>

                {/* 4. Referral Code Field with Real-time Backend Resolution */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-[#98A2B3]">
                      Referral Code <span className="text-white/40 text-[10px]">(Optional)</span>
                    </label>
                    {isCheckingReferral && (
                      <span className="text-[11px] text-[#00CFFF] flex items-center gap-1 font-mono">
                        <Loader2 className="w-3 h-3 animate-spin" /> Resolving...
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/30">
                      <Tag className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. PHX8F2K91"
                      value={referralCode}
                      onChange={(e) => {
                        setReferralCode(e.target.value.toUpperCase());
                      }}
                      className={`w-full bg-[#05070B] border ${
                        errors.referralCode
                          ? 'border-[#F04438]'
                          : sponsorData?.valid
                          ? 'border-[#32D583]'
                          : 'border-white/[0.1] focus:border-[#00CFFF]'
                      } rounded-lg pl-9 pr-3.5 py-2.5 text-xs font-mono text-white placeholder:text-white/20 focus:outline-none transition-colors uppercase min-h-[44px]`}
                    />
                  </div>

                  {/* Valid Sponsor Display */}
                  {sponsorData?.valid && sponsorData.sponsor && (
                    <div className="mt-2 p-2.5 rounded-lg bg-[#32D583]/[0.08] border border-[#32D583]/30 flex items-center justify-between text-xs animate-fadeIn">
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-[#32D583]" />
                        <span className="text-white">
                          Referred by: <strong className="text-[#32D583]">{sponsorData.sponsor.displayName}</strong>
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-[#98A2B3] bg-white/[0.06] px-2 py-0.5 rounded">
                        {sponsorData.sponsor.publicId}
                      </span>
                    </div>
                  )}

                  {/* Invalid Referral Code Error */}
                  {errors.referralCode && (
                    <span className="text-[11px] text-[#F04438] mt-1 block flex items-center gap-1 animate-fadeIn">
                      <AlertCircle className="w-3 h-3 shrink-0" /> {errors.referralCode}
                    </span>
                  )}
                </div>

                {/* 5. Password & Confirm Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Password */}
                  <div>
                    <label className="block text-xs font-medium text-[#98A2B3] mb-1.5">
                      Password <span className="text-[#F04438]">* (Min 10 chars)</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/30">
                        <Lock className="w-3.5 h-3.5" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••••"
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

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-xs font-medium text-[#98A2B3] mb-1.5">
                      Confirm Password <span className="text-[#F04438]">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/30">
                        <Lock className="w-3.5 h-3.5" />
                      </div>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="••••••••••"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: '' }));
                        }}
                        className={`w-full bg-[#05070B] border ${
                          errors.confirmPassword ? 'border-[#F04438]' : 'border-white/[0.1] focus:border-[#00CFFF]'
                        } rounded-lg pl-9 pr-9 py-2.5 text-xs text-white placeholder:text-white/20 focus:outline-none transition-colors min-h-[44px]`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/40 hover:text-white transition-colors cursor-pointer"
                        aria-label="Toggle confirm password visibility"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <span className="text-[11px] text-[#F04438] mt-1 block flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" /> {errors.confirmPassword}
                      </span>
                    )}
                  </div>
                </div>

                {/* Password Strength Guidance */}
                {password.length > 0 && (
                  <div className="p-3 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-2 text-[11px]">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-[#98A2B3]">Password Strength:</span>
                      <span
                        className={
                          passwordStrengthScore >= 4
                            ? 'text-[#32D583] font-bold'
                            : passwordStrengthScore >= 2
                            ? 'text-[#00CFFF]'
                            : 'text-[#F04438]'
                        }
                      >
                        {passwordStrengthScore >= 4 ? 'Strong (Argon2id)' : passwordStrengthScore >= 2 ? 'Fair' : 'Weak'}
                      </span>
                    </div>

                    <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          passwordStrengthScore >= 4
                            ? 'bg-[#32D583]'
                            : passwordStrengthScore >= 2
                            ? 'bg-[#00CFFF]'
                            : 'bg-[#F04438]'
                        }`}
                        style={{ width: `${(passwordStrengthScore / 4) * 100}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[10px] text-[#98A2B3] pt-1">
                      <div className="flex items-center gap-1.5">
                        {passwordCriteria.length ? <Check className="w-3 h-3 text-[#32D583]" /> : <X className="w-3 h-3 text-white/30" />}
                        <span>10+ Characters</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {passwordCriteria.uppercase ? <Check className="w-3 h-3 text-[#32D583]" /> : <X className="w-3 h-3 text-white/30" />}
                        <span>Uppercase Letter</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {passwordCriteria.number ? <Check className="w-3 h-3 text-[#32D583]" /> : <X className="w-3 h-3 text-white/30" />}
                        <span>Number (0-9)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {passwordCriteria.special ? <Check className="w-3 h-3 text-[#32D583]" /> : <X className="w-3 h-3 text-white/30" />}
                        <span>Special Symbol</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. Terms & Privacy Checkbox */}
                <div className="pt-2">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => {
                        setAgreeTerms(e.target.checked);
                        if (errors.agreeTerms) setErrors((prev) => ({ ...prev, agreeTerms: '' }));
                      }}
                      className="mt-0.5 w-4 h-4 rounded border-white/20 bg-[#05070B] text-[#00CFFF] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                    <span className="text-xs text-[#98A2B3] leading-snug">
                      I agree to the{' '}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          onOpenLegalModal?.('Terms of Service');
                        }}
                        className="text-[#00CFFF] hover:underline"
                      >
                        Terms of Service
                      </button>{' '}
                      and acknowledge the{' '}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          onOpenLegalModal?.('Privacy Policy');
                        }}
                        className="text-[#00CFFF] hover:underline"
                      >
                        Privacy Policy
                      </button>
                      . <span className="text-[#F04438]">*</span>
                    </span>
                  </label>
                  {errors.agreeTerms && (
                    <span className="text-[11px] text-[#F04438] mt-1 block flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" /> {errors.agreeTerms}
                    </span>
                  )}
                </div>

                {/* 7. Primary Action Button */}
                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={isSubmitting || isCheckingReferral || Boolean(referralCode.trim() && sponsorData && !sponsorData.valid)}
                    className="w-full py-3.5 px-4 rounded-lg bg-gradient-to-r from-[#00CFFF] to-[#168BFF] text-[#05070B] font-semibold text-xs flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer shadow-lg shadow-[#00CFFF]/20 min-h-[44px]"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Creating Account...</span>
                      </>
                    ) : (
                      <>
                        <span>Create Account</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

              </form>

              {/* Bottom Nav to Sign In */}
              <div className="mt-6 pt-6 border-t border-white/[0.08] text-center">
                <p className="text-xs text-[#98A2B3]">
                  Already have an account?{' '}
                  <button
                    onClick={() => onNavigate('/login')}
                    className="text-[#00CFFF] font-semibold hover:underline cursor-pointer ml-1"
                  >
                    Sign In
                  </button>
                </p>
              </div>

            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 border-t border-white/[0.06] text-center text-[11px] text-[#98A2B3] font-mono">
        © 2026 PHIVONEX. All rights reserved.
      </footer>
    </div>
  );
};
