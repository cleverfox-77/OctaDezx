import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, PhoneOutgoing, Ban, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { callVoiceAdmin } from "./voiceApi";
import type { VoiceSettings } from "./VoiceSettingsPanel";

interface Job {
  id: string;
  to_e164: string;
  purpose: string;
  status: string;
  scheduled_for: string;
  attempts: number;
  last_error: string | null;
  consent_source: string | null;
}

interface Dnc { e164: string; reason: string | null; created_at: string; }

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  processing: "bg-blue-100 text-blue-800",
  done: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-slate-200 text-slate-700",
  skipped: "bg-slate-200 text-slate-700",
};

export default function OutboundQueue({
  businessId, settings, canUseVoice, onSettingsChanged,
}: {
  businessId: string;
  settings: VoiceSettings | null;
  canUseVoice: boolean;
  onSettingsChanged: () => void;
}) {
  const db = supabase as any;
  const { toast } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [dnc, setDnc] = useState<Dnc[]>([]);
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState("");
  const [queuing, setQueuing] = useState(false);
  const [blocking, setBlocking] = useState("");

  const load = async () => {
    const [{ data: j }, { data: d }] = await Promise.all([
      db.from("voice_outbound_jobs").select("*").eq("business_id", businessId)
        .order("scheduled_for", { ascending: false }).limit(100),
      db.from("voice_dnc").select("*").eq("business_id", businessId).order("created_at", { ascending: false }),
    ]);
    setJobs((j ?? []) as Job[]);
    setDnc((d ?? []) as Dnc[]);
  };
  useEffect(() => { if (businessId) load(); /* eslint-disable-next-line */ }, [businessId]);

  const outboundOn = !!settings?.outbound_enabled;

  const toggleOutbound = async (on: boolean) => {
    const { error } = await db.from("voice_settings")
      .upsert({ business_id: businessId, outbound_enabled: on, updated_at: new Date().toISOString() },
              { onConflict: "business_id" });
    if (error) { toast({ title: "Could not change that", description: error.message, variant: "destructive" }); return; }
    onSettingsChanged();
  };

  const queue = async () => {
    setQueuing(true);
    try {
      const res = await callVoiceAdmin("call", {
        business_id: businessId, to_e164: to.trim(), note, consent_source: consent,
      });
      if (!res.ok) { toast({ title: "Not queued", description: res.reason, variant: "destructive" }); return; }
      toast({
        title: res.duplicate ? "Already queued" : "Call queued",
        description: res.duplicate ? "That exact call is already waiting." : "It goes out inside your calling window.",
      });
      setTo(""); setNote(""); setConsent("");
      await load();
    } catch (e: any) {
      toast({ title: "Could not queue the call", description: e.message, variant: "destructive" });
    } finally {
      setQueuing(false);
    }
  };

  const cancel = async (job: Job) => {
    await db.from("voice_outbound_jobs").update({ status: "cancelled" }).eq("id", job.id);
    setJobs((list) => list.map((x) => (x.id === job.id ? { ...x, status: "cancelled" } : x)));
  };

  const block = async () => {
    if (!blocking.trim()) return;
    try {
      await callVoiceAdmin("dnc", { business_id: businessId, e164: blocking.trim(), reason: "added by owner" });
      toast({ title: "Added to do-not-call" });
      setBlocking("");
      await load();
    } catch (e: any) {
      toast({ title: "Could not add", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-amber-300/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Before you turn this on
          </CardTitle>
          <CardDescription className="space-y-2">
            <span className="block">
              Automated calls are heavily regulated. In the United States an AI voice counts as an
              artificial voice under the TCPA, and every call placed without prior express consent
              carries statutory damages per call.
            </span>
            <span className="block">
              OctaDezx will only dial inside 8am to 9pm in the person's own local time, honours
              opt-outs the moment somebody says stop calling, and records the reason you were
              allowed to call each number. That is not a substitute for your own legal advice.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm font-medium">Outbound calling</Label>
              <p className="text-xs text-muted-foreground">
                Off by default. Turning it on confirms you have consent to call these people.
              </p>
            </div>
            <Switch checked={outboundOn} disabled={!canUseVoice} onCheckedChange={toggleOutbound} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Place a call</CardTitle>
          <CardDescription>Queued, then dialled inside your calling window.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="to">Number</Label>
            <Input id="to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="+8801700000000" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="consent">Why you may call them</Label>
            <Input id="consent" value={consent} onChange={(e) => setConsent(e.target.value)}
                   placeholder="Existing customer, asked for a callback on 2 August" />
            <p className="text-xs text-muted-foreground">
              Stored with the call. This is the first thing anyone asks about in a complaint.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note">What the call is about</Label>
            <Textarea id="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)}
                      placeholder="e.g. Their order 1043 is ready to collect, and ask if Saturday morning suits." />
            <p className="text-xs text-muted-foreground">
              Your assistant uses this as the reason for calling. Leave it blank to use the default
              reason from your voice settings.
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={queue} disabled={queuing || !to.trim() || !outboundOn || !canUseVoice}>
              {queuing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PhoneOutgoing className="mr-2 h-4 w-4" />}
              Queue call
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!jobs.length && <p className="text-sm text-muted-foreground">Nothing queued.</p>}
          {jobs.map((job) => (
            <div key={job.id} className="flex flex-wrap items-center gap-3 rounded-md border p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{job.to_e164}</div>
                <div className="text-xs text-muted-foreground">
                  {job.purpose.replace(/_/g, " ")}
                  {" • "}{formatDistanceToNow(new Date(job.scheduled_for), { addSuffix: true })}
                  {job.attempts > 0 && ` • ${job.attempts} attempt${job.attempts === 1 ? "" : "s"}`}
                </div>
                {job.last_error && <div className="text-xs text-muted-foreground">{job.last_error}</div>}
              </div>
              <Badge className={STATUS_STYLES[job.status] ?? ""} variant="secondary">{job.status}</Badge>
              {(job.status === "pending" || job.status === "processing") && (
                <Button size="sm" variant="ghost" onClick={() => cancel(job)}>Cancel</Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Do not call</CardTitle>
          <CardDescription>
            Anyone who says stop calling is added here automatically, and their queued calls are cancelled.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Input value={blocking} onChange={(e) => setBlocking(e.target.value)} placeholder="+8801700000000" />
            <Button variant="outline" onClick={block} disabled={!blocking.trim()}>
              <Ban className="mr-2 h-4 w-4" /> Add
            </Button>
          </div>
          {dnc.map((d) => (
            <div key={d.e164} className="flex items-center gap-3 rounded-md border p-3 text-sm">
              <Ban className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1">{d.e164}</span>
              <span className="text-xs text-muted-foreground">{d.reason}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
