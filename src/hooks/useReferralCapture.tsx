import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

/**
 * Captures a referral code from localStorage and attaches it to the user's
 * profile once they're authenticated. Safe to call on every page —
 * only runs once per user (skips if profile already has a referral_code).
 *
 * Handles the case where Google OAuth users can't pass metadata at signup time.
 */
export const useReferralCapture = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    const pendingRef = localStorage.getItem("octadezx_ref");
    if (!pendingRef) return;

    const attachReferralCode = async () => {
      try {
        // Check if profile already has a referral code
        const { data: profile } = await supabase
          .from("profiles")
          .select("referral_code")
          .eq("user_id", user.id)
          .single();

        // Only set if not already set (first signup)
        if (profile && !(profile as any).referral_code) {
          const { error } = await supabase
            .from("profiles")
            .update({ referral_code: pendingRef } as any)
            .eq("user_id", user.id);

          if (!error) {
            console.log(`Referral code ${pendingRef} attached to profile`);
          }
        }

        // Clear localStorage regardless (one-shot)
        localStorage.removeItem("octadezx_ref");
      } catch (err) {
        console.error("Failed to attach referral code:", err);
      }
    };

    attachReferralCode();
  }, [user?.id]);
};
