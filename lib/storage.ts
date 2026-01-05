import { supabase } from './supabase';

/**
 * Upload an image to Supabase Storage
 * @param file - File object or base64 data URL string
 * @param userId - The user's ID for organizing files
 * @returns The public URL of the uploaded image
 */
export async function uploadImage(
  file: File | string,
  userId: string
): Promise<string> {
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
  
  let fileData: Blob;
  
  if (typeof file === 'string') {
    // Convert base64 data URL to blob
    const base64Data = file.split(',')[1];
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    fileData = new Blob([byteArray], { type: 'image/jpeg' });
  } else {
    fileData = file;
  }

  const { data, error } = await supabase.storage
    .from('scans')
    .upload(fileName, fileData, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('scans')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

/**
 * Delete an image from Supabase Storage
 * @param imageUrl - The public URL of the image to delete
 * @param userId - The user's ID
 */
export async function deleteImage(imageUrl: string, userId: string): Promise<void> {
  // Extract the path from the URL
  const url = new URL(imageUrl);
  const pathParts = url.pathname.split('/storage/v1/object/public/scans/');
  if (pathParts.length !== 2) {
    console.warn('Could not parse image path from URL');
    return;
  }
  
  const filePath = pathParts[1];
  
  // Verify the file belongs to the user
  if (!filePath.startsWith(userId + '/')) {
    throw new Error('Not authorized to delete this image');
  }

  const { error } = await supabase.storage
    .from('scans')
    .remove([filePath]);

  if (error) {
    throw new Error(`Failed to delete image: ${error.message}`);
  }
}
