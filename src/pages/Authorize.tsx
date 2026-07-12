import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, ShieldCheck, Loader2, CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";

// Where to return after /auth login — read by Auth.tsx + AuthCallback.
// (Keep this literal in sync across those files.)
const RETURN_KEY = "octadezx_oauth_return";

interface Business {
  id: string;
  name: string;
  business_type?: string | null;
}

// What Claude will be able to do — mirrors McpConnect's tool groups, condensed.
const CAPABILITIES = [
  "Read and reply to your customer conversations",
  "See and resolve chats escalated to a human",
  "Set up your business profile and train the AI",
  "Add, edit and remove knowledge & catalog items",
  "Review orders and analyse conversations for insights",
];

const Spinner = ({ label }: { label: string }) => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="h-7 w-7 text-primary animate-spin" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  </div>
);

const Authorize = () => {
  const { user, session, loading } = useAuth();
  const navigate = useNavigate();

  // OAuth request params (parsed once).
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const clientId = params.get("client_id") || "";
  const redirectUri = params.get("redirect_uri") || "";
  const codeChallenge = params.get("code_challenge") || "";
  const codeChallengeMethod = params.get("code_challenge_method") || "S256";
  const state = params.get("state") || "";
  const scope = params.get("scope") || "octadezx";
  const resource = params.get("resource") || "";

  const [businesses, setBusinesses] = useState<Business[] | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Not signed in → remember this exact URL, bounce to /auth, come back after.
  useEffect(() => {
    if (loading || user) return;
    sessionStorage.setItem(RETURN_KEY, window.location.pathname + window.location.search);
    navigate("/auth", { replace: true });
  }, [loading, user, navigate]);

  // Load the businesses this user owns (the token is scoped to one of them).
  useEffect(() => {
    if (!user) return;
    let active = true;
    supabase
      .from("businesses")
      .select("id,name,business_type")
      .eq("owner_id", user.id)
      .then(({ data }) => {
        if (!active) return;
        const list = (data as Business[]) ?? [];
        setBusinesses(list);
        if (list[0]) setSelected(list[0].id);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const paramsValid = Boolean(clientId && redirectUri && codeChallenge);

  const deny = () => {
    if (!redirectUri) {
      navigate("/dashboard");
      return;
    }
    const u = new URL(redirectUri);
    u.searchParams.set("error", "access_denied");
    if (state) u.searchParams.set("state", state);
    window.location.href = u.toString();
  };

  const approve = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const resp = await fetch("/api/oauth/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: session?.access_token,
          client_id: clientId,
          redirect_uri: redirectUri,
          code_challenge: codeChallenge,
          code_challenge_method: codeChallengeMethod,
          state,
          scope,
          resource,
          business_id: selected,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.redirect_to) {
        throw new Error(data.error_description || data.error || "Authorization failed");
      }
      window.location.href = data.redirect_to;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authorization failed. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading || !user) return <Spinner label="Loading…" />;
  if (businesses === null) return <Spinner label="Loading your businesses…" />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 sm:p-6">
      <div className="w-full max-w-md mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-xl">Connect Claude to OctaDezx</CardTitle>
            <CardDescription>
              <strong>Claude</strong> wants to manage your customer care. Approving lets it act on the
              business you choose below.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {!paramsValid ? (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                <p>This authorization link is missing required information. Start the connection again from Claude.</p>
              </div>
            ) : businesses.length === 0 ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <p>You don't have a business yet. Create one first, then connect Claude.</p>
                </div>
                <Button className="w-full" onClick={() => navigate("/dashboard")}>
                  Go to dashboard
                </Button>
              </div>
            ) : (
              <>
                {/* Business picker (defaults to first; only shown as a list if >1) */}
                {businesses.length > 1 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Connect this business
                    </p>
                    <div className="space-y-2">
                      {businesses.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setSelected(b.id)}
                          className={`w-full text-left rounded-lg border p-3 transition-colors ${
                            selected === b.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{b.name}</span>
                            {selected === b.id && <CheckCircle2 className="h-4 w-4 text-primary" />}
                          </div>
                          {b.business_type && (
                            <span className="text-xs text-muted-foreground capitalize">{b.business_type}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {businesses.length === 1 && (
                  <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                    <span className="text-muted-foreground">Business: </span>
                    <span className="font-medium">{businesses[0].name}</span>
                  </div>
                )}

                {/* What Claude can do */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Claude will be able to
                  </p>
                  <ul className="space-y-1.5">
                    {CAPABILITIES.map((c) => (
                      <li key={c} className="flex items-start gap-2 text-sm">
                        <Sparkles className="h-3.5 w-3.5 text-primary mt-1 flex-shrink-0" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    <p>{error}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <Button variant="outline" className="flex-1" onClick={deny} disabled={submitting}>
                    Deny
                  </Button>
                  <Button className="flex-1" onClick={approve} disabled={submitting || !selected}>
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Authorize
                  </Button>
                </div>

                <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Signed in as {user.email}. Revoke anytime from your dashboard.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Authorize;
