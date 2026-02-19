import { supabase } from './supabase';

export interface Subscription {
  id: string;
  user_id: string;
  status: 'active' | 'cancelled' | 'expired';
  plan_type: string;
  start_date: string;
  end_date: string | null;
  created_at: string;
}

const DAILY_SCAN_LIMIT = 10;

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
 * Subscribe user to the free plan
 */
export async function subscribeFree(userId: string): Promise<boolean> {
  // Calculate end date (1 month from now, clamped to valid day)
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);
  // Handle month overflow (e.g., Jan 31 → Mar 3 becomes Feb 28)
  if (endDate.getDate() !== startDate.getDate()) {
    endDate.setDate(0); // Set to last day of previous month
  }

  const { error } = await supabase
    .from('subscriptions')
    .upsert(
      {
        user_id: userId,
        status: 'active',
        plan_type: 'free_trial',
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      },
      { onConflict: 'user_id' }
    );

  if (error) {
    console.error('Error creating subscription:', error);
    return false;
  }

  return true;
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
