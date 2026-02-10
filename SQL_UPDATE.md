# Supabase SQL Updates

Run these commands in the Supabase SQL Editor (Dashboard > SQL Editor).

## 1. Add bio column to profiles

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio text;
```

## 2. Create boards table

```sql
CREATE TABLE IF NOT EXISTS boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  description text,
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

## 3. Create board_items table

```sql
CREATE TABLE IF NOT EXISTS board_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid REFERENCES boards ON DELETE CASCADE NOT NULL,
  scan_id uuid REFERENCES scans ON DELETE CASCADE NOT NULL,
  added_at timestamptz DEFAULT now(),
  UNIQUE(board_id, scan_id)
);
```

## 4. Enable Row Level Security

```sql
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_items ENABLE ROW LEVEL SECURITY;
```

## 5. Create RLS policies for boards

```sql
-- Users can manage their own boards
CREATE POLICY "Users can manage own boards"
  ON boards FOR ALL
  USING (auth.uid() = user_id);

-- Anyone can read public boards
CREATE POLICY "Public boards readable by all"
  ON boards FOR SELECT
  USING (is_public = true);
```

## 6. Create RLS policies for board_items

```sql
-- Users can manage items in their own boards
CREATE POLICY "Users can manage own board items"
  ON board_items FOR ALL
  USING (board_id IN (SELECT id FROM boards WHERE user_id = auth.uid()));

-- Anyone can read items from public boards
CREATE POLICY "Public board items readable"
  ON board_items FOR SELECT
  USING (board_id IN (SELECT id FROM boards WHERE is_public = true));
```
