-- ==============================================================================
-- 006: ADD CATEGORY COLUMN TO SPARE PARTS
-- ==============================================================================
-- Run this in Supabase SQL Editor if you wish to store category explicitly in DB
ALTER TABLE public.spare_parts ADD COLUMN IF NOT EXISTS category text;
