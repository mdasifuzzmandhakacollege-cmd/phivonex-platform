import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  RefreshCw,
  Sliders,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
  Activity,
  Server,
  Key,
  Globe,
  Loader2,
  Play,
  Save,
  Clock,
  UserCheck
} from 'lucide-react';
import { AuditLogger } from '../../services/auditLogger';

export interface CaptchaManagementProps {
  currentUserEmail?: string;
  currentUserUid?: string;
}

export const CaptchaManagement: React.FC<CaptchaManagementProps> = ({
  currentUserEmail = 'admin@phivonex.com',
  currentUserUid = 'ADMIN',
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [testResult, setTestResult] = useState<any | null>(null);

  // Stats & Config
  const [stats, setStats] = useState<any>({
    totalChallenges: 0,
    passedCount: 0,
    blockedBotsCount: 0,
    passRatePercent: 100,
    averageScore: 0.95,
    recentLogs: [],
  });

  const [config, setConfig] = useState({
    enabled: true,
    mode: 'HYBRID' as 'ENTERPRISE' | 'STANDARD' | 'FALLBACK_CHALLENGE' | 'HYBRID',
    siteKey: '6Ld5EnterprisePhivonexProdKey',
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
  });

  // Fetch real-time stats & config
  const fetchStatsAndConfig = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/captcha/admin/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        if (data.config) {
          setConfig(data.config);
        }
      }
    } catch (err) {
      console.error('[CaptchaManagement] Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatsAndConfig();
    const interval = setInterval(fetchStatsAndConfig, 8000); // 8s real-time auto-refresh
    return () => clearInterval(interval);
  }, [fetchStatsAndConfig]);

  // Save Configuration Changes
  const handleSaveConfig = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/captcha/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (res.ok) {
        setFeedback({ type: 'success', message: 'reCAPTCHA & Bot Shield security parameters updated successfully.' });
        await AuditLogger.logAction({
          actionType: 'ADMIN_CAPTCHA_CONFIG_UPDATE',
          category: 'SECURITY',
          details: `Admin updated CAPTCHA security config. Enabled: ${config.enabled}, Mode: ${config.mode}, Score Threshold: ${config.thresholdScore}`,
          userUid: currentUserUid,
          actorEmail: currentUserEmail,
          metadata: { config, updatedAt: new Date().toISOString() },
        });
      } else {
        const errData = await res.json().catch(() => ({}));
        setFeedback({ type: 'error', message: errData.message || 'Failed to save configuration.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Connection error while saving settings.' });
    } finally {
      setSaving(false);
    }
  };

  // Run Test Simulation Challenge
  const handleRunTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/captcha/admin/test', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setTestResult(data);
      }
    } catch (err: any) {
      setTestResult({ error: err.message || 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  // Toggle single action
  const toggleAction = (key: keyof typeof config.enforcedActions) => {
    setConfig((prev) => ({
      ...prev,
      enforcedActions: {
        ...prev.enforcedActions,
        [key]: !prev.enforcedActions[key],
      },
    }));
  };

  return (
    <div className="space-y-6 text-[#F7FAFC] font-sans">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-[#07101D] via-[#0A1628] to-[#07101D] border border-white/[0.08] backdrop-blur-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#00CFFF]/10 border border-[#00CFFF]/30 flex items-center justify-center text-[#00CFFF] shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">reCAPTCHA &amp; Bot Defense Shield</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-[#32D583]/10 text-[#32D583] border border-[#32D583]/30">
                Live &amp; Real-time
              </span>
            </div>
            <p className="text-xs text-[#98A2B3] mt-0.5">
              Google reCAPTCHA Enterprise verification, cryptographic anti-bot barriers &amp; telemetry monitoring.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchStatsAndConfig}
            disabled={loading}
            className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white transition-colors cursor-pointer"
            title="Refresh Telemetry"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleSaveConfig}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#00CFFF] to-[#168BFF] text-[#05070B] font-semibold text-xs flex items-center gap-1.5 hover:brightness-110 active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer shadow-lg shadow-[#00CFFF]/20"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save Changes</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 animate-fadeIn ${
            feedback.type === 'success'
              ? 'bg-[#32D583]/10 border border-[#32D583]/30 text-[#32D583]'
              : 'bg-[#F04438]/10 border border-[#F04438]/30 text-[#F04438]'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <ShieldAlert className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Key Real-Time Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Challenges */}
        <div className="p-4 rounded-xl bg-[#07101D]/80 border border-white/[0.06] backdrop-blur-md">
          <div className="flex items-center justify-between text-[#98A2B3] mb-2">
            <span className="text-xs font-medium">Total Challenges</span>
            <Activity className="w-4 h-4 text-[#00CFFF]" />
          </div>
          <div className="text-xl font-bold font-mono text-white">
            {stats.totalChallenges?.toLocaleString() || 0}
          </div>
          <span className="text-[11px] text-[#98A2B3] mt-1 block">Lifetime verification requests</span>
        </div>

        {/* Verification Passed */}
        <div className="p-4 rounded-xl bg-[#07101D]/80 border border-white/[0.06] backdrop-blur-md">
          <div className="flex items-center justify-between text-[#98A2B3] mb-2">
            <span className="text-xs font-medium">Passed Humans</span>
            <CheckCircle2 className="w-4 h-4 text-[#32D583]" />
          </div>
          <div className="text-xl font-bold font-mono text-[#32D583]">
            {stats.passedCount?.toLocaleString() || 0}
          </div>
          <span className="text-[11px] text-[#32D583]/80 mt-1 block">Pass rate: {stats.passRatePercent || 100}%</span>
        </div>

        {/* Blocked Bots */}
        <div className="p-4 rounded-xl bg-[#07101D]/80 border border-white/[0.06] backdrop-blur-md">
          <div className="flex items-center justify-between text-[#98A2B3] mb-2">
            <span className="text-xs font-medium">Bots Intercepted</span>
            <ShieldAlert className="w-4 h-4 text-[#F04438]" />
          </div>
          <div className="text-xl font-bold font-mono text-[#F04438]">
            {stats.blockedBotsCount?.toLocaleString() || 0}
          </div>
          <span className="text-[11px] text-[#F04438]/80 mt-1 block">High-risk traffic mitigated</span>
        </div>

        {/* Avg Human Assessment Score */}
        <div className="p-4 rounded-xl bg-[#07101D]/80 border border-white/[0.06] backdrop-blur-md">
          <div className="flex items-center justify-between text-[#98A2B3] mb-2">
            <span className="text-xs font-medium">Average Score</span>
            <Zap className="w-4 h-4 text-[#FDB022]" />
          </div>
          <div className="text-xl font-bold font-mono text-white">
            {stats.averageScore || '0.95'} <span className="text-xs text-[#98A2B3]">/ 1.0</span>
          </div>
          <span className="text-[11px] text-[#98A2B3] mt-1 block">Threshold requirement: {config.thresholdScore}</span>
        </div>
      </div>

      {/* Main Settings & Enforcement Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Card: Protected Application Touchpoints */}
        <div className="p-5 sm:p-6 rounded-2xl bg-[#07101D]/80 border border-white/[0.08] backdrop-blur-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#00CFFF]" />
              <h3 className="text-sm font-bold text-white">Enforced System Touchpoints</h3>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-xs text-[#98A2B3]">Global Shield</span>
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="w-4 h-4 rounded border-white/20 bg-[#05070B] text-[#00CFFF] focus:ring-0 cursor-pointer"
              />
            </label>
          </div>

          <p className="text-xs text-[#98A2B3]">
            Toggle individual user interaction pathways where real-time CAPTCHA assessment is required before requests are processed.
          </p>

          <div className="space-y-2.5 pt-1">
            {/* 1. Login */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-colors">
              <div>
                <span className="text-xs font-semibold text-white block">Account Sign-In (Login)</span>
                <span className="text-[11px] text-[#98A2B3]">Protects against brute force and credential stuffing</span>
              </div>
              <input
                type="checkbox"
                checked={config.enforcedActions.login}
                onChange={() => toggleAction('login')}
                className="w-4 h-4 rounded border-white/20 bg-[#05070B] text-[#00CFFF] cursor-pointer"
              />
            </div>

            {/* 2. Registration */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-colors">
              <div>
                <span className="text-xs font-semibold text-white block">User Registration &amp; Onboarding</span>
                <span className="text-[11px] text-[#98A2B3]">Blocks spam bot registrations and fake accounts</span>
              </div>
              <input
                type="checkbox"
                checked={config.enforcedActions.register}
                onChange={() => toggleAction('register')}
                className="w-4 h-4 rounded border-white/20 bg-[#05070B] text-[#00CFFF] cursor-pointer"
              />
            </div>

            {/* 3. Password Reset */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-colors">
              <div>
                <span className="text-xs font-semibold text-white block">Password Reset &amp; Recovery</span>
                <span className="text-[11px] text-[#98A2B3]">Prevents email bombing and reset token abuse</span>
              </div>
              <input
                type="checkbox"
                checked={config.enforcedActions.forgotPassword}
                onChange={() => toggleAction('forgotPassword')}
                className="w-4 h-4 rounded border-white/20 bg-[#05070B] text-[#00CFFF] cursor-pointer"
              />
            </div>

            {/* 4. Withdrawals */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-colors">
              <div>
                <span className="text-xs font-semibold text-white block">Fund Withdrawals (BEP-20 / Fiat)</span>
                <span className="text-[11px] text-[#98A2B3]">High-security human verification on crypto payouts</span>
              </div>
              <input
                type="checkbox"
                checked={config.enforcedActions.withdrawal}
                onChange={() => toggleAction('withdrawal')}
                className="w-4 h-4 rounded border-white/20 bg-[#05070B] text-[#00CFFF] cursor-pointer"
              />
            </div>

            {/* 5. Swaps */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-colors">
              <div>
                <span className="text-xs font-semibold text-white block">Coin Swaps (PHIVO &harr; USDT)</span>
                <span className="text-[11px] text-[#98A2B3]">Protects automated liquidity sniping and conversions</span>
              </div>
              <input
                type="checkbox"
                checked={config.enforcedActions.swap}
                onChange={() => toggleAction('swap')}
                className="w-4 h-4 rounded border-white/20 bg-[#05070B] text-[#00CFFF] cursor-pointer"
              />
            </div>

            {/* 6. Node Purchases */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-colors">
              <div>
                <span className="text-xs font-semibold text-white block">Genesis Node Purchase &amp; Activation</span>
                <span className="text-[11px] text-[#98A2B3]">Guarantees legitimate operator node acquisition</span>
              </div>
              <input
                type="checkbox"
                checked={config.enforcedActions.buyNode}
                onChange={() => toggleAction('buyNode')}
                className="w-4 h-4 rounded border-white/20 bg-[#05070B] text-[#00CFFF] cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Right Card: Google Cloud reCAPTCHA Enterprise Config & Live Simulator */}
        <div className="p-5 sm:p-6 rounded-2xl bg-[#07101D]/80 border border-white/[0.08] backdrop-blur-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#00CFFF]" />
              <h3 className="text-sm font-bold text-white">reCAPTCHA Enterprise Parameters</h3>
            </div>
            <span className="text-[10px] font-mono text-[#00CFFF] bg-[#00CFFF]/10 px-2 py-0.5 rounded border border-[#00CFFF]/30">
              {config.mode}
            </span>
          </div>

          <div className="space-y-3.5">
            {/* Mode selection */}
            <div>
              <label className="block text-xs font-medium text-[#98A2B3] mb-1">Defense Architecture Mode</label>
              <select
                value={config.mode}
                onChange={(e) => setConfig({ ...config, mode: e.target.value as any })}
                className="w-full bg-[#05070B] border border-white/[0.1] focus:border-[#00CFFF] rounded-lg px-3 py-2 text-xs text-white focus:outline-none min-h-[40px]"
              >
                <option value="HYBRID">Hybrid (reCAPTCHA Enterprise + Cryptographic Shield Fallback)</option>
                <option value="ENTERPRISE">Enterprise (Google Cloud reCAPTCHA Enterprise)</option>
                <option value="FALLBACK_CHALLENGE">Self-Hosted Cryptographic Shield (Zero 3rd-Party Dependencies)</option>
              </select>
            </div>

            {/* Google Cloud Project ID */}
            <div>
              <label className="block text-xs font-medium text-[#98A2B3] mb-1">Google Cloud Project ID</label>
              <input
                type="text"
                value={config.projectId}
                onChange={(e) => setConfig({ ...config, projectId: e.target.value })}
                className="w-full bg-[#05070B] border border-white/[0.1] focus:border-[#00CFFF] rounded-lg px-3 py-2 text-xs text-white font-mono placeholder:text-white/20 focus:outline-none min-h-[40px]"
              />
            </div>

            {/* Enterprise Site Key */}
            <div>
              <label className="block text-xs font-medium text-[#98A2B3] mb-1">Enterprise Site Key</label>
              <input
                type="text"
                value={config.siteKey}
                onChange={(e) => setConfig({ ...config, siteKey: e.target.value })}
                className="w-full bg-[#05070B] border border-white/[0.1] focus:border-[#00CFFF] rounded-lg px-3 py-2 text-xs text-white font-mono placeholder:text-white/20 focus:outline-none min-h-[40px]"
              />
            </div>

            {/* Threshold Score */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-[#98A2B3]">Human Score Threshold</label>
                <span className="text-xs font-mono font-bold text-[#00CFFF]">{config.thresholdScore}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                value={config.thresholdScore}
                onChange={(e) => setConfig({ ...config, thresholdScore: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-[#05070B] rounded-lg appearance-none cursor-pointer accent-[#00CFFF]"
              />
              <div className="flex justify-between text-[10px] text-[#98A2B3] mt-1">
                <span>0.1 (Permissive)</span>
                <span>0.5 (Recommended)</span>
                <span>0.9 (Strict)</span>
              </div>
            </div>

            {/* Test Simulation Button */}
            <div className="pt-2 border-t border-white/[0.06]">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#98A2B3]">Live Engine Diagnostic:</span>
                <button
                  type="button"
                  onClick={handleRunTest}
                  disabled={testing}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-white font-medium text-xs flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 text-[#00CFFF]" />}
                  <span>Test Real-Time Challenge</span>
                </button>
              </div>

              {testResult && (
                <div className="mt-2 p-2.5 rounded-lg bg-[#05070B] border border-white/[0.08] text-[11px] font-mono text-[#32D583]">
                  <div>Challenge ID: {testResult.challenge?.challengeId}</div>
                  <div>Question: {testResult.challenge?.question}</div>
                  <div>Visual Code: {testResult.challenge?.visualCode}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Verification Audit Stream */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#07101D]/80 border border-white/[0.08] backdrop-blur-xl space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#00CFFF]" />
            <h3 className="text-sm font-bold text-white">Live Verification Stream &amp; Audit Log</h3>
          </div>
          <span className="text-xs text-[#98A2B3] font-mono">Auto-syncing (8s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] uppercase tracking-wider text-[#98A2B3] border-b border-white/[0.06] bg-white/[0.02]">
              <tr>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">Client IP</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Score</th>
                <th className="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] font-mono">
              {stats.recentLogs && stats.recentLogs.length > 0 ? (
                stats.recentLogs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 px-3 text-[#98A2B3]">{new Date(log.createdAt).toLocaleTimeString()}</td>
                    <td className="py-2.5 px-3 font-sans font-medium text-white">{log.action}</td>
                    <td className="py-2.5 px-3 text-[#98A2B3]">{log.clientIp}</td>
                    <td className="py-2.5 px-3 text-[#00CFFF]">{log.challengeType}</td>
                    <td className="py-2.5 px-3">{log.score ?? '—'}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.status === 'PASSED'
                            ? 'bg-[#32D583]/10 text-[#32D583] border border-[#32D583]/30'
                            : 'bg-[#F04438]/10 text-[#F04438] border border-[#F04438]/30'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[#98A2B3] font-sans">
                    No recent verification records found. All system pathways are operational.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
