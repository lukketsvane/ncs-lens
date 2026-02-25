import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { getSupabaseAdmin } from '$lib/server/supabase-admin';

export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');
  const storedState = cookies.get('vipps_state');

  // Handle Vipps error responses (user cancelled, etc.)
  if (errorParam) {
    const errorDesc = url.searchParams.get('error_description') || 'Login cancelled';
    console.error('Vipps login error:', errorParam, errorDesc);
    throw redirect(302, `/?vipps_error=${encodeURIComponent(errorDesc)}`);
  }

  // Validate state for CSRF protection
  if (!state || !storedState || state !== storedState) {
    console.error('Vipps state mismatch:', { state, storedState });
    throw redirect(302, '/?vipps_error=invalid_state');
  }
  cookies.delete('vipps_state', { path: '/' });

  if (!code) {
    throw redirect(302, '/?vipps_error=missing_code');
  }

  const clientId = env.VIPPS_CLIENT_ID;
  const clientSecret = env.VIPPS_CLIENT_SECRET;
  const subscriptionKey = env.VIPPS_SUBSCRIPTION_KEY;
  const msn = env.VIPPS_MSN || '';
  const apiUrl = env.VIPPS_API_URL || 'https://api.vipps.no';
  const redirectUri = `${url.origin}/api/vipps/callback`;

  if (!clientId || !clientSecret || !subscriptionKey) {
    console.error('Missing Vipps env vars:', { clientId: !!clientId, clientSecret: !!clientSecret, subscriptionKey: !!subscriptionKey });
    throw redirect(302, '/?vipps_error=server_config');
  }

  // Step 1: Exchange authorization code for tokens (client_secret_basic)
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
    throw redirect(302, '/?vipps_error=token_exchange');
  }

  const tokens = await tokenResponse.json();

  // Step 2: Fetch user info from Vipps
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
    console.error('Vipps userinfo failed:', userInfoResponse.status, errText);
    throw redirect(302, '/?vipps_error=userinfo');
  }

  const vippsUser = await userInfoResponse.json();

  // Extract user details from Vipps response
  const email = vippsUser.email || vippsUser.other_addresses?.[0]?.email;
  const name = vippsUser.name
    ? `${vippsUser.name.given_name || ''} ${vippsUser.name.family_name || ''}`.trim()
    : vippsUser.given_name
      ? `${vippsUser.given_name} ${vippsUser.family_name || ''}`.trim()
      : undefined;
  const phone = vippsUser.phone_number || vippsUser.phoneNumber;
  const vippsSub = vippsUser.sub; // Unique Vipps user ID per merchant

  if (!email) {
    console.error('No email in Vipps response:', JSON.stringify(vippsUser));
    throw redirect(302, '/?vipps_error=no_email');
  }

  // Step 3: Create or find user in Supabase
  const supabaseAdmin = getSupabaseAdmin();

  // Try to find existing user by email first
  const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  let userId: string;

  if (existingUser) {
    userId = existingUser.id;
    // Update user metadata with latest Vipps info
    await supabaseAdmin.auth.admin.updateUser(userId, {
      user_metadata: {
        ...existingUser.user_metadata,
        vipps_sub: vippsSub,
        phone: phone || existingUser.user_metadata?.phone,
        provider: existingUser.user_metadata?.provider || 'vipps',
      },
    });
  } else {
    // Create new user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        display_name: name,
        phone,
        vipps_sub: vippsSub,
        provider: 'vipps',
      },
    });

    if (createError || !newUser?.user) {
      console.error('Failed to create Supabase user:', createError);
      throw redirect(302, '/?vipps_error=create_user');
    }

    userId = newUser.user.id;

    // Create profile for new user
    await supabaseAdmin.from('profiles').upsert(
      {
        id: userId,
        display_name: name || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
  }

  // Step 4: Generate magic link and extract token_hash for client-side session
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      redirectTo: url.origin,
    },
  });

  if (linkError || !linkData) {
    console.error('Failed to generate magic link:', linkError);
    throw redirect(302, '/?vipps_error=auth_link');
  }

  // Extract token_hash for client-side OTP verification (avoids PKCE issues)
  const tokenHash = linkData.properties?.hashed_token;
  if (tokenHash) {
    const appUrl = new URL('/', url.origin);
    appUrl.searchParams.set('token_hash', tokenHash);
    appUrl.searchParams.set('type', 'magiclink');
    throw redirect(302, appUrl.toString());
  }

  // Fallback: redirect to the action_link directly
  const verifyUrl = linkData.properties?.action_link;
  if (!verifyUrl) {
    console.error('No token_hash or action_link in generateLink response');
    throw redirect(302, '/?vipps_error=auth_token');
  }

  throw redirect(302, verifyUrl);
};
