import "server-only";

import { createClient, type PostgrestError, type SupabaseClient } from "@supabase/supabase-js";

// Users, sessions, listings and messages live in Supabase Postgres (schema in
// supabase/schema.sql). The server talks to it with the service role key,
// which bypasses Row Level Security, so this module must never reach the
// browser. The tables have RLS on with no policies, so the public anon key
// can't read them.

export type Role = "user" | "admin";
export type Status = "active" | "suspended";

export type UserRow = {
  id: string;
  email: string;
  name: string;
  phone: string;
  password_hash: string;
  role: Role;
  status: Status;
  details: Record<string, unknown>;
  created_at: string;
  last_login_at: string | null;
  email_verified_at: string | null;
  updated_at: string;
  deleted_at: string | null;
};

const globalForDb = globalThis as unknown as { trucostDb?: SupabaseClient };

function connect() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL in .env.local");
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY in .env.local (Supabase → Project Settings → API Keys → service_role / secret key)",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

// One client, reused across hot reloads in development.
export function db() {
  globalForDb.trucostDb ??= connect();
  return globalForDb.trucostDb;
}

// Returns a query's data, or throws its error so failures are never silent.
export function must<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) throw new Error(`Database error: ${result.error.message}`);
  return result.data as T;
}

// Returns a count query's count, or throws.
export function mustCount(result: { count: number | null; error: PostgrestError | null }) {
  if (result.error) throw new Error(`Database error: ${result.error.message}`);
  return result.count ?? 0;
}
