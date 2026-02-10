import { supabase } from './supabase';

export interface Board {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface BoardItem {
  id: string;
  board_id: string;
  scan_id: string;
  added_at: string;
}

export async function getUserBoards(userId: string): Promise<Board[]> {
  const { data, error } = await supabase
    .from('boards')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching boards:', error);
    return [];
  }
  return data || [];
}

export async function createBoard(userId: string, name: string, description?: string): Promise<Board | null> {
  const { data, error } = await supabase
    .from('boards')
    .insert({ user_id: userId, name, description: description || null })
    .select()
    .single();

  if (error) {
    console.error('Error creating board:', error);
    return null;
  }
  return data;
}

export async function deleteBoard(boardId: string): Promise<boolean> {
  const { error } = await supabase
    .from('boards')
    .delete()
    .eq('id', boardId);

  if (error) {
    console.error('Error deleting board:', error);
    return false;
  }
  return true;
}

export async function updateBoard(boardId: string, updates: Partial<Pick<Board, 'name' | 'description' | 'is_public'>>): Promise<boolean> {
  const { error } = await supabase
    .from('boards')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', boardId);

  if (error) {
    console.error('Error updating board:', error);
    return false;
  }
  return true;
}

export async function addToBoard(boardId: string, scanId: string): Promise<BoardItem | null> {
  const { data, error } = await supabase
    .from('board_items')
    .insert({ board_id: boardId, scan_id: scanId })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return null; // already exists
    console.error('Error adding to board:', error);
    return null;
  }

  // Update board's updated_at
  await supabase
    .from('boards')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', boardId);

  return data;
}

export async function removeFromBoard(boardId: string, scanId: string): Promise<boolean> {
  const { error } = await supabase
    .from('board_items')
    .delete()
    .eq('board_id', boardId)
    .eq('scan_id', scanId);

  if (error) {
    console.error('Error removing from board:', error);
    return false;
  }
  return true;
}

export async function getBoardItems(boardId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('board_items')
    .select('scan_id')
    .eq('board_id', boardId)
    .order('added_at', { ascending: false });

  if (error) {
    console.error('Error fetching board items:', error);
    return [];
  }
  return (data || []).map(d => d.scan_id);
}

export async function getBoardsForScan(userId: string, scanId: string): Promise<string[]> {
  const { data: boards } = await supabase
    .from('boards')
    .select('id')
    .eq('user_id', userId);

  if (!boards || boards.length === 0) return [];

  const boardIds = boards.map(b => b.id);
  const { data: items } = await supabase
    .from('board_items')
    .select('board_id')
    .eq('scan_id', scanId)
    .in('board_id', boardIds);

  return (items || []).map(i => i.board_id);
}

export async function getPublicBoardsByUser(userId: string): Promise<Board[]> {
  const { data, error } = await supabase
    .from('boards')
    .select('*')
    .eq('user_id', userId)
    .eq('is_public', true)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching public boards:', error);
    return [];
  }
  return data || [];
}
