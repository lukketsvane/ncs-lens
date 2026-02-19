-- Add vipps_order_id column to subscriptions table
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS vipps_order_id TEXT;

-- Update status check constraint to include 'pending'
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('active', 'cancelled', 'expired', 'pending'));

-- Create index for vipps_order_id lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_vipps_order_id ON subscriptions(vipps_order_id);
