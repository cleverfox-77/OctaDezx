import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SEO } from "@/components/SEO";
import { LogoIcon } from "@/components/ui/Logo";
import { Loader2 } from "lucide-react";

const AuthPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState("");
  const [dialogDescription, setDialogDescription] = useState("");
  const [referralCode, setReferralCode] = useState<string | null>(null);

  // Capture referral code from URL or localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlRef = params.get("ref");
    if (urlRef) {
      const normalized = urlRef.toUpperCase().trim();
      localStorage.setItem("octadezx_ref", normalized);
      setReferralCode(normalized);
    } else {
      const stored = localStorage.getItem("octadezx_ref");
      if (stored) setReferralCode(stored);
    }
  }, []);

  // Continue the email the visitor typed into the landing-page CTA
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const email = params.get("email") || localStorage.getItem("octadezx_signup_email");
    if (email) {
      setSignUpEmail(email);
      setSignInEmail(email);
    }
  }, []);

  const showDialog = (title: string, description: string) => {
    setDialogTitle(title);
    setDialogDescription(description);
    setDialogOpen(true);
  };

  const handleGoogleLogin = async () => {
    try {
      // Ensure referral code is preserved across OAuth redirect via localStorage
      // (captureReferralOnAuth hook will pick it up after auth completes)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      showDialog("Error", error.message || "Failed to sign in with Google");
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: signInEmail,
        password: signInPassword,
      });

      if (error) {
        throw error;
      }

      showDialog("Success!", "You have successfully signed in.");
      // If we arrived here from the MCP OAuth consent screen, go back to it.
      const ret = sessionStorage.getItem("octadezx_oauth_return");
      if (ret) {
        sessionStorage.removeItem("octadezx_oauth_return");
        navigate(ret);
      } else {
        navigate("/dashboard");
      }
    } catch (error: any) {
      showDialog("Error", error.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (signUpPassword !== signUpConfirmPassword) {
      showDialog("Error", "Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email: signUpEmail,
        password: signUpPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: referralCode ? { referral_code: referralCode } : undefined,
        },
      });

      if (error) {
        throw error;
      }

      showDialog("Success!", "Check your email for the confirmation link.");
      // Clear form
      setSignUpEmail("");
      setSignUpPassword("");
      setSignUpConfirmPassword("");
    } catch (error: any) {
      showDialog("Error", error.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!signInEmail) {
      showDialog("Error", "Please enter your email address to reset your password.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(signInEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        throw error;
      }
      showDialog("Success!", "Check your email for the password reset link.");
    } catch (error: any) {
      showDialog("Error", error.message || "Failed to send password reset email");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex bg-background">
      <SEO
        title="Sign up for OctaDezx"
        description="Access your OctaDezx dashboard. Manage your AI agents, view analytics, and create new business profiles."
        canonical="https://octadezx.com/auth"
      />

      {/* ── Brand panel (desktop) ── */}
      <div className="hidden lg:flex w-[44%] flex-col justify-between p-12 relative overflow-hidden text-white"
        style={{ background: "linear-gradient(160deg, #000047 0%, #1e1b5e 55%, #312e81 100%)" }}>
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)", backgroundSize: "56px 56px" }} />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(79,70,229,0.35), transparent 65%)", filter: "blur(40px)" }} />

        <a href="/" className="relative flex items-center gap-3 w-fit">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-md flex-shrink-0">
            <LogoIcon size="md" />
          </div>
          <span className="text-[15px] font-bold tracking-[0.07em] uppercase">OctaDezx</span>
        </a>

        <div className="relative space-y-8 max-w-md">
          <h2 className="text-4xl font-black leading-tight tracking-tight">
            Every customer answered.<br />Every order captured.
          </h2>
          <ul className="space-y-4">
            {[
              "Live in under 10 minutes, no developers needed",
              "AI answers in 50+ languages, 24/7",
              "Orders verified server-side before they're confirmed",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3 text-sm text-white/85">
                <svg className="w-5 h-5 flex-shrink-0 mt-[1px]" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {t}
              </li>
            ))}
          </ul>
          <figure className="border-l-2 border-white/25 pl-4">
            <blockquote className="text-sm text-white/75 leading-relaxed italic">
              “Our response time went from hours to seconds and our online sales have
              grown without us adding a single new hire.”
            </blockquote>
            <figcaption className="text-xs text-white/50 mt-2 font-semibold">Thomas Pini, CEO, Pini Parma</figcaption>
          </figure>
        </div>

        <p className="relative text-xs text-white/40">Secure &amp; GDPR compliant · © {new Date().getFullYear()} OctaDezx</p>
      </div>

      {/* ── Form panel ── */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md mx-auto space-y-6 animate-fade-in-up" style={{ animationDuration: "0.5s" }}>
        <div className="flex justify-center lg:hidden">
          <LogoIcon size="xl" />
        </div>
        <Card className="w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl sm:text-3xl">Welcome</CardTitle>
            <CardDescription>Sign in or create an account to continue</CardDescription>
            {referralCode && (
              <div className="mt-2 text-xs text-green-600 dark:text-green-400 font-medium">
                Referral code <span className="font-mono bg-green-500/10 px-2 py-0.5 rounded">{referralCode}</span> applied, 10% discount on your subscription
              </div>
            )}
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-signin">Email</Label>
                    <Input
                      id="email-signin"
                      type="email"
                      value={signInEmail}
                      onChange={(e) => setSignInEmail(e.target.value)}
                      required
                      placeholder="Enter your email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password-signin">Password</Label>
                    <Input
                      id="password-signin"
                      type="password"
                      value={signInPassword}
                      onChange={(e) => setSignInPassword(e.target.value)}
                      required
                      placeholder="Enter your password"
                    />
                  </div>
                  <Button type="submit" className="w-full press" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {loading ? "Signing in…" : "Sign In"}
                  </Button>
                  <div className="text-center text-sm">
                    <Button variant="link" onClick={handlePasswordReset} disabled={loading}>
                      Forgot Password?
                    </Button>
                  </div>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-signup">Email</Label>
                    <Input
                      id="email-signup"
                      type="email"
                      value={signUpEmail}
                      onChange={(e) => setSignUpEmail(e.target.value)}
                      required
                      placeholder="Enter your email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password-signup">Password</Label>
                    <Input
                      id="password-signup"
                      type="password"
                      value={signUpPassword}
                      onChange={(e) => setSignUpPassword(e.target.value)}
                      required
                      placeholder="Enter your password"
                      minLength={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password-signup">Confirm Password</Label>
                    <Input
                      id="confirm-password-signup"
                      type="password"
                      value={signUpConfirmPassword}
                      onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                      required
                      placeholder="Confirm your password"
                      minLength={6}
                    />
                  </div>
                  <Button type="submit" className="w-full press" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {loading ? "Creating account…" : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="w-full">
          <CardContent className="pt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>
            <Button variant="outline" type="button" className="w-full mt-4 press" onClick={handleGoogleLogin}>
              <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
              </svg>
              Google
            </Button>
          </CardContent>
        </Card>
      </div>
      </div>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent className="w-11/12 sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {dialogDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setDialogOpen(false)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AuthPage;
