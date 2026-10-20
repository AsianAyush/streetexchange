-- =============================================================================
-- Migration: Remove Premature Gateway Default & Ensure NULL Initial State
-- Run this in: Supabase Dashboard → SQL Editor
-- =============================================================================

-- Ensure payment_gateway column exists and has no premature default (must start as NULL)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_gateway TEXT;

-- Drop any default that might prematurely assign a gateway upon row creation
ALTER TABLE public.orders
  ALTER COLUMN payment_gateway DROP DEFAULT;

-- Explicitly ensure default is NULL
ALTER TABLE public.orders
  ALTER COLUMN payment_gateway SET DEFAULT NULL;

COMMENT ON COLUMN public.orders.payment_gateway IS 'Payment gateway (e.g. BONDPAY or BLADEPAY), locked ONLY after payment link generation.';
