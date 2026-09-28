import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface SystemConfigState {
  minWithdrawalAmount: number;
  autoWithdrawalEnabled: boolean;
  coinPriceUsdt: number;
  nodeBasePriceUsd: number;
  directReferralCommissionRate: number;
  genesisNodeCap: number;
  captchaEnabled: boolean;
  lastUpdated: string;
  isConnected: boolean;
}

interface SystemConfigContextType extends SystemConfigState {
  refetchConfigs: () => Promise<void>;
}

const SystemConfigContext = createContext<SystemConfigContextType | undefined>(undefined);

export const SystemConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [configs, setConfigs] = useState<SystemConfigState>({
    minWithdrawalAmount: 0.10,
    autoWithdrawalEnabled: false,
    coinPriceUsdt: 0.10,
    nodeBasePriceUsd: 50.0,
    directReferralCommissionRate: 10,
    genesisNodeCap: 1000,
    captchaEnabled: false,
    lastUpdated: new Date().toISOString(),
    isConnected: true,
  });

  // REST Snapshot fetch
  const fetchConfigs = useCallback(async () => {
    try {
      const [withdrawalRes, networkRes] = await Promise.all([
        fetch('/api/withdrawals/config').catch(() => null),
        fetch('/api/public/network/summary').catch(() => null),
      ]);

      setConfigs((prev) => {
        const next = { ...prev };
        let updated = false;

        if (withdrawalRes && withdrawalRes.ok) {
          withdrawalRes.json().then((data) => {
            if (typeof data.minWithdrawalAmount === 'number' && data.minWithdrawalAmount !== next.minWithdrawalAmount) {
              setConfigs((p) => ({ ...p, minWithdrawalAmount: data.minWithdrawalAmount }));
            }
          }).catch(() => {});
        }

        if (networkRes && networkRes.ok) {
          networkRes.json().then((data) => {
            if (data) {
              setConfigs((p) => ({
                ...p,
                coinPriceUsdt: typeof data.internalCoinPriceUsdt === 'number' ? data.internalCoinPriceUsdt : p.coinPriceUsdt,
                nodeBasePriceUsd: typeof data.nodeBasePriceUsd === 'number' ? data.nodeBasePriceUsd : p.nodeBasePriceUsd,
                minWithdrawalAmount: typeof data.minWithdrawalAmount === 'number' ? data.minWithdrawalAmount : p.minWithdrawalAmount,
                lastUpdated: new Date().toISOString(),
              }));
            }
          }).catch(() => {});
        }

        return next;
      });
    } catch (err) {
      console.warn('[SystemConfigContext] REST sync error:', err);
    }
  }, []);

  // 1. Subscribe to Firestore Real-Time Settings Snapshots
  useEffect(() => {
    let unsubscribeWithdrawals: () => void = () => {};
    let unsubscribeConfigs: () => void = () => {};
    let unsubscribeEconomic: () => void = () => {};

    try {
      // Document 1: 'withdrawals'
      unsubscribeWithdrawals = onSnapshot(
        doc(db, 'system_settings', 'withdrawals'),
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            setConfigs((prev) => ({
              ...prev,
              minWithdrawalAmount: typeof data.minWithdrawalAmount === 'number' ? data.minWithdrawalAmount : prev.minWithdrawalAmount,
              autoWithdrawalEnabled: typeof data.autoWithdrawalEnabled === 'boolean' ? data.autoWithdrawalEnabled : prev.autoWithdrawalEnabled,
              lastUpdated: data.updatedAt || new Date().toISOString(),
              isConnected: true,
            }));
          }
        },
        (err) => {
          console.warn('[SystemConfigContext] Firestore withdrawals listener warning:', err);
        }
      );

      // Document 2: 'configs'
      unsubscribeConfigs = onSnapshot(
        doc(db, 'system_settings', 'configs'),
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            setConfigs((prev) => {
              const updated = { ...prev, isConnected: true };
              if (typeof data.MIN_WITHDRAWAL_AMOUNT === 'number') updated.minWithdrawalAmount = data.MIN_WITHDRAWAL_AMOUNT;
              if (typeof data.AUTO_WITHDRAWAL_ENABLED === 'boolean') updated.autoWithdrawalEnabled = data.AUTO_WITHDRAWAL_ENABLED;
              if (typeof data.INTERNAL_COIN_PRICE_USDT === 'number') updated.coinPriceUsdt = data.INTERNAL_COIN_PRICE_USDT;
              if (typeof data.NODE_BASE_PRICE_USD === 'number') updated.nodeBasePriceUsd = data.NODE_BASE_PRICE_USD;
              if (typeof data.DIRECT_REFERRAL_COMMISSION_USD === 'number') updated.directReferralCommissionRate = data.DIRECT_REFERRAL_COMMISSION_USD;
              updated.lastUpdated = data.updatedAt || new Date().toISOString();
              return updated;
            });
          }
        },
        (err) => {
          console.warn('[SystemConfigContext] Firestore configs listener warning:', err);
        }
      );

      // Document 3: 'economic'
      unsubscribeEconomic = onSnapshot(
        doc(db, 'system_settings', 'economic'),
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            setConfigs((prev) => {
              const updated = { ...prev, isConnected: true };
              if (typeof data.INTERNAL_COIN_PRICE_USDT === 'number') updated.coinPriceUsdt = data.INTERNAL_COIN_PRICE_USDT;
              if (typeof data.NODE_BASE_PRICE_USD === 'number') updated.nodeBasePriceUsd = data.NODE_BASE_PRICE_USD;
              if (typeof data.GENESIS_NODE_CAP === 'number') updated.genesisNodeCap = data.GENESIS_NODE_CAP;
              updated.lastUpdated = data.updatedAt || new Date().toISOString();
              return updated;
            });
          }
        },
        (err) => {
          console.warn('[SystemConfigContext] Firestore economic listener warning:', err);
        }
      );
    } catch (e) {
      console.warn('[SystemConfigContext] Firestore real-time setup warning:', e);
    }

    return () => {
      unsubscribeWithdrawals();
      unsubscribeConfigs();
      unsubscribeEconomic();
    };
  }, []);

  // 2. Connect to Server-Sent Events (SSE) Stream
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/public/network/stream');

      es.addEventListener('system_config', (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload && payload.key) {
            const key = String(payload.key).toUpperCase();
            const val = payload.value;

            setConfigs((prev) => {
              const updated = { ...prev, lastUpdated: new Date().toISOString() };
              if (key === 'MIN_WITHDRAWAL_AMOUNT') updated.minWithdrawalAmount = Number(val);
              if (key === 'AUTO_WITHDRAWAL_ENABLED') updated.autoWithdrawalEnabled = Boolean(val);
              if (key === 'INTERNAL_COIN_PRICE_USDT') updated.coinPriceUsdt = Number(val);
              if (key === 'NODE_BASE_PRICE_USD') updated.nodeBasePriceUsd = Number(val);
              if (key === 'DIRECT_REFERRAL_COMMISSION_USD') updated.directReferralCommissionRate = Number(val);
              return updated;
            });
          }
        } catch {
          // ignore parse errors
        }
      });
    } catch (err) {
      console.warn('[SystemConfigContext] SSE connection error:', err);
    }

    return () => {
      if (es) es.close();
    };
  }, []);

  // 3. Fallback fast poll every 4 seconds to guarantee sync
  useEffect(() => {
    fetchConfigs();
    const interval = setInterval(() => {
      fetchConfigs();
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchConfigs]);

  return (
    <SystemConfigContext.Provider value={{ ...configs, refetchConfigs: fetchConfigs }}>
      {children}
    </SystemConfigContext.Provider>
  );
};

export const useSystemConfig = () => {
  const context = useContext(SystemConfigContext);
  if (!context) {
    throw new Error('useSystemConfig must be used within a SystemConfigProvider');
  }
  return context;
};
