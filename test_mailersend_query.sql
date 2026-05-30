-- Run this query to test the email sending functionality
-- Make sure you have run 'setup_mailersend.sql' AND 'create_mailersend_function.sql' first!

-- NOTE: You MUST replace "sender@trial-range.com" with the "Verified Sender" email from your MailerSend Dashboard!
-- If you see "The from.email domain must be verified", it means you are using an email MailerSend doesn't recognize.
-- Check 'Domains' in MailerSend to find your approved sender address (e.g., MS_xxxxx@trial-xxxxx.mailersend.net).

select send_email_message('{
  "sender": "sender@trial-range.com", 
  "recipient": "recipient@example.com",
  "subject": "This is a test message from my Supabase app!",
  "html_body": "<html><body>This message was sent from <a href=\"https://postgresql.org\">PostgreSQL</a> using <a href=\"https://supabase.io\">Supabase</a> and <a href=\"https://mailersend.com\">Mailersend</a>.</body></html>"
}');

-- NOTE: Replace "sender@trial-range.com" with a verified sender from your MailerSend domain!
-- Replace "recipient@example.com" with your actual email address to verify receipt.
