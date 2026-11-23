-- ==============================================================================
-- BEGIN WAITLIST DATABASE SCHEMA FOR SUPABASE
-- Run this in your Supabase Project -> SQL Editor -> Click "Run"
-- ==============================================================================

-- 1. Create the waitlist table
CREATE TABLE IF NOT EXISTS public.waitlist (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    city TEXT NOT NULL,
    profile TEXT NOT NULL,
    phone TEXT,
    linkedin TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. If the table already existed with NOT NULL on phone, make phone optional:
ALTER TABLE public.waitlist ALTER COLUMN phone DROP NOT NULL;

-- 3. If the table already existed without linkedin, add the column seamlessly:
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS linkedin TEXT;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- 5. Policy: Allow public anonymous submissions to insert
DROP POLICY IF EXISTS "Allow public inserts" ON public.waitlist;
CREATE POLICY "Allow public inserts" ON public.waitlist
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- 6. Policy: Allow service_role full administrative access
DROP POLICY IF EXISTS "Allow service_role full access" ON public.waitlist;
CREATE POLICY "Allow service_role full access" ON public.waitlist
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 7. Indexes for quick searches and sorting
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON public.waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON public.waitlist(created_at DESC);
