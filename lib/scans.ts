import { supabase } from './supabase';

export interface ScanRecord {
  id: string;
  user_id: string;
  image_url: string;
  result: {
    productType: string;
    materials: Array<{
      name: string;
      texture: string;
      finish: string;
    }>;
    colors: Array<{
      system: 'RAL' | 'NCS';
      code: string;
      name: string;
      hex: string;
      location: string;
      confidence: string;
      materialGuess: string;
      finishGuess: string;
      laymanDescription: string;
      lrv?: string;
      cmyk?: string;
      rgb?: string;
      blackness?: string;
      chromaticness?: string;
      hue?: string;
    }>;
  };
  is_public: boolean;
  created_at: string;
  updated_at: string | null;
  author?: string; // Added for display purposes
}

/**
 * Fetch user's scan history
 */
export async function getUserScans(userId: string): Promise<ScanRecord[]> {
  const { data, error } = await supabase
    .from('scans')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching scans:', error);
    return [];
  }

  return data || [];
}

/**
 * Fetch public scans for community view
 */
export async function getPublicScans(): Promise<ScanRecord[]> {
  // First fetch public scans
  const { data: scans, error: scansError } = await supabase
    .from('scans')
    .select('*')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(50);

  if (scansError) {
    console.error('Error fetching public scans:', scansError);
    return [];
  }

  if (!scans || scans.length === 0) {
    return [];
  }

  // Get unique user IDs
  const userIds = [...new Set(scans.map(s => s.user_id))];
  
  // Fetch profiles for these users
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', userIds);

  // Create a map of user_id to display_name
  const profileMap = new Map<string, string>();
  if (profiles) {
    profiles.forEach(p => profileMap.set(p.id, p.display_name || 'Anonymous'));
  }

  // Add author name from profile map
  return scans.map((scan: ScanRecord) => ({
    ...scan,
    author: profileMap.get(scan.user_id) || 'Anonymous',
  }));
}

/**
 * Create a new scan record
 */
export async function createScan(
  userId: string,
  imageUrl: string,
  result: ScanRecord['result']
): Promise<ScanRecord | null> {
  const { data, error } = await supabase
    .from('scans')
    .insert({
      user_id: userId,
      image_url: imageUrl,
      result,
      is_public: false,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating scan:', error);
    return null;
  }

  return data;
}

/**
 * Update a scan (e.g., after re-analysis or publishing)
 */
export async function updateScan(
  scanId: string,
  updates: Partial<Pick<ScanRecord, 'result' | 'is_public'>>
): Promise<ScanRecord | null> {
  const { data, error } = await supabase
    .from('scans')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', scanId)
    .select()
    .single();

  if (error) {
    console.error('Error updating scan:', error);
    return null;
  }

  return data;
}

/**
 * Delete a scan
 */
export async function deleteScan(scanId: string): Promise<boolean> {
  const { error } = await supabase
    .from('scans')
    .delete()
    .eq('id', scanId);

  if (error) {
    console.error('Error deleting scan:', error);
    return false;
  }

  return true;
}

/**
 * Publish a scan to community
 */
export async function publishScan(scanId: string): Promise<boolean> {
  const { error } = await supabase
    .from('scans')
    .update({ is_public: true, updated_at: new Date().toISOString() })
    .eq('id', scanId);

  if (error) {
    console.error('Error publishing scan:', error);
    return false;
  }

  return true;
}

/**
 * Unpublish a scan (make it private)
 */
export async function unpublishScan(scanId: string): Promise<boolean> {
  const { error } = await supabase
    .from('scans')
    .update({ is_public: false, updated_at: new Date().toISOString() })
    .eq('id', scanId);

  if (error) {
    console.error('Error unpublishing scan:', error);
    return false;
  }

  return true;
}

/**
 * Like a scan
 */
export async function likeScan(scanId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('likes')
    .insert({ scan_id: scanId, user_id: userId });

  if (error) {
    // Ignore duplicate like errors (Postgres unique constraint violation)
    if (error.code === '23505') { // UNIQUE_VIOLATION
      return true;
    }
    console.error('Error liking scan:', error);
    return false;
  }

  return true;
}

/**
 * Unlike a scan
 */
export async function unlikeScan(scanId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('likes')
    .delete()
    .eq('scan_id', scanId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error unliking scan:', error);
    return false;
  }

  return true;
}

/**
 * Get like count for a scan
 */
export async function getLikeCount(scanId: string): Promise<number> {
  const { count, error } = await supabase
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('scan_id', scanId);

  if (error) {
    console.error('Error getting like count:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Check if user has liked a scan
 */
export async function hasUserLiked(scanId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('likes')
    .select('id')
    .eq('scan_id', scanId)
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = No rows found
    console.error('Error checking like status:', error);
    return false;
  }

  return !!data;
}

/**
 * Get likes info for multiple scans (batch query for efficiency)
 */
export async function getLikesInfo(scanIds: string[], userId?: string): Promise<Map<string, { count: number; liked: boolean }>> {
  const result = new Map<string, { count: number; liked: boolean }>();
  
  if (scanIds.length === 0) return result;

  // Get all likes for the given scans
  const { data: likes, error } = await supabase
    .from('likes')
    .select('scan_id, user_id')
    .in('scan_id', scanIds);

  if (error) {
    console.error('Error getting likes info:', error);
    return result;
  }

  // Initialize results
  scanIds.forEach(id => result.set(id, { count: 0, liked: false }));

  // Count likes and check user's likes
  likes?.forEach(like => {
    const info = result.get(like.scan_id);
    if (info) {
      info.count++;
      if (userId && like.user_id === userId) {
        info.liked = true;
      }
    }
  });

  return result;
}
