import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

// AuthRedirectHandler (always mounted in AppRoutes) already handles PASSWORD_RECOVERY
// and SIGNED_IN events globally. This component only needs to handle the initial
// page load for the /auth/callback route — using getSession() avoids registering
// a duplicate onAuthStateChange listener.
const AuthCallback = () => {
    const navigate = useNavigate();

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) return; // session not ready yet — onAuthStateChange will fire
            const hash = window.location.hash;
            const search = window.location.search;
            if (hash.includes('type=recovery') || search.includes('type=recovery')) {
                navigate('/reset-password');
            } else {
                navigate('/dashboard');
            }
        });
    }, [navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-lg">Completing authentication... Please wait.</div>
        </div>
    );
};

export default AuthCallback;
