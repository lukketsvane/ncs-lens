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
  const { data, error } = await supabase
    .from('scans')
    .select(`
      *,
      profiles:user_id (display_name)
    `)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching public scans:', error);
    return [];
  }

  // Add author name from joined profile
  return (data || []).map((scan: ScanRecord & { profiles?: { display_name: string } }) => ({
    ...scan,
    author: scan.profiles?.display_name || 'Anonymous',
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
