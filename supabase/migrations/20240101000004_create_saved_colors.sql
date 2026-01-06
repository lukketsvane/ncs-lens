-- Create saved_colors table for bookmarking colors
CREATE TABLE IF NOT EXISTS saved_colors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  color_system TEXT NOT NULL CHECK (color_system IN ('NCS', 'RAL')),
  color_code TEXT NOT NULL,
  color_name TEXT,
  color_hex TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id, color_system, color_code)
);

-- Enable Row Level Security
ALTER TABLE saved_colors ENABLE ROW LEVEL SECURITY;

-- Users can view their own saved colors
CREATE POLICY "Users can view own saved colors" ON saved_colors
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own saved colors
CREATE POLICY "Users can insert own saved colors" ON saved_colors
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own saved colors
CREATE POLICY "Users can delete own saved colors" ON saved_colors
  FOR DELETE USING (auth.uid() = user_id);

-- Users can update their own saved colors
CREATE POLICY "Users can update own saved colors" ON saved_colors
  FOR UPDATE USING (auth.uid() = user_id);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS saved_colors_user_id_idx ON saved_colors(user_id);
CREATE INDEX IF NOT EXISTS saved_colors_code_idx ON saved_colors(color_system, color_code);
