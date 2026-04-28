ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS referral_code VARCHAR(32),
  ADD COLUMN IF NOT EXISTS referred_by_company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referred_by_code VARCHAR(32);

CREATE UNIQUE INDEX IF NOT EXISTS companies_referral_code_unique_idx
  ON companies(referral_code)
  WHERE referral_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS companies_referred_by_company_idx
  ON companies(referred_by_company_id);

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS referral_discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS referral_discount_updated_at TIMESTAMP;
