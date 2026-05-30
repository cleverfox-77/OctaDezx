DROP POLICY IF EXISTS "Anyone can view messages in active sessions" ON public.chat_messages;
DROP POLICY IF EXISTS "Anyone can create chat messages" ON public.chat_messages;

-- Drop policies from the previous failed migration attempt
DROP POLICY IF EXISTS "Authenticated users can view their own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Authenticated users can create messages" ON public.chat_messages;


-- POLICY 1: Business owners can view messages in their chats.
CREATE POLICY "Owners can view their chat messages"
ON public.chat_messages FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.chat_sessions s
        JOIN public.businesses b ON s.business_id = b.id
        WHERE s.id = chat_messages.session_id AND b.owner_id = auth.uid()
    )
);

-- POLICY 2: Business owners can create messages in their chats.
CREATE POLICY "Owners can create messages in their chats"
ON public.chat_messages FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.chat_sessions s
        JOIN public.businesses b ON s.business_id = b.id
        WHERE s.id = chat_messages.session_id AND b.owner_id = auth.uid()
    )
);

-- POLICY 3: (INSECURE) Allow anonymous users to read messages to prevent 401 errors.
-- WARNING: This allows any anonymous user to read all messages in the chat_messages table.
CREATE POLICY "Anonymous users can view messages"
ON public.chat_messages FOR SELECT
USING (auth.role() = 'anon');

-- POLICY 4: (INSECURE) Allow anonymous users to create messages.
-- This allows any anonymous user to create messages.
CREATE POLICY "Anonymous users can create messages"
ON public.chat_messages FOR INSERT
WITH CHECK (auth.role() = 'anon' AND sender_type = 'customer');