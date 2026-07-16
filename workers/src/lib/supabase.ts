import { createClient } from '@supabase/supabase-js';

export interface SupabaseEnv {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

let supabaseClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient(env: SupabaseEnv) {
  if (!supabaseClient) {
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
    }
    
    supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false, // Cloudflare Workers don't have persistent storage
      },
    });
  }
  
  return supabaseClient;
}

// Helper function to check if Supabase is configured
export function isSupabaseConfigured(env: SupabaseEnv): boolean {
  return !!(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
}
