"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AUTH_EXPIRED_EVENT,
  apiLogin,
  apiLogout,
  apiMe,
  apiHealth,
} from "../lib/client-api";

const AuthContext = createContext(null);

/** 过渡：把网关登录态写入旧 client supabase 存储，供尚未迁移的评论/关注等使用 */
const LEGACY_SESSION_KEY = "tihu.supabase.session";

function bridgeLegacySession(tokens, user) {
  if (typeof window === "undefined") return;
  if (!tokens?.access_token || !user?.id) {
    localStorage.removeItem(LEGACY_SESSION_KEY);
    return;
  }
  localStorage.setItem(
    LEGACY_SESSION_KEY,
    JSON.stringify({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || "",
      expires_at: tokens.expires_at || 0,
      user: { id: user.id, email: user.email || "" },
    }),
  );
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [gatewayOk, setGatewayOk] = useState(null);
  const [authExpiredTick, setAuthExpiredTick] = useState(0);

  const applySession = useCallback((payload) => {
    if (!payload?.user?.id) {
      setUser(null);
      setProfile(null);
      bridgeLegacySession(null, null);
      return;
    }
    setUser(payload.user);
    setProfile(
      payload.profile || {
        id: payload.user.id,
        nickname: "",
        avatarUrl: "",
        displayName: `用户${payload.user.id.slice(0, 4)}`,
      },
    );
    if (payload.tokens) {
      bridgeLegacySession(payload.tokens, payload.user);
    }
  }, []);

  const clearLocalAuth = useCallback(() => {
    setUser(null);
    setProfile(null);
    bridgeLegacySession(null, null);
  }, []);

  useEffect(() => {
    const onExpired = () => {
      clearLocalAuth();
      setAuthExpiredTick((n) => n + 1);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, [clearLocalAuth]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const health = await apiHealth().catch(() => null);
        if (!alive) return;
        setGatewayOk(Boolean(health?.ok));
        setConfigured(health?.configured !== false && health != null);
        if (health && health.ok === false && health.supabase === false) {
          setConfigured(true);
        }
      } catch (_) {
        if (alive) {
          setConfigured(false);
          setGatewayOk(false);
        }
      }

      try {
        const me = await apiMe();
        if (!alive) return;
        if (me?.configured === false) setConfigured(false);
        // me 可能因服务端 refresh 带回新 tokens
        applySession(me);
      } catch (e) {
        if (!alive) return;
        setUser(null);
        setProfile(null);
        if (e?.status === 401 || e?.authExpired) {
          bridgeLegacySession(null, null);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [applySession]);

  const signIn = useCallback(
    async ({ email, password, nickname }) => {
      const data = await apiLogin({ email, password, nickname });
      applySession(data);
      return data.user;
    },
    [applySession],
  );

  const signOut = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      applySession(null);
    }
  }, [applySession]);

  const refreshProfile = useCallback(async () => {
    const me = await apiMe();
    applySession({ ...me, tokens: undefined });
  }, [applySession]);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      configured,
      gatewayOk,
      isLoggedIn: Boolean(user?.id),
      authExpiredTick,
      signIn,
      signOut,
      refreshProfile,
      setProfile,
      clearLocalAuth,
    }),
    [
      user,
      profile,
      loading,
      configured,
      gatewayOk,
      authExpiredTick,
      signIn,
      signOut,
      refreshProfile,
      clearLocalAuth,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
