import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export type Role = 'owner' | 'field';

export interface SessionUser {
  id: string;
  loginId: string;
  displayName: string;
  role: Role;
}

const STORAGE_KEY = 'lets_session';
const LOCKOUT_KEY = 'lets_lockout';
const LOCKOUT_MINUTES = 15;
const MAX_FAILED_ATTEMPTS = 10;
const LOGIN_HISTORY_KEY = 'lets_login_history';
const LOGIN_HISTORY_MAX = 200;

export interface LoginHistoryEntry {
  userId: string;
  loginId: string;
  at: string;
  result: 'success' | 'failure';
  ipOrDevice?: string;
}

function loadSession(): { user: SessionUser; expiresAt: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.expiresAt && data.expiresAt < Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function saveSession(user: SessionUser, expiresAt: number) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, expiresAt }));
}

function getLockoutUntil(): number | null {
  try {
    const v = localStorage.getItem(LOCKOUT_KEY);
    if (!v) return null;
    const until = parseInt(v, 10);
    if (until <= Date.now()) {
      localStorage.removeItem(LOCKOUT_KEY);
      return null;
    }
    return until;
  } catch {
    return null;
  }
}

function setLockout() {
  localStorage.setItem(LOCKOUT_KEY, String(Date.now() + LOCKOUT_MINUTES * 60 * 1000));
}

function getFailedCount(): number {
  try {
    const v = localStorage.getItem('lets_failed_count');
    if (!v) return 0;
    const parsed = parseInt(v, 10);
    return isNaN(parsed) ? 0 : parsed;
  } catch {
    return 0;
  }
}

function clearFailedCount() {
  localStorage.removeItem('lets_failed_count');
}

function incrementFailedCount(): number {
  const n = getFailedCount() + 1;
  localStorage.setItem('lets_failed_count', String(n));
  return n;
}

function appendLoginHistory(entry: Omit<LoginHistoryEntry, 'at'>) {
  try {
    const at = new Date().toISOString();
    const raw = localStorage.getItem(LOGIN_HISTORY_KEY);
    let list: LoginHistoryEntry[] = raw ? JSON.parse(raw) : [];
    list = [{ ...entry, at }, ...list].slice(0, LOGIN_HISTORY_MAX);
    localStorage.setItem(LOGIN_HISTORY_KEY, JSON.stringify(list));
  } catch (_) {}
}

export function getLoginHistory(): LoginHistoryEntry[] {
  try {
    const raw = localStorage.getItem(LOGIN_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

interface AuthContextValue {
  session: { user: SessionUser; expiresAt: number } | null;
  login: (loginId: string, password: string, users: { id: string; loginId: string; displayName: string; role: string; passwordHash?: string; isActive: boolean }[]) => { success: boolean; error?: string };
  logout: () => void;
  refreshSession: () => void;
  lockoutUntil: number | null;
  isOwner: boolean;
  isField: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function safeLoadSession(): { user: SessionUser; expiresAt: number } | null {
  try {
    return loadSession();
  } catch {
    return null;
  }
}

function safeGetLockoutUntil(): number | null {
  try {
    return getLockoutUntil();
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<{ user: SessionUser; expiresAt: number } | null>(safeLoadSession);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(safeGetLockoutUntil);

  const refreshSession = useCallback(() => {
    const next = loadSession();
    setSession(next);
    setLockoutUntil(getLockoutUntil());
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }, []);

  const login = useCallback(
    (
      loginId: string,
      password: string,
      users: { id: string; loginId: string; displayName: string; role: string; passwordHash?: string; isActive: boolean }[]
    ): { success: boolean; error?: string } => {
      if (getLockoutUntil()) {
        return { success: false, error: `ロック中です。${LOCKOUT_MINUTES}分後に再試行してください。` };
      }
      const user = users.find((u) => u.loginId === loginId && u.isActive);
      // デモ: パスワードは "password" または 登録時の平文が hash として保存されている場合は照合しない（バックエンドでハッシュ照合する想定）
      const passwordOk = !user ? false : user.passwordHash ? password === 'password' || password.length >= 8 : password.length >= 8;
      if (!user || !passwordOk) {
        const count = incrementFailedCount();
        appendLoginHistory({ userId: '', loginId, result: 'failure', ipOrDevice: 'WEB' });
        if (count >= MAX_FAILED_ATTEMPTS) {
          setLockout();
          setLockoutUntil(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
          return { success: false, error: `ログイン失敗が${MAX_FAILED_ATTEMPTS}回を超えたため、${LOCKOUT_MINUTES}分間ロックされます。` };
        }
        return { success: false, error: 'ログインIDまたはパスワードが正しくありません。' };
      }
      clearFailedCount();
      const role: Role = user.role === 'owner' || user.role === 'admin' ? 'owner' : 'field';
      const sessionUser: SessionUser = { id: user.id, loginId: user.loginId, displayName: user.displayName, role };
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24h
      saveSession(sessionUser, expiresAt);
      setSession({ user: sessionUser, expiresAt });
      appendLoginHistory({ userId: user.id, loginId: user.loginId, result: 'success', ipOrDevice: 'WEB' });
      return { success: true };
    },
    []
  );

  useEffect(() => {
    const t = setInterval(() => setLockoutUntil(getLockoutUntil()), 5000);
    return () => clearInterval(t);
  }, []);

  // 有効期限が近いとき延長／期限切れならログアウト
  useEffect(() => {
    if (!session) return;
    const now = Date.now();
    if (session.expiresAt < now) {
      logout();
      return;
    }
    const extendThreshold = 5 * 60 * 1000;
    if (session.expiresAt - now < extendThreshold) {
      const newExpiresAt = now + 24 * 60 * 60 * 1000;
      saveSession(session.user, newExpiresAt);
      setSession({ user: session.user, expiresAt: newExpiresAt });
    }
  }, [session?.expiresAt, session?.user, logout]);

  const value: AuthContextValue = {
    session,
    login,
    logout,
    refreshSession,
    lockoutUntil,
    isOwner: session?.user?.role === 'owner',
    isField: session?.user?.role === 'field',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
