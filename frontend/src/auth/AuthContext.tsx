import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch, demoProfileStorageKey, isDemoMode } from "../api/client";
import type { CurrentUser } from "../types";
import { AuthContext } from "./AuthState";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (isDemoMode && !localStorage.getItem(demoProfileStorageKey)) {
      setUser(null);
      setLoading(false);
      return;
    }
    if (!isDemoMode) {
      const { supabase } = await import("./supabase");
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setUser(null);
        setLoading(false);
        return;
      }
    }
    setLoading(true);
    setError(null);
    try {
      setUser(await apiFetch<CurrentUser>("/api/me"));
    } catch (caught) {
      setUser(null);
      setError(
        caught instanceof Error ? caught.message : "ไม่สามารถตรวจสอบผู้ใช้ได้",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    if (isDemoMode) return;
    let unsubscribe: (() => void) | undefined;
    void import("./supabase").then(({ supabase }) => {
      const { data } = supabase.auth.onAuthStateChange(() => {
        void refresh();
      });
      unsubscribe = () => data.subscription.unsubscribe();
    });
    return () => unsubscribe?.();
  }, [refresh]);

  const selectDemoProfile = useCallback(
    async (profileId: string) => {
      localStorage.setItem(demoProfileStorageKey, profileId);
      await refresh();
    },
    [refresh],
  );
  const signIn = useCallback(
    async (email: string, password: string) => {
      const { supabase } = await import("./supabase");
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;
      await refresh();
    },
    [refresh],
  );
  const signOut = useCallback(async () => {
    if (isDemoMode) localStorage.removeItem(demoProfileStorageKey);
    else {
      const { supabase } = await import("./supabase");
      await supabase.auth.signOut();
    }
    setUser(null);
  }, []);
  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      selectDemoProfile,
      signIn,
      signOut,
      refresh,
    }),
    [user, loading, error, selectDemoProfile, signIn, signOut, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
