-- =============================================================================
-- Migration: Strict Gateway Locking per Order
-- Run this in: Supabase Dashboard → SQL Editor
-- =============================================================================

-- 1. Ensure the payment_gateway column exists on public.orders (VARCHAR / TEXT)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_gateway TEXT;

-- 2. Create index for fast lookups by payment_gateway if not already present
CREATE INDEX IF NOT EXISTS idx_orders_payment_gateway
  ON public.orders (payment_gateway);

COMMENT ON COLUMN public.orders.payment_gateway IS 'Locked payment gateway (e.g. BONDPAY or BLADEPAY) assigned to this order once initiated.';
