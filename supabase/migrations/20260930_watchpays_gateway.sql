-- =============================================================================
-- Migration: WatchPays Gateway Integration & Dynamic Gateway Switcher
-- Run this in: Supabase Dashboard → SQL Editor
-- =============================================================================

-- 1. Seed active gateway setting — defaults to BONDPAY (existing behavior).
--    Admin can toggle to WATCHPAYS via the Admin Panel.
INSERT INTO public.system_settings (key, value, updated_at)
VALUES ('active_gateway', '"BONDPAY"'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;

-- 2. Seed WatchPays merchant credentials (stored as JSONB strings).
--    These can be updated by the admin later via the settings API.
INSERT INTO public.system_settings (key, value, updated_at)
VALUES ('watchpays_merchant_id', '"100666115"'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.system_settings (key, value, updated_at)
VALUES ('watchpays_api_key', '"6a89c360bb08e4c38735f76683050e23"'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;

-- 3. Add a payment_gateway column to orders so we know which gateway processed each order.
--    Nullable for backwards compatibility — existing orders don't have this field.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_gateway TEXT;

-- 4. Add an index for quick lookups of orders by gateway
CREATE INDEX IF NOT EXISTS idx_orders_payment_gateway
  ON public.orders (payment_gateway);
