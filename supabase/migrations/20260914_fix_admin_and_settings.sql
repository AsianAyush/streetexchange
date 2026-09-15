-- =============================================================================
-- Migration: Fix Admin Authorization & System Settings (Manual Payment Toggle)
-- Run this in: Supabase Dashboard → SQL Editor
-- =============================================================================

-- 1. Ensure profile columns exist for admin role checking
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- 2. Ensure system_settings table exists and is seeded
CREATE TABLE IF NOT EXISTS public.system_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access to system settings
DROP POLICY IF EXISTS "Allow public read system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_select_authenticated" ON public.system_settings;

CREATE POLICY "Allow public read system_settings" 
  ON public.system_settings FOR SELECT USING (true);

-- Seed allow_manual_payment toggle (default: true)
INSERT INTO public.system_settings (key, value)
VALUES ('allow_manual_payment', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 3. Ensure orders table has BondPay gateway columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS merchant_order_no TEXT,
  ADD COLUMN IF NOT EXISTS gateway_order_no  TEXT,
  ADD COLUMN IF NOT EXISTS payment_url       TEXT;

-- Index for fast webhook callback lookups by merchant_order_no
CREATE INDEX IF NOT EXISTS idx_orders_merchant_order_no
  ON public.orders (merchant_order_no);
