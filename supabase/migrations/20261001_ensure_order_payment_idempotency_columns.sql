-- =============================================================================
-- Migration: Ensure orders table has columns for idempotent payment link persistence
-- Run this in: Supabase Dashboard → SQL Editor
-- =============================================================================

-- Ensure payment_url and gateway_order_no columns exist on public.orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_url TEXT,
  ADD COLUMN IF NOT EXISTS gateway_order_no TEXT;

-- Create an index for gateway_order_no lookups if not already created
CREATE INDEX IF NOT EXISTS idx_orders_gateway_order_no
  ON public.orders (gateway_order_no);
