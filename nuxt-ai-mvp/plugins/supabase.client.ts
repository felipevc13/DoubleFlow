import { createClient } from "@supabase/supabase-js";
import type { Database } from "~/types/supabase";
import { defineNuxtPlugin, useRuntimeConfig } from "#imports";

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  const url = config.public.SUPABASE_URL as string;
  const anon = config.public.SUPABASE_ANON_KEY as string;

  const supabase = createClient<Database>(url, anon, {
    auth: { persistSession: true, autoRefreshToken: true },
  });

  return {
    provide: { supabase },
  };
});
