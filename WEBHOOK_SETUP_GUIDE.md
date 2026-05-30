# Lemon Squeezy Webhook Setup Guide

To automatically unlock the app after payment, you need to deploy the webhook function and connect it to Lemon Squeezy.

## 1. Get your Webhook Secret
1.  Go to your Lemon Squeezy Dashboard -> Settings -> Webhooks.
2.  Click "+" to create a new webhook (or use an existing one).
3.  Copy the **Signing Secret**. You will need this.

## 2. Set Secrets in Supabase
You need to tell Supabase your secret. Run this command in your terminal (or set it in the Supabase Dashboard -> Settings -> Edge Functions -> Secrets):
2.  Go back to Lemon Squeezy -> Settings -> Webhooks.
3.  Paste this URL into the **Callback URL** field.
4.  Select the events you want to listen to:
    *   `order_created`
    *   `subscription_created`
    *   `subscription_updated`
    *   `subscription_cancelled`
    *   `subscription_expired`
5.  Save the webhook.

## 5. Test It
1.  Make a test purchase (or use Lemon Squeezy's "Test Webhook" button).
2.  Check your Supabase database `profiles` table. The `subscription_status` should update to `active`.
