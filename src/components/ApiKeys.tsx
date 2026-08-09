import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { KeyRound, Plus, Copy, Trash2, Loader2, AlertTriangle, Code2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

interface ApiKeysProps {
  businessId: string;
}

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL ?? ""}/functions/v1/api-v1`;

const ApiKeys = ({ businessId }: ApiKeysProps) => {
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  // The freshly minted key, shown exactly once, never retrievable again.
  const [freshKey, setFreshKey] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("api_keys")
        .select("id, name, key_prefix, created_at, last_used_at, revoked_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setKeys(data ?? []);
    } catch (err) {
      console.error("Failed to load API keys:", err);
      toast({ title: "Error", description: "Failed to load API keys", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [businessId, toast]);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const { data, error } = await supabase.rpc("create_api_key", {
        p_business_id: businessId,
        p_name: newKeyName.trim() || "Default key",
      });
      if (error) throw error;
      const result = data as { key?: string } | null;
      if (!result?.key) throw new Error("No key returned");
      setFreshKey(result.key);
      setNewKeyName("");
      loadKeys();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message?.includes("limit") ? "You've reached the limit of 10 active keys." : "Failed to create API key",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (key: ApiKeyRow) => {
    if (!window.confirm(`Revoke "${key.name}" (${key.key_prefix}…)? Integrations using it will stop working immediately.`)) return;
    try {
      const { data, error } = await supabase.rpc("revoke_api_key", { p_key_id: key.id });
      if (error || data === false) throw error ?? new Error("not revoked");
      toast({ title: "Key revoked", description: `${key.name} can no longer be used.` });
      loadKeys();
    } catch {
      toast({ title: "Error", description: "Failed to revoke key", variant: "destructive" });
    }
  };

  const copyText = (text: string, what = "Copied") => {
    navigator.clipboard.writeText(text).then(
      () => toast({ title: what, description: "Copied to clipboard." }),
      () => toast({ title: "Error", description: "Failed to copy.", variant: "destructive" }),
    );
  };

  const activeKeys = keys.filter((k) => !k.revoked_at);
  const revokedKeys = keys.filter((k) => k.revoked_at);

  const curlExample = `curl -X POST "${API_BASE}/message" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "What products do you offer?",
    "customerName": "Jane",
    "customerEmail": "jane@example.com"
  }'`;

  const jsExample = `const res = await fetch("${API_BASE}/message", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    message: userMessage,
    sessionId,           // omit on first message; reuse afterwards
    customerName, customerEmail,
  }),
});
const { sessionId: sid, reply, escalated, order } = await res.json();`;

  if (loading) {
    return <div className="text-center py-8">Loading API keys...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold">API Keys</h3>
          <p className="text-sm text-muted-foreground">
            Use OctaDezx from your own website, app, or backend. Conversations, escalations,
            and orders from the API show up in this dashboard just like the hosted chat.
          </p>
        </div>
        <Button onClick={() => { setFreshKey(null); setCreateOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />Create Key
        </Button>
      </div>

      {/* Active keys */}
      {activeKeys.length === 0 ? (
        <Card>
          <CardContent className="text-center py-10">
            <KeyRound className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No API keys yet. Create one to integrate OctaDezx anywhere.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {activeKeys.map((k) => (
            <Card key={k.id}>
              <CardContent className="flex items-center justify-between gap-4 py-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <KeyRound className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="font-medium">{k.name}</span>
                    <code className="text-xs bg-muted px-2 py-0.5 rounded">{k.key_prefix}…</code>
                    <Badge variant="secondary" className="text-xs">Active</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Created {formatDistanceToNow(new Date(k.created_at))} ago
                    {k.last_used_at ? ` • Last used ${formatDistanceToNow(new Date(k.last_used_at))} ago` : " • Never used"}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleRevoke(k)}>
                  <Trash2 className="h-4 w-4 mr-1.5" />Revoke
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {revokedKeys.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Revoked keys ({revokedKeys.length})</summary>
          <div className="mt-2 space-y-1">
            {revokedKeys.map((k) => (
              <div key={k.id} className="flex items-center gap-2 text-muted-foreground text-xs px-2 py-1.5 rounded bg-muted/50">
                <code>{k.key_prefix}…</code>
                <span>{k.name}</span>
                <span className="ml-auto">revoked {formatDistanceToNow(new Date(k.revoked_at!))} ago</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Integration docs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Code2 className="h-4 w-4" />Quick Integration</CardTitle>
          <CardDescription>
            Send customer messages and get AI replies. Keep the returned <code>sessionId</code> to continue a conversation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium">Endpoint</p>
              <Button variant="ghost" size="sm" onClick={() => copyText(`${API_BASE}/message`)}><Copy className="h-3.5 w-3.5" /></Button>
            </div>
            <code className="block bg-muted rounded-md p-3 text-xs overflow-x-auto whitespace-nowrap">POST {API_BASE}/message</code>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium">cURL</p>
              <Button variant="ghost" size="sm" onClick={() => copyText(curlExample)}><Copy className="h-3.5 w-3.5" /></Button>
            </div>
            <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">{curlExample}</pre>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium">JavaScript</p>
              <Button variant="ghost" size="sm" onClick={() => copyText(jsExample)}><Copy className="h-3.5 w-3.5" /></Button>
            </div>
            <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">{jsExample}</pre>
          </div>

          <div className="text-xs text-muted-foreground space-y-1 border-t pt-3">
            <p>• Response: <code>{`{ sessionId, reply, escalated, order }`}</code>, when <code>escalated</code> is true, a human should take over (poll <code>GET {API_BASE}/messages?sessionId=…</code> for their replies).</p>
            <p>• Rate limit: 60 requests/minute per key, and every AI answer draws on your plan's monthly message allowance.</p>
            <p>• Keep keys on your server. Never embed them in public website code, anyone could read them.</p>
          </div>
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) setFreshKey(null); }}>
        <DialogContent className="max-w-md">
          {freshKey ? (
            <>
              <DialogHeader>
                <DialogTitle>Your new API key</DialogTitle>
                <DialogDescription>
                  Copy it now, for security, it's shown <strong>only once</strong> and can't be recovered.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted rounded-md p-3 text-xs break-all">{freshKey}</code>
                  <Button variant="outline" size="icon" onClick={() => copyText(freshKey, "API key copied")}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md p-3">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>Treat this like a password. If it leaks, revoke it here and create a new one.</span>
                </div>
                <Button className="w-full" onClick={() => { setCreateOpen(false); setFreshKey(null); }}>
                  Done, I've copied it
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Create API key</DialogTitle>
                <DialogDescription>Give it a name so you remember where it's used.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="key-name">Key name</Label>
                  <Input
                    id="key-name"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g. Website widget, Mobile app, CRM"
                    onKeyDown={(e) => { if (e.key === "Enter" && !creating) handleCreate(); }}
                  />
                </div>
                <Button className="w-full" onClick={handleCreate} disabled={creating}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Generate Key
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ApiKeys;
