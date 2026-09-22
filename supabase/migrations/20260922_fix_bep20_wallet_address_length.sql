-- =============================================================================
-- Migration: Fix BEP-20 Wallet Address Length (Orders Table)
-- Description:
--   The wallet_address column in public.orders was originally defined as
--   VARCHAR(34), which fits 34-character TRC-20 addresses, but causes
--   "value too long for type character varying(34)" when users submit
--   a 42-character BEP-20 (BNB Chain) address.
--
-- How to apply:
--   1. Open your Supabase Project Dashboard (https://supabase.com/dashboard)
--   2. Select your project (lviwmutjixcrxuvoiiod)
--   3. Navigate to "SQL Editor" in the left navigation sidebar
--   4. Paste the SQL query below and click "Run"
-- =============================================================================

ALTER TABLE public.orders 
  ALTER COLUMN wallet_address TYPE TEXT;
