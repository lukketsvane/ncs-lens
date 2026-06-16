-- Add bio column to profiles for richer user profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;

-- Create boards table for organizing scans into collections
CREATE TABLE IF NOT EXISTS boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create board_items table linking scans to boards
CREATE TABLE IF NOT EXISTS board_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID REFERENCES boards(id) ON DELETE CASCADE NOT NULL,
  scan_id UUID REFERENCES scans(id) ON DELETE CASCADE NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(board_id, scan_id)
);

-- Enable Row Level Security
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_items ENABLE ROW LEVEL SECURITY;

-- Boards policies
CREATE POLICY "Users can manage own boards" ON boards
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Public boards readable by all" ON boards
  FOR SELECT USING (is_public = true);

-- Board items policies
CREATE POLICY "Users can manage own board items" ON board_items
  FOR ALL USING (board_id IN (SELECT id FROM boards WHERE user_id = auth.uid()));

CREATE POLICY "Public board items readable" ON board_items
  FOR SELECT USING (board_id IN (SELECT id FROM boards WHERE is_public = true));

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_boards_user_id ON boards(user_id);
CREATE INDEX IF NOT EXISTS idx_board_items_board_id ON board_items(board_id);
CREATE INDEX IF NOT EXISTS idx_board_items_scan_id ON board_items(scan_id);
