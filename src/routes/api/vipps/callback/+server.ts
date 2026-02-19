import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { getSupabaseAdmin } from '$lib/server/supabase-admin';

export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const storedState = cookies.get('vipps_state');

  // Validate state
  if (!state || !storedState || state !== storedState) {
    throw error(400, 'Invalid state parameter');
  }
  cookies.delete('vipps_state', { path: '/' });

  if (!code) {
    throw error(400, 'Missing authorization code');
  }

  const clientId = env.VIPPS_CLIENT_ID;
  const clientSecret = env.VIPPS_CLIENT_SECRET;
  const subscriptionKey = env.VIPPS_SUBSCRIPTION_KEY;
  const msn = env.VIPPS_MSN || '';
  const apiUrl = env.VIPPS_API_URL || 'https://api.vipps.no';
  const redirectUri = `${url.origin}/api/vipps/callback`;

  if (!clientId || !clientSecret || !subscriptionKey) {
    throw error(500, 'Missing Vipps configuration');
  }

  // Exchange code for tokens using client_secret_basic
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const tokenHeaders: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': `Basic ${basicAuth}`,
    'Ocp-Apim-Subscription-Key': subscriptionKey,
  };
  if (msn) {
    tokenHeaders['Merchant-Serial-Number'] = msn;
  }

  const tokenResponse = await fetch(
    `${apiUrl}/access-management-1.0/access/oauth2/token`,
    {
      method: 'POST',
      headers: tokenHeaders,
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    }
  );

  if (!tokenResponse.ok) {
    const errText = await tokenResponse.text();
    console.error('Vipps token exchange failed:', tokenResponse.status, errText);
    throw error(502, 'Failed to authenticate with Vipps');
  }

  const tokens = await tokenResponse.json();

  // Get user info from Vipps (correct endpoint: /vipps-userinfo-api/userinfo)
  const userinfoHeaders: Record<string, string> = {
    Authorization: `Bearer ${tokens.access_token}`,
    'Ocp-Apim-Subscription-Key': subscriptionKey,
  };
  if (msn) {
    userinfoHeaders['Merchant-Serial-Number'] = msn;
  }

  const userInfoResponse = await fetch(
    `${apiUrl}/vipps-userinfo-api/userinfo`,
    {
      headers: userinfoHeaders,
    }
  );

  if (!userInfoResponse.ok) {
    const errText = await userInfoResponse.text();
    console.error('Vipps userinfo failed:', errText);
    throw error(502, 'Failed to get user info from Vipps');
  }

  const vippsUser = await userInfoResponse.json();
  const email = vippsUser.email || vippsUser.other_addresses?.[0]?.email;
  const name = vippsUser.name
    ? `${vippsUser.name.given_name || ''} ${vippsUser.name.family_name || ''}`.trim()
    : vippsUser.given_name
      ? `${vippsUser.given_name} ${vippsUser.family_name || ''}`.trim()
      : undefined;
  const phone = vippsUser.phone_number || vippsUser.phoneNumber;

  if (!email) {
    throw error(400, 'No email returned from Vipps. Please ensure email scope is granted.');
  }

  // Find or create user in Supabase
  const supabaseAdmin = getSupabaseAdmin();

  // Try to create user first; if they already exist, this will fail gracefully
  const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      display_name: name,
      phone,
      provider: 'vipps',
    },
  });

  if (newUser?.user) {
    // New user created - set up their profile
    await supabaseAdmin.from('profiles').upsert(
      {
        id: newUser.user.id,
        display_name: name || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
  } else if (createError && !createError.message?.includes('already been registered')) {
    console.error('Failed to create Supabase user:', createError);
    throw error(500, 'Failed to create user account');
  }

  // Generate a magic link to sign the user in
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      redirectTo: url.origin,
    },
  });

  if (linkError || !linkData) {
    console.error('Failed to generate magic link:', linkError);
    throw error(500, 'Failed to generate sign-in link');
  }

  // Redirect to the verification URL which will sign the user in
  const verifyUrl = linkData.properties?.action_link;
  if (!verifyUrl) {
    throw error(500, 'Failed to generate verification URL');
  }

  throw redirect(302, verifyUrl);
};
