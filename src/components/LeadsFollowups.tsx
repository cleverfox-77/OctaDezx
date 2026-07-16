import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  UserPlus, Send, Loader2, Mail, Clock, MessageSquare, Sparkles, NotebookPen,
} from "lucide-react";
import { type Database } from "@/integrations/supabase/types";

type Business = Database["public"]["Tables"]["businesses"]["Row"];

/* ── Follow-up playbook storage ──────────────────────────────────────────────
   The owner's follow-up rules are stored INSIDE business.ai_instructions
   between sentinel markers. ai_instructions is already part of every AI
   prompt server-side, so the assistant genuinely applies these rules in
   live conversations — no backend changes required. */
const PB_START = "\n\n### FOLLOW-UP & LEAD PLAYBOOK (owner-defined)\n";
const PB_END = "\n### END FOLLOW-UP PLAYBOOK";

const extractPlaybook = (ai: string | null): string => {
  if (!ai) return "";
  const s = ai.indexOf(PB_START);
  if (s === -1) return "";
  const e = ai.indexOf(PB_END, s);
  return e === -1 ? "" : ai.slice(s + PB_START.length, e).trim();
};

const withPlaybook = (ai: string | null, playbook: string): string => {
  let base = ai ?? "";
  const s = base.indexOf(PB_START);
  if (s !== -1) {
    const e = base.indexOf(PB_END, s);
    base = e === -1 ? base.slice(0, s) : base.slice(0, s) + base.slice(e + PB_END.length);
  }
  const trimmed = playbook.trim();
  return trimmed ? `${base.trimEnd()}${PB_START}${trimmed}${PB_END}` : base.trimEnd();
};

interface Lead {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  status: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

const timeAgo = (iso: string) => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days < 30 ? `${days}d ago` : new Date(iso).toLocaleDateString();
};

const statusBadge = (status: string | null) => {
  switch (status) {
    case "escalated": return <Badge variant="destructive" className="text-[10px]">Escalated</Badge>;
    case "resolved": return <Badge variant="secondary" className="text-[10px]">Resolved</Badge>;
    default: return <Badge variant="outline" className="text-[10px]">Active</Badge>;
  }
};

const LeadsFollowups = ({
  business,
  onBusinessUpdated,
}: {
  business: Business;
  onBusinessUpdated: (b: Business) => void;
}) => {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [playbook, setPlaybook] = useState(() => extractPlaybook(business.ai_instructions));
  const [savingPlaybook, setSavingPlaybook] = useState(false);
  const [composer, setComposer] = useState<Lead | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase
      .from("chat_sessions")
      .select("id, customer_name, customer_email, status, source, created_at, updated_at")
      .eq("business_id", business.id)
      .or("customer_name.not.is.null,customer_email.not.is.null")
      .order("updated_at", { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          toast({ title: "Couldn't load leads", description: error.message, variant: "destructive" });
          setLeads([]);
        } else {
          setLeads((data as Lead[]) ?? []);
        }
      });
    return () => { alive = false; };
  }, [business.id, toast]);

  const savePlaybook = async () => {
    setSavingPlaybook(true);
    try {
      const nextAi = withPlaybook(business.ai_instructions, playbook);
      const { data, error } = await supabase
        .from("businesses")
        .update({ ai_instructions: nextAi })
        .eq("id", business.id)
        .select()
        .single();
      if (error) throw error;
      if (data) onBusinessUpdated(data);
      toast({
        title: "Playbook saved",
        description: "The AI now applies these follow-up rules in every conversation.",
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSavingPlaybook(false);
    }
  };

  const openComposer = (lead: Lead) => {
    setComposer(lead);
    const first = lead.customer_name?.split(" ")[0];
    setMessage(
      `Hi${first ? ` ${first}` : ""}! Just following up from ${business.name} — ` +
      `is there anything else I can help you with?`
    );
  };

  const sendFollowUp = async () => {
    if (!composer || !message.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.from("chat_messages").insert([{
        session_id: composer.id,
        sender_type: "human",
        content: message.trim(),
      }]);
      if (error) throw error;
      // Re-open the conversation so it surfaces for the customer and in Chat Sessions.
      await supabase.from("chat_sessions")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", composer.id);
      toast({
        title: "Follow-up sent",
        description: `${composer.customer_name || "The customer"} will see it the next time they open the chat.`,
      });
      setComposer(null);
      setMessage("");
      setLeads((cur) => cur?.map((l) => l.id === composer.id
        ? { ...l, status: "active", updated_at: new Date().toISOString() } : l) ?? cur);
    } catch (e: any) {
      toast({ title: "Couldn't send follow-up", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const stats = useMemo(() => ({
    total: leads?.length ?? 0,
    withEmail: leads?.filter((l) => l.customer_email).length ?? 0,
    stale: leads?.filter((l) => Date.now() - new Date(l.updated_at).getTime() > 48 * 3600_000).length ?? 0,
  }), [leads]);

  return (
    <div className="space-y-6">

      {/* ── Follow-up playbook ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <NotebookPen className="h-4 w-4 text-primary" />
            Follow-up playbook
          </CardTitle>
          <CardDescription>
            Tell the AI how to follow up during conversations — when to nudge an undecided
            customer, what to offer, and how persistent to be. It applies these rules in
            every live chat, in the customer's language.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="playbook" className="sr-only">Follow-up rules</Label>
            <Textarea
              id="playbook"
              value={playbook}
              onChange={(e) => setPlaybook(e.target.value)}
              rows={5}
              placeholder={
                "e.g.\n" +
                "- If a customer asks about a product but doesn't order, offer to reserve it and ask if they have questions.\n" +
                "- If someone abandons mid-order, remind them their items are still available and mention free shipping over $30.\n" +
                "- Always collect a name and phone/email before a conversation ends without a sale."
              }
            />
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              Saved rules take effect on the very next customer message — no retraining needed.
            </p>
          </div>
          <Button onClick={savePlaybook} disabled={savingPlaybook} className="press">
            {savingPlaybook && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {savingPlaybook ? "Saving…" : "Save playbook"}
          </Button>
        </CardContent>
      </Card>

      {/* ── Lead stats strip ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Leads captured", value: stats.total, icon: UserPlus },
          { label: "With email", value: stats.withEmail, icon: Mail },
          { label: "Quiet for 48h+", value: stats.stale, icon: Clock },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
              <s.icon className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">{s.label}</span>
            </div>
            {leads === null
              ? <Skeleton className="h-7 w-12" />
              : <div className="text-2xl font-bold tabular-nums">{s.value}</div>}
          </div>
        ))}
      </div>

      {/* ── Leads list ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Captured leads</CardTitle>
          <CardDescription>
            Every customer who shared their name or email in a conversation. Send a follow-up —
            it lands directly in their existing chat thread.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {leads === null ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center text-center py-10 gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <UserPlus className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-medium">No leads captured yet</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                As soon as a customer shares their name or email in a chat, they'll appear
                here ready to follow up. Tip: the playbook above can tell the AI to always
                ask for contact details.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {leads.map((lead) => (
                <div key={lead.id}
                  className="flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors hover:border-primary/30">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: "linear-gradient(135deg,#000047,#4f46e5)" }}>
                    {(lead.customer_name || lead.customer_email || "?")[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold truncate">
                        {lead.customer_name || "Unnamed customer"}
                      </span>
                      {statusBadge(lead.status)}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {lead.customer_email && <span className="truncate">{lead.customer_email}</span>}
                      <span className="flex-shrink-0">Last activity {timeAgo(lead.updated_at)}</span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openComposer(lead)} className="press flex-shrink-0">
                    <Send className="h-3.5 w-3.5 mr-2" />Follow up
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Composer dialog ── */}
      <Dialog open={!!composer} onOpenChange={(open) => !open && setComposer(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Follow up with {composer?.customer_name || "customer"}
            </DialogTitle>
            <DialogDescription>
              Sent as your team into their existing conversation — they'll see it when they
              reopen the chat.
            </DialogDescription>
          </DialogHeader>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} autoFocus />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setComposer(null)} disabled={sending} className="press">Cancel</Button>
            <Button onClick={sendFollowUp} disabled={sending || !message.trim()} className="press">
              {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {sending ? "Sending…" : "Send follow-up"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeadsFollowups;
