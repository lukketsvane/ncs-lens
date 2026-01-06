import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase: SupabaseClient;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables. Running in demo mode.');
  // Create a mock client for demo purposes
  supabase = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: async () => ({ data: { user: null, session: null }, error: new Error('Demo mode') }),
      signUp: async () => ({ data: { user: null, session: null }, error: new Error('Demo mode') }),
      signOut: async () => ({ error: null }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ order: () => ({ data: [], error: null }) }), order: () => ({ data: [], error: null }) }),
      insert: () => ({ select: () => ({ single: () => ({ data: null, error: null }) }) }),
      update: () => ({ eq: () => ({ data: null, error: null }) }),
      delete: () => ({ eq: () => ({ data: null, error: null }) }),
    }),
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: null }),
        remove: async () => ({ data: null, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
      }),
    },
  } as unknown as SupabaseClient;
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };
