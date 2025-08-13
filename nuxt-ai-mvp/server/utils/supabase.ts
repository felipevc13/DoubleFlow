// server/utils/supabase.ts
// Único ponto de acesso ao Supabase no server (Nuxt/Nitro)
// - Client SSR com sessão do usuário via cookies (RLS aplicada)
// - Fallback service role para rotinas administrativas (sem sessão)
// - Exports compatíveis: getSupabaseWithAuth, getSupabaseAuth (alias), getSupabase, serverSupabaseService, serverSupabase (alias)

import type { H3Event } from "h3";
import { getCookie, setCookie, deleteCookie, getHeader } from "h3";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~/types/supabase";

let _serviceClient: SupabaseClient<Database> | null = null;

function readAccessTokenFromEvent(event: H3Event): string | null {
  const auth = getHeader(event, "authorization");
  if (auth && auth.startsWith("Bearer ")) return auth.slice(7);
  const cookie = getCookie(event, "sb-access-token");
  return cookie || null;
}

/**
 * Client service role (sem sessão). Use apenas para jobs/admin onde RLS não é desejada.
 */
export function serverSupabaseService(): SupabaseClient<Database> {
  if (_serviceClient) return _serviceClient;
  const url = process.env.SUPABASE_URL as string;
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY) as string;
  if (!url || !key) {
    throw new Error(
      "[supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes"
    );
  }
  _serviceClient = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _serviceClient;
}

/**
 * Alias de compatibilidade (algum código legado pode chamar serverSupabase()).
 */
export const serverSupabase = serverSupabaseService;

/**
 * Cria um client SSR com sessão do usuário via cookies (RLS aplicada).
 * Use este client em TUDO que for request de usuário.
 */
export function getSupabase(event: H3Event): SupabaseClient<Database> {
  const supabaseUrl = process.env.SUPABASE_URL as string;
  const anonKey = process.env.SUPABASE_ANON_KEY as string;
  if (!supabaseUrl || !anonKey) {
    throw new Error("[supabase] SUPABASE_URL / SUPABASE_ANON_KEY ausentes");
  }

  // If the request sends an Authorization: Bearer <token>, prefer header-based auth (no refresh/persist on server)
  const accessToken = readAccessTokenFromEvent(event);
  if (accessToken) {
    return createClient<Database>(supabaseUrl, anonKey, {
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  // Fallback to cookie-based SSR client managed by @supabase/ssr
  return createServerClient<Database>(supabaseUrl, anonKey, {
    cookies: {
      get(name: string) {
        return getCookie(event, name) ?? "";
      },
      set(name: string, value: string, options: CookieOptions) {
        setCookie(event, name, value, {
          ...options,
          sameSite: "lax",
          secure: true,
          httpOnly: false,
        });
      },
      remove(name: string, options: CookieOptions) {
        deleteCookie(event, name, { path: options?.path });
      },
    },
  });
}

/**
 * Retorna supabase + user autenticado (levando em conta cookies do request).
 * Lança erro se houver falha na leitura do user.
 */
export async function getSupabaseWithAuth(event: H3Event) {
  const supabase = getSupabase(event);
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return { supabase, user: data.user };
}

/**
 * Alias de compatibilidade (algum código chama getSupabaseAuth).
 */
export const getSupabaseAuth = getSupabaseWithAuth;
