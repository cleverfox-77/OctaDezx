-- Add source tracking columns to chat_sessions
ALTER TABLE public.chat_sessions
ADD COLUMN IF NOT EXISTS source TEXT,
ADD COLUMN IF NOT EXISTS utm_source TEXT,
ADD COLUMN IF NOT EXISTS utm_medium TEXT,
ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
ADD COLUMN IF NOT EXISTS referrer_url TEXT;

-- Add index for filtering by source
CREATE INDEX IF NOT EXISTS idx_chat_sessions_source ON public.chat_sessions(source);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_utm_source ON public.chat_sessions(utm_source);
