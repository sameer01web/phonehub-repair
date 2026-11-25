import { createClient } from "@supabase/supabase-js";

const env = typeof import.meta !== "undefined" && (import.meta as any).env
  ? (import.meta as any).env
  : ((typeof globalThis !== "undefined" && (globalThis as any).process?.env) || {});

const url = (
  env.VITE_SUPABASE_URL ||
  env.NEXT_PUBLIC_SUPABASE_URL
) as string | undefined;

const key = (
  env.VITE_SUPABASE_ANON_KEY ||
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY
) as string | undefined;

export const isSupabaseConfigured = Boolean(
  url && key && !url.includes("YOUR-PROJECT")
);

export const supabase = isSupabaseConfigured
  ? createClient(url!, key!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

