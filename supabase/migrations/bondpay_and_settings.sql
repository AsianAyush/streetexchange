-- =============================================================================
-- Migration: BondPay Integration & Payment System Settings
-- Run this in: Supabase Dashboard → SQL Editor
-- =============================================================================

-- 1. Create system_settings table (JSONB key-value store for platform toggles)
-- Separate from system_configs (which stores plain-text wallet addresses).
CREATE TABLE IF NOT EXISTS public.system_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Seed the default allow_manual_payment setting (true = manual UPI enabled)
INSERT INTO public.system_settings (key, value)
VALUES ('allow_manual_payment', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 3. Add BondPay gateway columns to the orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS merchant_order_no TEXT,
  ADD COLUMN IF NOT EXISTS gateway_order_no  TEXT,
  ADD COLUMN IF NOT EXISTS payment_url       TEXT;

-- 4. Index for fast webhook callback lookups by merchant_order_no
CREATE INDEX IF NOT EXISTS idx_orders_merchant_order_no
  ON public.orders (merchant_order_no);

-- 5. Enable RLS on system_settings (read: public anon; write: service_role only)
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to SELECT (needed for checkout page to fetch the setting)
CREATE POLICY "system_settings_select_authenticated"
  ON public.system_settings
  FOR SELECT
  USING (true);

-- Only service_role (server-side) can INSERT / UPDATE / DELETE
-- (anon/authenticated users are blocked from writing via RLS;
--  our API route uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS)
CREATE POLICY "system_settings_modify_service_role"
  ON public.system_settings
  FOR ALL
  USING (auth.role() = 'service_role');
