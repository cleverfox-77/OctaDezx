import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'expired' | 'cancelled' | null;
export type PlanType = 'free' | 'trial' | 'starter' | 'pro' | 'enterprise' | 'appsumo_ltd';

export const useSubscription = () => {
    const { user } = useAuth();
    const [status, setStatus] = useState<SubscriptionStatus>(null);
    const [planType, setPlanType] = useState<PlanType>('free');
    const [trialEndsAt, setTrialEndsAt] = useState<Date | null>(null);
    const [loading, setLoading] = useState(true);
    const [isTrialExpired, setIsTrialExpired] = useState(false);
    const [error, setError] = useState<any>(null);

    useEffect(() => {
        const fetchSubscriptionStatus = async () => {
            if (!user) {
                setLoading(false);
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('subscription_status, trial_start_timestamp, plan_type')
                    .eq('user_id', user.id)
                    .single();


                if (error) {
                    // PGRST116 means no row found. Auto-create profile if missing.
                    if (error.code === 'PGRST116') {
                        console.log("Profile missing, creating new profile for user...");
                        // Use user.created_at as trial start so the clock starts at signup,
                        // not at first page visit (prevents re-starting the clock).
                        const trialStart = user.created_at ?? new Date().toISOString();
                        const { error: insertError } = await supabase
                            .from('profiles')
                            .insert([{
                                user_id: user.id,
                                subscription_status: 'trial',
                                plan_type: 'trial',
                                trial_start_timestamp: trialStart
                            }]);


                        if (insertError) {
                            console.error('Error creating profile:', insertError);
                            setError(insertError);
                            setLoading(false);
                            return;
                        }

                        // Set default trial state
                        setStatus('trial');
                        setPlanType('trial');
                        const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
                        setTrialEndsAt(endDate);
                        setIsTrialExpired(false);
                        setLoading(false);
                        return;
                    }

                    console.error('Error fetching subscription:', error);
                    setError(error);
                    setLoading(false);
                    return;
                }


                if (data) {
                    // Check if profile exists but has no trial data
                    if (!data.subscription_status || !data.trial_start_timestamp) {
                        console.log("Profile exists but missing trial data, initializing...");
                        // Prefer user.created_at so the trial clock starts at actual signup time
                        const trialStart = user.created_at ?? new Date().toISOString();
                        const { error: updateError } = await supabase
                            .from('profiles')
                            .update({
                                subscription_status: 'trial',
                                plan_type: 'trial',
                                trial_start_timestamp: trialStart
                            })
                            .eq('user_id', user.id);

                        if (updateError) {
                            console.error('Error initializing trial:', updateError);
                        } else {
                            setStatus('trial');
                            setPlanType('trial');
                            const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
                            setTrialEndsAt(endDate);
                            setIsTrialExpired(false);
                            setLoading(false);
                            return;
                        }
                    }

                    setStatus(data.subscription_status as SubscriptionStatus);
                    setPlanType((data as any).plan_type as PlanType || 'free');

                    if (data.trial_start_timestamp) {
                        const startDate = new Date(data.trial_start_timestamp);
                        const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
                        setTrialEndsAt(endDate);

                        const now = new Date();

                        // Expired = past 24h AND not on a paid plan
                        const isPaid = data.subscription_status === 'active' || data.subscription_status === 'past_due';
                        if (now > endDate && !isPaid) {
                            setIsTrialExpired(true);
                        } else {
                            setIsTrialExpired(false);
                        }
                    }
                }
            } catch (err) {
                console.error('Unexpected error in useSubscription:', err);
                setError(err);
            } finally {
                setLoading(false);
            }
        };

        fetchSubscriptionStatus();
    }, [user]);

    return {
        status,
        planType,
        trialEndsAt,
        loading,
        isTrialExpired,
        error,
        checkAccess: () => {
            if (loading) return false;
            if (error) return false;                              // fail closed on fetch error
            if (status === 'active' || status === 'past_due') return true;  // paid, always allow
            if (status === 'cancelled' || status === 'expired') return false; // explicitly terminated
            if (isTrialExpired) return false;                     // trial ran out
            return true;                                          // active trial
        },
    };
};
