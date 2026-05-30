-- Create scrape_jobs table to track product scraping history
CREATE TABLE IF NOT EXISTS public.scrape_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    platform TEXT NOT NULL,
    total_found INTEGER NOT NULL DEFAULT 0,
    valid_products INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('completed', 'failed', 'pending')),
    errors JSONB DEFAULT '[]'::jsonb,
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_business_id ON public.scrape_jobs(business_id);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_scraped_at ON public.scrape_jobs(scraped_at DESC);

-- Enable RLS
ALTER TABLE public.scrape_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Business owners can view their own scrape jobs
DO $$ BEGIN
  CREATE POLICY "Business owners can view their scrape jobs"
  ON public.scrape_jobs FOR SELECT
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: Business owners can insert scrape jobs
DO $$ BEGIN
  CREATE POLICY "Business owners can create scrape jobs"
  ON public.scrape_jobs FOR INSERT
  WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add auto_scrape settings to businesses table
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS scrape_url TEXT,
ADD COLUMN IF NOT EXISTS auto_scrape_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_scraped_at TIMESTAMP WITH TIME ZONE;

-- Create index for auto-scrape queries
CREATE INDEX IF NOT EXISTS idx_businesses_auto_scrape ON public.businesses(auto_scrape_enabled, last_scraped_at);

COMMENT ON TABLE public.scrape_jobs IS 'Tracks product catalog scraping jobs and their results';
COMMENT ON COLUMN public.businesses.scrape_url IS 'URL to scrape products from';
COMMENT ON COLUMN public.businesses.auto_scrape_enabled IS 'Enable automatic daily product scraping';
COMMENT ON COLUMN public.businesses.last_scraped_at IS 'Last time products were scraped';
