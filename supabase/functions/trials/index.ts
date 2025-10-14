
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (_req) => {
  try {
    // Create a Supabase client with the service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the current time in ISO format
    const now = new Date().toISOString();

    // Find profiles where the trial has ended but status is still active
    const { data: expiredProfiles, error: selectError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('subscription_status', 'active')
      .lt('trial_ends_at', now);

    if (selectError) {
      throw selectError;
    }

    if (!expiredProfiles || expiredProfiles.length === 0) {
      return new Response(JSON.stringify({ message: "No expired trials found." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Prepare the IDs of the profiles to update
    const profileIds = expiredProfiles.map(p => p.id);

    // Update the subscription_status for the expired profiles
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ subscription_status: 'inactive' })
      .in('id', profileIds);

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify({ message: `Successfully deactivated ${profileIds.length} expired trial(s).` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
})
