import { supabase } from './supabase';

export interface SavedColor {
  id: string;
  user_id: string;
  color_system: 'NCS' | 'RAL';
  color_code: string;
  color_name: string | null;
  color_hex: string;
  notes: string | null;
  created_at: string;
}

/**
 * Get user's saved colors
 */
export async function getSavedColors(userId: string): Promise<SavedColor[]> {
  const { data, error } = await supabase
    .from('saved_colors')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching saved colors:', error);
    return [];
  }

  return data || [];
}

/**
 * Save a color to user's collection
 */
export async function saveColor(
  userId: string,
  color: {
    system: 'NCS' | 'RAL';
    code: string;
    name?: string;
    hex: string;
  }
): Promise<SavedColor | null> {
  const { data, error } = await supabase
    .from('saved_colors')
    .insert({
      user_id: userId,
      color_system: color.system,
      color_code: color.code,
      color_name: color.name || null,
      color_hex: color.hex,
    })
    .select()
    .single();

  if (error) {
    // Handle duplicate (already saved)
    if (error.code === '23505') {
      console.log('Color already saved');
      return null;
    }
    console.error('Error saving color:', error);
    return null;
  }

  return data;
}

/**
 * Remove a saved color
 */
export async function unsaveColor(userId: string, colorSystem: 'NCS' | 'RAL', colorCode: string): Promise<boolean> {
  const { error } = await supabase
    .from('saved_colors')
    .delete()
    .eq('user_id', userId)
    .eq('color_system', colorSystem)
    .eq('color_code', colorCode);

  if (error) {
    console.error('Error removing saved color:', error);
    return false;
  }

  return true;
}

/**
 * Check if a color is saved
 */
export async function isColorSaved(userId: string, colorSystem: 'NCS' | 'RAL', colorCode: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('saved_colors')
    .select('id')
    .eq('user_id', userId)
    .eq('color_system', colorSystem)
    .eq('color_code', colorCode)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error checking saved color:', error);
    return false;
  }

  return !!data;
}

/**
 * Get saved status for multiple colors (batch query)
 */
export async function getSavedColorStatus(
  userId: string,
  colors: Array<{ system: string; code: string }>
): Promise<Set<string>> {
  if (colors.length === 0) return new Set();

  const { data, error } = await supabase
    .from('saved_colors')
    .select('color_system, color_code')
    .eq('user_id', userId);

  if (error) {
    console.error('Error getting saved color status:', error);
    return new Set();
  }

  // Create a set of saved color keys
  return new Set(data?.map(c => `${c.color_system}:${c.color_code}`) || []);
}
