-- Add monthly_price column to subscriptions table
-- This is the SOURCE OF TRUTH for subscription pricing
-- Calculated as: sum(active_addons.price) + (adminSeats * 6) + (managerSeats * 4) + (employeeSeats * 2)
-- Where: adminSeats = extraAdmins + 1 (creator admin)

ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS monthly_price DECIMAL(10, 2) DEFAULT 0.00 NOT NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_monthly_price ON subscriptions(monthly_price);
