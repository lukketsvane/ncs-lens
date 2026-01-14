import { writable, derived, get } from 'svelte/store';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '$lib/supabase';

// Auth stores
export const user = writable<User | null>(null);
export const session = writable<Session | null>(null);
export const authLoading = writable(true);

// Initialize auth state
export async function initAuth() {
  authLoading.set(true);
  
  // Get initial session
  const { data: { session: currentSession } } = await supabase.auth.getSession();
  session.set(currentSession);
  user.set(currentSession?.user ?? null);
  authLoading.set(false);

  // Listen for auth changes
  supabase.auth.onAuthStateChange((_event, newSession) => {
    session.set(newSession);
    user.set(newSession?.user ?? null);
    authLoading.set(false);
  });
}

// Auth actions
export async function signUp(email: string, password: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: undefined,
    }
  });
  return { error: error as Error | null };
}

export async function signIn(email: string, password: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { error: error as Error | null };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

// Check if user is logged in
export const isLoggedIn = derived(user, $user => $user !== null);
