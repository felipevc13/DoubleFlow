import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~/types/supabase";
import { useNuxtApp } from "#imports";

/**
 * Wrapper para pegar a instância única do Supabase provida pelo plugin Nuxt.
 * Uso: const supabase = useSupabaseClient()
 */
export function useSupabaseClient(): SupabaseClient<Database> {
  const { $supabase } = useNuxtApp();
  return $supabase as SupabaseClient<Database>;
}

/**
 * Helper opcional: usuário autenticado atual no browser via plugin.
 */
export async function getBrowserUser() {
  const supabase = useSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}
