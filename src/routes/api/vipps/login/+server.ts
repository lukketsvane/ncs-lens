import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ cookies, url }) => {
  const clientId = env.VIPPS_CLIENT_ID;
  const apiUrl = env.VIPPS_API_URL || 'https://api.vipps.no';

  if (!clientId) {
    throw new Error('Missing VIPPS_CLIENT_ID');
  }

  const redirectUri = `${url.origin}/api/vipps/callback`;

  // Generate random state for CSRF protection
  const state = crypto.randomUUID();
  cookies.set('vipps_state', state, {
    path: '/',
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
  });

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    scope: 'openid name email phoneNumber',
    state,
    redirect_uri: redirectUri,
  });

  const authUrl = `${apiUrl}/access-management-1.0/access/oauth2/auth?${params.toString()}`;
  throw redirect(302, authUrl);
};
