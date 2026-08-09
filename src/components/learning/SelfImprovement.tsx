/**
 * What the assistant has learned, and what it still cannot answer.
 *
 * The approval queue here is not a nicety, it is the safety control for the
 * whole learning feature. Lessons are distilled from real conversations, and
 * conversations contain text written by strangers. An assistant that promoted
 * its own rules straight into every future chat would be one well-phrased
 * customer message away from being reprogrammed. So machines may only ever
 * propose, and a human decides. The database enforces the same rule with a
 * trigger, so this screen is the interface to that gate rather than the gate
 * itself.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  Brain, Check, X, Loader2, Sparkles, HelpCircle, Pencil, Trash2, RefreshCw,
} from "lucide-react";

interface Lesson {
  id: string;
  trigger_condition: string;
  corrected_behavior: string;
  rationale: string | null;
  status: "pending" | "approved" | "rejected" | "retired";
  evidence_count: number;
  origin: string;
  created_at: string;
}

interface Gap {
  id: string;
  question: string;
  times_asked: number;
  last_seen_at: string;
  status: "open" | "answered" | "dismissed";
}

/** Shape of ai_learning_scorecard's JSONB. escalation_rate is ALREADY a
 *  percentage (the RPC does the x100), so it is rendered as-is. */
interface Scorecard {
  approved_lessons?: number | null;
  pending_lessons?: number | null;
  open_gaps?: number | null;
  learning_started_at?: string | null;
  before?: { sessions?: number; escalated?: number; escalation_rate?: number | null } | null;
  after?: { sessions?: number; escalated?: number; escalation_rate?: number | null } | null;
}

const SelfImprovement = ({ businessId }: { businessId: string }) => {
  const { toast } = useToast();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [score, setScore] = useState<Scorecard | null>(null);
  const [loading, setLoading] = useState(true);
  const [learning, setLearning] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ trigger: "", behavior: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const [lessonRes, gapRes, scoreRes] = await Promise.all([
      supabase.from("ai_lessons")
        .select("id, trigger_condition, corrected_behavior, rationale, status, evidence_count, origin, created_at")
        .eq("business_id", businessId)
        .in("status", ["pending", "approved"])
        .order("status", { ascending: true })          // pending first, it needs a decision
        .order("evidence_count", { ascending: false })
        .limit(60),
      supabase.from("ai_knowledge_gaps")
        .select("id, question, times_asked, last_seen_at, status")
        .eq("business_id", businessId)
        .eq("status", "open")
        .order("times_asked", { ascending: false })
        .limit(20),
      supabase.rpc("ai_learning_scorecard", { p_business_id: businessId }),
    ]);
    setLessons((lessonRes.data ?? []) as unknown as Lesson[]);
    setGaps((gapRes.data ?? []) as unknown as Gap[]);
    setScore((scoreRes.data ?? null) as unknown as Scorecard | null);
    setLoading(false);
  }, [businessId]);

  useEffect(() => { void load(); }, [load]);

  const setStatus = async (id: string, status: Lesson["status"]) => {
    // Only the status is sent. approved_by and approved_at are stamped by the
    // ai_lessons_guard trigger from auth.uid(), which is also what rejects the
    // transition outright if the caller is not the owner. Sending them from
    // here would imply the browser gets to say who approved a rule.
    const { error } = await supabase.from("ai_lessons").update({ status }).eq("id", id);
    if (error) {
      toast({ title: "Could not update that lesson", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: status === "approved" ? "Lesson approved" : status === "rejected" ? "Lesson rejected" : "Lesson updated",
      description: status === "approved"
        ? "Your assistant will start applying it on the next conversation."
        : "It will not be suggested again.",
    });
    void load();
  };

  const saveEdit = async (id: string) => {
    const trigger = draft.trigger.trim().slice(0, 200);
    const behavior = draft.behavior.trim().slice(0, 400);
    if (trigger.length < 3 || behavior.length < 3) {
      toast({ title: "Both fields need a little more detail", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("ai_lessons")
      .update({ trigger_condition: trigger, corrected_behavior: behavior })
      .eq("id", id);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    setEditing(null);
    void load();
  };

  const learnNow = async () => {
    setLearning(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const res = await supabase.functions.invoke("ai-learn", {
        body: { businessId },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.error) throw new Error(res.error.message);
      const proposed = Number((res.data as Record<string, unknown>)?.lessons_proposed ?? 0);
      const found = Number((res.data as Record<string, unknown>)?.signals_found ?? 0);
      toast({
        title: proposed > 0 ? `${proposed} new lesson${proposed === 1 ? "" : "s"} to review` : "Nothing new to learn yet",
        description: proposed > 0
          ? "Read them below and approve the ones you agree with."
          : found === 0
            ? "Your assistant learns when a member of your team corrects it, or when it cannot answer something. Neither has happened yet."
            : "It looked at what happened and did not find a general rule worth adding.",
      });
      void load();
    } catch (e) {
      toast({
        title: "Could not run learning",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLearning(false);
    }
  };

  const dismissGap = async (id: string) => {
    await supabase.from("ai_knowledge_gaps").update({ status: "dismissed" }).eq("id", id);
    void load();
  };

  const pending = lessons.filter((l) => l.status === "pending");
  const approved = lessons.filter((l) => l.status === "approved");

  const rate = (v: number | null | undefined) =>
    typeof v === "number" ? `${v}%` : "not enough data yet";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-5 w-5 text-primary" />
              What your AI has learned
            </CardTitle>
            <CardDescription>
              Your assistant watches where it got things wrong, and where your team had to step in,
              and suggests rules so it handles those on its own next time. Nothing is applied until
              you approve it.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={learnNow} disabled={learning}>
            {learning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Learn now
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="Rules in use" value={String(approved.length)} />
            <Stat label="Waiting for you" value={String(pending.length)} highlight={pending.length > 0} />
            <Stat label="Unanswered questions" value={String(gaps.length)} />
            <Stat
              label="Escalation rate"
              value={rate(score?.after?.escalation_rate)}
              hint={
                score?.before?.escalation_rate != null
                  ? `was ${rate(score.before.escalation_rate)} before your first rule`
                  : undefined
              }
            />
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading
        </div>
      )}

      {!loading && pending.length > 0 && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Suggested rules, waiting for your decision
            </CardTitle>
            <CardDescription>
              Read each one as if you were briefing a new member of staff. Approve what is right,
              edit what is close, reject what is wrong.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pending.map((l) => (
              <div key={l.id} className="rounded-lg border p-4 space-y-3">
                {editing === l.id ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">When</p>
                      <Textarea
                        value={draft.trigger}
                        onChange={(e) => setDraft((d) => ({ ...d, trigger: e.target.value }))}
                        maxLength={200}
                        rows={2}
                      />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">The assistant should</p>
                      <Textarea
                        value={draft.behavior}
                        onChange={(e) => setDraft((d) => ({ ...d, behavior: e.target.value }))}
                        maxLength={400}
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => saveEdit(l.id)}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm">
                      <span className="text-muted-foreground">When </span>
                      <span className="font-medium">{l.trigger_condition}</span>
                    </p>
                    <p className="text-sm">
                      <span className="text-muted-foreground">the assistant should </span>
                      <span className="font-medium">{l.corrected_behavior}</span>
                    </p>
                    {l.rationale && (
                      <p className="text-xs text-muted-foreground border-l-2 pl-3">{l.rationale}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Button size="sm" onClick={() => setStatus(l.id, "approved")}>
                        <Check className="mr-1.5 h-4 w-4" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(l.id);
                          setDraft({ trigger: l.trigger_condition, behavior: l.corrected_behavior });
                        }}
                      >
                        <Pencil className="mr-1.5 h-4 w-4" /> Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setStatus(l.id, "rejected")}>
                        <X className="mr-1.5 h-4 w-4" /> Reject
                      </Button>
                      <span className="text-xs text-muted-foreground ml-auto">
                        seen in {l.evidence_count} conversation{l.evidence_count === 1 ? "" : "s"}
                      </span>
                    </div>
                  </>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!loading && approved.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rules your assistant is using</CardTitle>
            <CardDescription>These are applied in every conversation, on chat and on the phone.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {approved.map((l) => (
              <div key={l.id} className="flex items-start gap-3 rounded-lg border p-3">
                <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm flex-1">
                  <span className="text-muted-foreground">When </span>{l.trigger_condition}
                  <span className="text-muted-foreground">, </span>{l.corrected_behavior}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setStatus(l.id, "rejected")}
                  aria-label="Stop using this rule"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!loading && gaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              Questions your AI could not answer
            </CardTitle>
            <CardDescription>
              Real questions customers asked that your assistant had no information for. Add the
              answer to your knowledge base and it will stop losing these.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {gaps.map((g) => (
              <div key={g.id} className="flex items-start gap-3 rounded-lg border p-3">
                <div className="flex-1">
                  <p className="text-sm">{g.question}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    asked {g.times_asked} time{g.times_asked === 1 ? "" : "s"}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => dismissGap(g.id)}>Dismiss</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!loading && !pending.length && !approved.length && !gaps.length && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Nothing learned yet. Your assistant starts picking things up once it has handled real
            conversations, and especially when someone on your team steps in to correct it.
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const Stat = ({ label, value, hint, highlight }: {
  label: string; value: string; hint?: string; highlight?: boolean;
}) => (
  <div className={`rounded-lg border p-3 ${highlight ? "border-primary/50 bg-primary/5" : ""}`}>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-lg font-bold">{value}</p>
    {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
  </div>
);

export default SelfImprovement;
