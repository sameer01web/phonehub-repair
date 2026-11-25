import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Profile, UserRole } from "./types";
import type { Session, User } from "@supabase/supabase-js";

export const VALID_ROLES = [
  "owner",
  "workshop_manager",
  "technician",
  "inventory",
  "qc_inspector",
  "procurement",
] as const;

/**
 * Roles permitted to execute Goods Receipt FIFO processing:
 * 1. owner
 * 2. workshop_manager
 * 3. inventory
 * 4. procurement
 */
export const ALLOWED_FIFO_ROLES: string[] = [
  "owner",
  "workshop_manager",
  "inventory",
  "procurement",
];

export function canProcessGoodsReceiptFifo(role?: string | null): boolean {
  if (!role) return false;
  const normalized = role.trim().toLowerCase();
  return ALLOWED_FIFO_ROLES.some((r) => r.toLowerCase() === normalized);
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: string | null;
  isLoading: boolean;
  isAuthorizedForFifo: boolean;
  error: string | null;
}

export function useAuth(): AuthState & {
  signIn: (email: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  switchRole: (newRole: string) => void;
} {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  async function loadProfileForUser(currentUser: User | null) {
    if (!currentUser || !supabase) {
      setProfile(null);
      setRole(null);
      setError(null);
      return;
    }
    setError(null);
    try {
      // Query profiles table for current user directly from database
      const { data, error: profileErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (profileErr) {
        console.warn("Could not fetch user profile from profiles table:", profileErr.message);

        // Resilience 1: If authenticated user is the primary workshop owner (phone@gmail.com)
        if (currentUser.email === "phone@gmail.com") {
          const ownerProfile: Profile = {
            id: currentUser.id,
            full_name: (currentUser.user_metadata?.full_name as string) || "aziz",
            role: "owner",
            is_active: true,
            specialization: "General mobile technician",
            created_at: new Date().toISOString(),
          };
          const savedOverride = localStorage.getItem("phonehub_active_role");
          const activeRole =
            savedOverride && (VALID_ROLES as readonly string[]).includes(savedOverride)
              ? savedOverride
              : "owner";

          setProfile(ownerProfile);
          setRole(activeRole);
          setError(null);
          try {
            localStorage.setItem("phonehub_cached_profile", JSON.stringify(ownerProfile));
          } catch {}
          return;
        }

        // Resilience 2: Check cached profile from localStorage
        try {
          const cached = localStorage.getItem("phonehub_cached_profile");
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.id === currentUser.id && parsed.role) {
              setProfile(parsed);
              setRole(parsed.role);
              setError(null);
              return;
            }
          }
        } catch {}

        setProfile(null);
        setRole(null);
        setError("Unable to verify user profile from database. Protected access denied.");
        return;
      }

      if (!data) {
        // If profile row is missing in DB for primary owner, initialize it gracefully
        if (currentUser.email === "phone@gmail.com") {
          const ownerProfile: Profile = {
            id: currentUser.id,
            full_name: (currentUser.user_metadata?.full_name as string) || "aziz",
            role: "owner",
            is_active: true,
            specialization: "General mobile technician",
            created_at: new Date().toISOString(),
          };
          setProfile(ownerProfile);
          setRole("owner");
          setError(null);
          try {
            localStorage.setItem("phonehub_cached_profile", JSON.stringify(ownerProfile));
          } catch {}
          return;
        }

        setProfile(null);
        setRole(null);
        setError("Profile not found in database. Protected access denied. Please contact the workshop owner.");
        return;
      }

      // Security rule: If profile is marked inactive, deny access
      if (data.is_active === false) {
        setProfile(data as Profile);
        setRole(null);
        setError("Your account is inactive. Protected workshop access denied.");
        return;
      }

      // Validate role from database
      const rawRole = (data.role || "").trim().toLowerCase();
      const isValidRole = (VALID_ROLES as readonly string[]).includes(rawRole);

      if (!isValidRole) {
        setProfile(data as Profile);
        setRole(null);
        setError(`Invalid role "${data.role}" assigned in database. Protected access denied.`);
        return;
      }

      // Role preview override (development / testing UI preview ONLY)
      const savedOverride = localStorage.getItem("phonehub_active_role");
      const activeRole =
        savedOverride && (VALID_ROLES as readonly string[]).includes(savedOverride)
          ? savedOverride
          : rawRole;

      setProfile(data as Profile);
      setRole(activeRole);
      try {
        localStorage.setItem("phonehub_cached_profile", JSON.stringify(data));
      } catch {}
    } catch (err: any) {
      setProfile(null);
      setRole(null);
      setError(err?.message || "Failed to verify authorization profile");
    }
  }

  function switchRole(newRole: string) {
    // Role switcher is purely a development/testing UI preview.
    // It changes client UI layout preview and CANNOT grant backend database permissions.
    if (!user) {
      console.warn("Cannot switch preview role: User not authenticated.");
      return;
    }
    if ((VALID_ROLES as readonly string[]).includes(newRole)) {
      localStorage.setItem("phonehub_active_role", newRole);
      setRole(newRole);
      if (profile) {
        setProfile({ ...profile, role: newRole });
      }
    }
  }


  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    // 1. Get existing session on mount
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      if (existingSession?.user) {
        loadProfileForUser(existingSession.user).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    // 2. Subscribe to auth state changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        await loadProfileForUser(newSession.user);
      } else {
        setProfile(null);
        setRole(null);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, pass: string) {
    if (!supabase) throw new Error("Supabase is not configured.");
    setIsLoading(true);
    setError(null);
    const { data, error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    if (signInErr) {
      setIsLoading(false);
      throw signInErr;
    }
    setSession(data.session);
    setUser(data.user);
    if (data.user) {
      await loadProfileForUser(data.user);
    }
    setIsLoading(false);
  }

  async function signOut() {
    if (!supabase) return;
    setIsLoading(true);
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setRole(null);
    setIsLoading(false);
  }

  async function refreshProfile() {
    if (user) {
      setIsLoading(true);
      await loadProfileForUser(user);
      setIsLoading(false);
    }
  }

  const isAuthorizedForFifo = canProcessGoodsReceiptFifo(role);

  return {
    user,
    session,
    profile,
    role,
    isLoading,
    isAuthorizedForFifo,
    error,
    signIn,
    signOut,
    refreshProfile,
    switchRole,
  };
}
