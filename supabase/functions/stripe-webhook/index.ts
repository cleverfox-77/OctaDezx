import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// @ts-ignore
import Stripe from 'https://esm.sh/stripe@10.17.0'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  // @ts-ignore
  apiVersion: '2022-11-15',
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

serve(async (req) => {
  const signature = req.headers.get('Stripe-Signature')

  try {
    const body = await req.text()
    const event = await stripe.webhooks.constructEvent(
      body,
      signature!,
      Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET')!
    )

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const userId = session.client_reference_id

      // Retrieve subscription details
      const subscription = await stripe.subscriptions.retrieve(session.subscription)

      // Get the price ID to determine the plan
      const priceId = subscription.items.data[0].price.id
      const plan = priceId === Deno.env.get('STRIPE_PRICE_ID') ? 'premium' : 'free' // Default to free if price doesn't match

      // Update the user's profile
      const { error } = await supabase
        .from('profiles')
        .update({
          subscription_status: 'active',
          subscription_plan: plan,
          stripe_subscription_id: subscription.id,
          stripe_customer_id: subscription.customer,
          stripe_price_id: priceId,
        })
        .eq('user_id', userId)

      if (error) {
        console.error('Supabase update error:', error)
        return new Response(`Webhook Error: ${error.message}`, { status: 500 })
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }
})
