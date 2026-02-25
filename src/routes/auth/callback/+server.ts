import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Supabase auth callback handler.
 * When Supabase processes a magic link (from the action_link fallback),
 * it may redirect here with a code parameter for PKCE flow.
 * We pass the code to the client-side for session exchange.
 */
export const GET: RequestHandler = async ({ url }) => {
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');

  // If we have a token_hash, redirect to home page for client-side OTP verification
  if (tokenHash) {
    const appUrl = new URL('/', url.origin);
    appUrl.searchParams.set('token_hash', tokenHash);
    if (type) appUrl.searchParams.set('type', type);
    throw redirect(302, appUrl.toString());
  }

  // If we have a PKCE code, redirect to home with it for client-side exchange
  if (code) {
    const appUrl = new URL('/', url.origin);
    appUrl.searchParams.set('code', code);
    throw redirect(302, appUrl.toString());
  }

  // No auth params - just redirect home
  throw redirect(302, '/');
};
