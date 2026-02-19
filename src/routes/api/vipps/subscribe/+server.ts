import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { getSupabaseAdmin } from '$lib/server/supabase-admin';

export const POST: RequestHandler = async ({ request, url }) => {
  const { userId } = await request.json();
  if (!userId) {
    throw error(400, 'Missing userId');
  }

  const clientId = env.VIPPS_CLIENT_ID;
  const clientSecret = env.VIPPS_CLIENT_SECRET;
  const subscriptionKey = env.VIPPS_SUBSCRIPTION_KEY;
  const msn = env.VIPPS_MSN || '';
  const apiUrl = env.VIPPS_API_URL || 'https://api.vipps.no';

  if (!clientId || !clientSecret || !subscriptionKey) {
    throw error(500, 'Missing Vipps configuration');
  }

  // Get an access token for the ePayment API
  const tokenResponse = await fetch(`${apiUrl}/accesstoken/get`, {
    method: 'POST',
    headers: {
      'client_id': clientId,
      'client_secret': clientSecret,
      'Ocp-Apim-Subscription-Key': subscriptionKey,
      'Merchant-Serial-Number': msn,
    },
  });

  if (!tokenResponse.ok) {
    const errText = await tokenResponse.text();
    console.error('Vipps access token failed:', tokenResponse.status, errText);
    throw error(502, 'Failed to get Vipps access token');
  }

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;

  // Create ePayment for 10 NOK subscription
  const orderId = `sub-${crypto.randomUUID()}`;
  const returnUrl = `${url.origin}/api/vipps/subscribe/callback?orderId=${encodeURIComponent(orderId)}&userId=${encodeURIComponent(userId)}`;

  const paymentBody = {
    amount: {
      currency: 'NOK',
      value: 1000, // 10.00 NOK in øre
    },
    paymentMethod: {
      type: 'WALLET',
    },
    reference: orderId,
    returnUrl,
    userFlow: 'WEB_REDIRECT',
    paymentDescription: 'NCS Lens Pro – 10 kr/mnd',
  };

  const paymentResponse = await fetch(`${apiUrl}/epayment/v1/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'Ocp-Apim-Subscription-Key': subscriptionKey,
      'Merchant-Serial-Number': msn,
      'Idempotency-Key': orderId,
      'Vipps-System-Name': 'ncs-lens',
      'Vipps-System-Version': '1.0.0',
    },
    body: JSON.stringify(paymentBody),
  });

  if (!paymentResponse.ok) {
    const errText = await paymentResponse.text();
    console.error('Vipps create payment failed:', paymentResponse.status, errText);
    throw error(502, 'Failed to create Vipps payment');
  }

  const paymentData = await paymentResponse.json();

  // Store pending payment reference in Supabase
  const supabaseAdmin = getSupabaseAdmin();
  await supabaseAdmin.from('subscriptions').upsert(
    {
      user_id: userId,
      status: 'pending',
      plan_type: 'pro',
      vipps_order_id: orderId,
      start_date: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  return json({ redirectUrl: paymentData.redirectUrl });
};
