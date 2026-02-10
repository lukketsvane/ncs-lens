```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio text;

CREATE TABLE IF NOT EXISTS boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  description text,
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS board_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid REFERENCES boards ON DELETE CASCADE NOT NULL,
  scan_id uuid REFERENCES scans ON DELETE CASCADE NOT NULL,
  added_at timestamptz DEFAULT now(),
  UNIQUE(board_id, scan_id)
);

ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own boards" ON boards FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Public boards readable by all" ON boards FOR SELECT USING (is_public = true);
CREATE POLICY "Users can manage own board items" ON board_items FOR ALL USING (board_id IN (SELECT id FROM boards WHERE user_id = auth.uid()));
CREATE POLICY "Public board items readable" ON board_items FOR SELECT USING (board_id IN (SELECT id FROM boards WHERE is_public = true));
```
