-- Add session_id to orders table to link orders to their chat sessions
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.chat_sessions(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_session_id ON public.orders(session_id);
