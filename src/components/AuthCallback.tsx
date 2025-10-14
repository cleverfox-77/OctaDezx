import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<'loading' | 'password_recovery' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        if (session) {
          setView('password_recovery');
        } else {
          setErrorMsg('Invalid or expired password recovery link.');
          setView('error');
        }
      } else if (event === 'SIGNED_IN') {
        navigate('/dashboard');
      }
    });

    // Handle initial load for non-event-driven redirects
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // If there's a session and it's not a password recovery, go to dashboard
        const hash = window.location.hash;
        if (!hash.includes('type=recovery')) {
           navigate('/dashboard');
        }
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [navigate]);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    setErrorMsg('');

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setErrorMsg(error.message || "Failed to update password.");
    } else {
      // Password updated successfully. Redirect to dashboard.
      // The session from PASSWORD_RECOVERY event allows this.
      navigate('/dashboard');
    }
    setLoading(false);
  };

  if (view === 'password_recovery') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 sm:p-6">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl sm:text-3xl">Reset Your Password</CardTitle>
            <CardDescription>Enter a new password for your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Enter your new password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Confirm your new password"
                />
              </div>
              {errorMsg && <p className="text-red-500 text-sm">{errorMsg}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (view === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-red-500">{errorMsg || 'An unexpected error occurred.'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-lg">Completing authentication... Please wait.</div>
    </div>
  );
};

export default AuthCallback;
