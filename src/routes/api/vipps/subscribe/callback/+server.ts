import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { getSupabaseAdmin } from '$lib/server/supabase-admin';

export const GET: RequestHandler = async ({ url }) => {
  const orderId = url.searchParams.get('orderId');
  const userId = url.searchParams.get('userId');

  if (!orderId || !userId) {
    throw error(400, 'Missing orderId or userId');
  }

  const clientId = env.VIPPS_CLIENT_ID;
  const clientSecret = env.VIPPS_CLIENT_SECRET;
  const subscriptionKey = env.VIPPS_SUBSCRIPTION_KEY;
  const msn = env.VIPPS_MSN || '';
  const apiUrl = env.VIPPS_API_URL || 'https://api.vipps.no';

  // Get an access token
  const tokenResponse = await fetch(`${apiUrl}/accesstoken/get`, {
    method: 'POST',
    headers: {
      'client_id': clientId || '',
      'client_secret': clientSecret || '',
      'Ocp-Apim-Subscription-Key': subscriptionKey || '',
      'Merchant-Serial-Number': msn,
    },
  });

  if (!tokenResponse.ok) {
    console.error('Vipps access token failed:', await tokenResponse.text());
    throw redirect(302, '/?subscription=error');
  }

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;

  // Check payment status
  const paymentResponse = await fetch(
    `${apiUrl}/epayment/v1/payments/${encodeURIComponent(orderId)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Ocp-Apim-Subscription-Key': subscriptionKey || '',
        'Merchant-Serial-Number': msn,
      },
    }
  );

  if (!paymentResponse.ok) {
    console.error('Vipps payment status check failed:', await paymentResponse.text());
    throw redirect(302, '/?subscription=error');
  }

  const paymentData = await paymentResponse.json();
  const supabaseAdmin = getSupabaseAdmin();

  if (paymentData.state === 'AUTHORIZED' || paymentData.state === 'CHARGED') {
    // Payment successful - activate subscription
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);
    // Handle month overflow (e.g., Jan 31 + 1 month → Mar 3, adjust to Feb 28)
    if (endDate.getDate() !== startDate.getDate()) {
      endDate.setDate(0); // Set to last day of previous month
    }

    await supabaseAdmin.from('subscriptions').upsert(
      {
        user_id: userId,
        status: 'active',
        plan_type: 'pro',
        vipps_order_id: orderId,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      },
      { onConflict: 'user_id' }
    );

    // Capture the payment if it's authorized but not yet charged
    if (paymentData.state === 'AUTHORIZED') {
      const captureResponse = await fetch(
        `${apiUrl}/epayment/v1/payments/${encodeURIComponent(orderId)}/capture`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            'Ocp-Apim-Subscription-Key': subscriptionKey || '',
            'Merchant-Serial-Number': msn,
          },
          body: JSON.stringify({
            modificationAmount: {
              currency: 'NOK',
              value: 1000,
            },
          }),
        }
      );
      if (!captureResponse.ok) {
        console.error('Vipps payment capture failed:', await captureResponse.text());
      }
    }

    throw redirect(302, '/?subscription=success');
  } else {
    // Payment failed or was cancelled
    await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('user_id', userId)
      .eq('vipps_order_id', orderId);

    throw redirect(302, '/?subscription=cancelled');
  }
};
