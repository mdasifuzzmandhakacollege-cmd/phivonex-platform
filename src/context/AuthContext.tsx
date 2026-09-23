import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export interface UserProfile {
  id: string;
  publicId?: string;
  referralCode?: string;
  fullName: string;
  email: string;
  phone?: string | null;
  country?: string;
  status: string;
  emailVerified: boolean;
  createdAt?: string;
  lastLoginAt?: string;
}

export interface ReferralDetails {
  publicId: string;
  referralCode: string;
  referralUrl: string;
  sponsor: {
    publicId: string;
    displayName: string;
  } | null;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  register: (data: {
    fullName: string;
    email: string;
    phone?: string;
    country: string;
    password: string;
    referralCode?: string;
  }) => Promise<UserProfile>;
  login: (data: {
    identifier: string;
    password: string;
    rememberMe?: boolean;
  }) => Promise<UserProfile>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<{ message: string }>;
  resetPassword: (token: string, newPassword: string) => Promise<{ message: string }>;
  verifyEmail: (token: string) => Promise<{ message: string }>;
  resendVerification: (email?: string) => Promise<{ message: string }>;
  refreshUser: () => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<UserProfile | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch current authenticated user from session (/api/auth/me)
  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user || data);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.warn('[AuthContext] /api/auth/me check failed:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // 1. Register with backend API
  const register = async (data: {
    fullName: string;
    email: string;
    phone?: string;
    country: string;
    password: string;
    referralCode?: string;
  }): Promise<UserProfile> => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    const result = await res.json();

    if (!res.ok) {
      const errMessage = result.message || result.error || 'Registration failed. Please try again.';
      throw new Error(errMessage);
    }

    setUser(result.user);
    return result.user;
  };

  // 2. Login with backend API
  const login = async (data: {
    identifier: string;
    password: string;
    rememberMe?: boolean;
  }): Promise<UserProfile> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    const result = await res.json();

    if (!res.ok) {
      const errMessage = result.message || result.error || 'Invalid email/phone or password.';
      throw new Error(errMessage);
    }

    setUser(result.user);
    return result.user;
  };

  // 3. Logout
  const logout = async (): Promise<void> => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
    } catch (err) {
      console.warn('[AuthContext] Logout fetch failed:', err);
    } finally {
      setUser(null);
    }
  };

  // 4. Forgot Password
  const forgotPassword = async (email: string) => {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email }),
    });

    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.message || 'Failed to process forgot password request.');
    }
    return result;
  };

  // 5. Reset Password
  const resetPassword = async (token: string, newPassword: string) => {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token, newPassword }),
    });

    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.message || 'Failed to reset password.');
    }
    return result;
  };

  // 6. Verify Email
  const verifyEmail = async (token: string) => {
    const res = await fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token }),
    });

    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.message || 'Failed to verify email.');
    }
    await refreshUser();
    return result;
  };

  // 7. Resend Verification
  const resendVerification = async (email?: string) => {
    const res = await fetch('/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: email || user?.email }),
    });

    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.message || 'Failed to resend verification.');
    }
    return result;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        register,
        login,
        logout,
        forgotPassword,
        resetPassword,
        verifyEmail,
        resendVerification,
        refreshUser,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
