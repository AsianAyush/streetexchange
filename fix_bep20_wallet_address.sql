-- =============================================================================
-- Migration: Fix BEP-20 Wallet Address Length (Orders Table)
-- =============================================================================
-- Problem:
--   The 'wallet_address' column on the 'orders' table was created as VARCHAR(34).
--   TRC-20 addresses are 34 characters (e.g. T...), but BEP-20 addresses are
--   42 characters (e.g. 0x...). When a user submits a BEP-20 address, PostgreSQL
--   throws error: "value too long for type character varying(34)".
--
-- Solution:
--   Run this SQL in your Supabase Dashboard:
--   1. Go to https://supabase.com/dashboard/project/lviwmutjixcrxuvoiiod
--   2. Click "SQL Editor" on the left menu
--   3. Paste and run the statement below:
-- =============================================================================

ALTER TABLE public.orders 
  ALTER COLUMN wallet_address TYPE TEXT;
