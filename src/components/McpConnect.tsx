import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import {
  Bot, Copy, Loader2, Lock, CheckCircle2, KeyRound, Terminal, Sparkles, ShieldCheck, ChevronDown,
} from "lucide-react";

interface McpConnectProps {
  businessId: string;
  /** Whether the owner currently has an active plan/trial (server enforces this too). */
  subscribed: boolean;
  /** Jump to the Billing section. */
  onUpgrade: () => void;
}

// Branded endpoint — Vercel proxies /mcp → the Supabase edge function, so the
// connector URL, OAuth login and consent all live on one octadezx.com origin.
const MCP_URL = "https://octadezx.com/mcp";

// The tools the OctaDezx MCP exposes inside Claude — grouped so owners see they
// can set up, train, run AND analyse from Claude.
const TOOL_GROUPS: { heading: string; tools: { name: string; desc: string }[] }[] = [
  {
    heading: "Set up & train",
    tools: [
      { name: "get_business_profile", desc: "See what's configured and what's missing" },
      { name: "update_business_profile", desc: "Write your details, policies & AI behaviour" },
      { name: "add / update / delete_knowledge", desc: "Add, edit or remove what the AI knows" },
      { name: "add / update / delete_product", desc: "Manage your catalog: add, edit, remove items" },
    ],
  },
  {
    heading: "Run customer care",
    tools: [
      { name: "list_escalated_chats", desc: "See conversations waiting for a human" },
      { name: "reply_to_customer", desc: "Send a reply straight into a live chat" },
      { name: "resolve_chat", desc: "Close out a handled conversation" },
      { name: "search_knowledge", desc: "Look up what the AI knows" },
    ],
  },
  {
    heading: "Analyse & insights",
    tools: [
      { name: "get_recent_conversations", desc: "Pull chats with messages to mine for insights" },
      { name: "business_overview", desc: "Live counts: active, escalated, resolved, orders" },
      { name: "list_orders", desc: "Review recent orders captured in chat" },
      { name: "list_products", desc: "Audit your catalog" },
    ],
  },
];

const McpConnect = ({ businessId, subscribed, onUpgrade }: McpConnectProps) => {
  const { toast } = useToast();
  const [keyCount, setKeyCount] = useState<number | null>(null);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const loadKeys = useCallback(async () => {
    const { count } = await supabase
      .from("api_keys")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .is("revoked_at", null);
    setKeyCount(count ?? 0);
  }, [businessId]);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  const createKey = async () => {
    setCreating(true);
    try {
      const { data, error } = await supabase.rpc("create_api_key", {
        p_business_id: businessId,
        p_name: "Claude MCP",
      });
      if (error) throw error;
      const key = (data as any)?.key as string | undefined;
      if (key) {
        setFreshKey(key);
        toast({ title: "Connection key created", description: "Copy it now — it's shown only once." });
      }
      loadKeys();
    } catch (e: any) {
      toast({ title: "Error", description: e.message ?? "Could not create key", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast({ title: "Copied!", description: `${label} copied to clipboard.` }),
      () => toast({ title: "Error", description: "Copy failed.", variant: "destructive" }),
    );
  };

  const keyForSnippet = freshKey ?? "odx_YOUR_CONNECTION_KEY";

  const desktopConfig = `{
  "mcpServers": {
    "octadezx": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote",
        "${MCP_URL}",
        "--header", "Authorization: Bearer ${keyForSnippet}"
      ]
    }
  }
}`;

  return (
    <div className="space-y-4">
      {/* Intro */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Connect OctaDezx to Claude
          </CardTitle>
          <CardDescription>
            Run your whole assistant from inside Claude — in plain language. Claude can set up your business details,
            train the AI, handle escalated chats, and analyse your conversations for insights.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {TOOL_GROUPS.map((group) => (
            <div key={group.heading}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group.heading}</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {group.tools.map((t) => (
                  <div key={t.name} className="flex items-start gap-2 rounded-lg border p-3">
                    <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <code className="text-xs font-semibold">{t.name}</code>
                      <p className="text-xs text-muted-foreground leading-snug">{t.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Subscription state */}
      {subscribed ? (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="flex items-start gap-3 pt-6">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Your plan includes MCP access</p>
              <p className="text-muted-foreground mt-1">Connect below — every tool is unlocked.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-6">
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Connecting is free — using it needs a subscription</p>
                <p className="text-muted-foreground mt-1">
                  You can add the connection to Claude right now. The tools stay locked and return a
                  "subscription required" message until you're on a paid plan.
                </p>
              </div>
            </div>
            <Button onClick={onUpgrade} className="flex-shrink-0">Upgrade to unlock</Button>
          </CardContent>
        </Card>
      )}

      {/* Primary — one-click OAuth connector (no keys to copy) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            Connect in Claude
          </CardTitle>
          <CardDescription>
            The easy way — nothing to copy but one URL. Claude opens OctaDezx in your browser, you sign in and
            click Authorize.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold flex-shrink-0">1</span>
              <span>In Claude, open <strong>Settings → Connectors</strong> and choose <strong>Add custom connector</strong>.</span>
            </li>
            <li className="flex gap-3">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold flex-shrink-0">2</span>
              <div className="flex-1 space-y-2">
                <span>Paste this URL and continue:</span>
                <div className="flex items-center gap-2">
                  <code className="bg-muted px-2 py-1.5 rounded text-xs flex-1 break-all">{MCP_URL}</code>
                  <Button variant="outline" size="icon" onClick={() => copy(MCP_URL, "MCP URL")}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold flex-shrink-0">3</span>
              <span>A browser opens — <strong>sign in to OctaDezx</strong> and click <strong>Authorize</strong>. Done.</span>
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* Advanced — legacy API key for Claude Desktop / non-OAuth clients */}
      <Card>
        <CardHeader className="cursor-pointer select-none" onClick={() => setShowAdvanced((v) => !v)}>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              Advanced · API key (Claude Desktop &amp; other clients)
            </span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
          </CardTitle>
        </CardHeader>
        {showAdvanced && (
          <CardContent className="space-y-4">
            <CardDescription>
              Using Claude Desktop or a client without OAuth? Create a connection key and send it as a Bearer
              token to the same endpoint. {keyCount !== null && keyCount > 0
                ? `You have ${keyCount} active key${keyCount === 1 ? "" : "s"}.`
                : ""}
            </CardDescription>

            {freshKey ? (
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
                <p className="text-xs text-muted-foreground mb-1">Your new connection key (shown once):</p>
                <div className="flex items-center gap-2">
                  <code className="text-sm break-all flex-1">{freshKey}</code>
                  <Button variant="outline" size="icon" onClick={() => copy(freshKey, "Key")}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <Button onClick={createKey} disabled={creating}>
                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                Create a connection key
              </Button>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <Terminal className="h-4 w-4 text-muted-foreground" /> Claude Desktop config
              </p>
              <p className="text-xs text-muted-foreground">
                Paste into <code>claude_desktop_config.json</code> (Settings → Developer → Edit Config), then restart Claude.
              </p>
              <div className="relative">
                <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto"><code>{desktopConfig}</code></pre>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7"
                  onClick={() => copy(desktopConfig, "Config")}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Badge variant="secondary" className="font-mono text-[11px]">Authorization: Bearer odx_…</Badge>
            </div>
          </CardContent>
        )}
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-3 pt-6">
          <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            The same safety guard applies through Claude: tools only read and write your real OctaDezx data, scoped to
            this business by the connection key. Revoke a key anytime from <strong>API Keys</strong>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default McpConnect;
