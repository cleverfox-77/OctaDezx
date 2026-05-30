import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const AuthRedirectHandler = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, _session) => {
            console.log("Auth Event:", event);

            if (event === 'PASSWORD_RECOVERY') {
                console.log("Password recovery event detected, redirecting to /reset-password");
                navigate('/reset-password');
            } else if (event === 'SIGNED_IN') {
                // Also check if the URL contains recovery params, even if the event is just SIGNED_IN
                // This handles cases where the event might fire before we catch PASSWORD_RECOVERY or if Supabase 
                // treats the magic link as a sign in.
                const hash = window.location.hash;
                if (hash && hash.includes('type=recovery')) {
                    console.log("Recovery hash detected on sign in, redirecting to /reset-password");
                    navigate('/reset-password');
                }
            }
        });

        // Check on mount as well, just in case
        const hash = window.location.hash;
        if (hash && hash.includes('type=recovery')) {
            console.log("Recovery hash detected on mount, redirecting to /reset-password");
            navigate('/reset-password');
        }

        return () => {
            subscription.unsubscribe();
        };
    }, [navigate]);

    return null; // This component doesn't render anything
};

export default AuthRedirectHandler;
