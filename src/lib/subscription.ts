import { supabase } from './supabase';

export interface Subscription {
  id: string;
  user_id: string;
  status: 'active' | 'cancelled' | 'expired' | 'pending';
  plan_type: string;
  start_date: string;
  end_date: string | null;
  vipps_order_id: string | null;
  created_at: string;
}

const DAILY_SCAN_LIMIT = 10;

/**
 * Subscription price in NOK (øre)
 */
export const SUBSCRIPTION_PRICE_NOK = 1000; // 10.00 NOK in øre
export const SUBSCRIPTION_PRICE_DISPLAY = '10 kr';

/**
 * Check if user has an active subscription
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('id, status, end_date')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (error || !data) return false;

  // Check if subscription hasn't expired
  if (data.end_date && new Date(data.end_date) < new Date()) {
    return false;
  }

  return true;
}

/**
 * Get the user's active subscription
 */
export async function getSubscription(userId: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * Initiate a Vipps payment for the Pro subscription (10 NOK/month)
 */
export async function initiateSubscription(userId: string): Promise<{ redirectUrl: string } | null> {
  try {
    const response = await fetch('/api/vipps/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      console.error('Failed to initiate subscription:', await response.text());
      return null;
    }

    return await response.json();
  } catch (err) {
    console.error('Error initiating subscription:', err);
    return null;
  }
}

/**
 * Cancel user's subscription
 */
export async function cancelSubscription(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('subscriptions')
    .update({ status: 'cancelled' })
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error) {
    console.error('Error cancelling subscription:', error);
    return false;
  }

  return true;
}

/**
 * Get the number of scans the user has done today
 */
export async function getDailyScanCount(userId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('scans')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', today.toISOString());

  if (error) {
    console.error('Error getting daily scan count:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Check if user can perform a scan (has subscription or under daily limit)
 */
export async function canScan(userId: string): Promise<{ allowed: boolean; remaining: number; hasSubscription: boolean }> {
  const hasSub = await hasActiveSubscription(userId);
  if (hasSub) {
    return { allowed: true, remaining: -1, hasSubscription: true };
  }

  const dailyCount = await getDailyScanCount(userId);
  const remaining = Math.max(0, DAILY_SCAN_LIMIT - dailyCount);
  return {
    allowed: remaining > 0,
    remaining,
    hasSubscription: false,
  };
}
