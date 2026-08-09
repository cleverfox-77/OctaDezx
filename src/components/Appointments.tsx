import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { CalendarClock, Check, X, Loader2 } from "lucide-react";

interface Props { businessId: string; }
interface Settings {
  enabled: boolean; timezone: string; slot_minutes: number;
  working_hours: string; services: string; instructions: string;
}
interface Appt {
  id: string; customer_name: string | null; customer_contact: string | null;
  service: string | null; starts_at: string | null; duration_minutes: number;
  status: string; notes: string | null; created_at: string;
}

const DEFAULTS: Settings = {
  enabled: false, timezone: "Asia/Dhaka", slot_minutes: 30,
  working_hours: "Mon to Sat, 10:00 to 18:00", services: "", instructions: "",
};
const STATUS_STYLES: Record<string, string> = {
  requested: "bg-amber-100 text-amber-800",
  confirmed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-700",
  completed: "bg-slate-200 text-slate-700",
};

export default function Appointments({ businessId }: Props) {
  const { toast } = useToast();
  const db = supabase as any;
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (businessId) load(); /* eslint-disable-next-line */ }, [businessId]);

  const load = async () => {
    setLoading(true);
    const [{ data: s }, { data: a }] = await Promise.all([
      db.from("appointment_settings").select("*").eq("business_id", businessId).maybeSingle(),
      db.from("appointments").select("*").eq("business_id", businessId).order("starts_at", { ascending: true, nullsFirst: false }).limit(200),
    ]);
    if (s) setSettings({
      enabled: !!s.enabled, timezone: s.timezone ?? "Asia/Dhaka", slot_minutes: s.slot_minutes ?? 30,
      working_hours: s.working_hours ?? "", services: s.services ?? "", instructions: s.instructions ?? "",
    });
    setAppts((a ?? []) as Appt[]);
    setLoading(false);
  };

  const saveSettings = async () => {
    setSaving(true);
    const { error } = await db.from("appointment_settings")
      .upsert({ business_id: businessId, ...settings, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "Saved", description: settings.enabled ? "Your AI can now take bookings." : "Booking is turned off." });
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await db.from("appointments").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); return; }
    setAppts((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)));
  };

  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "No time set");

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Appointments</h1>
        <p className="text-muted-foreground">
          Let your AI book appointments and slots for customers, around the hours and services you set here.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" /> Booking settings</CardTitle>
          <CardDescription>When this is on, the AI collects the details and books the slot inside any chat.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium text-sm">Take appointments</p>
              <p className="text-xs text-muted-foreground">Turn booking on for every channel at once.</p>
            </div>
            <Switch checked={settings.enabled} onCheckedChange={(v) => setSettings((s) => ({ ...s, enabled: v }))} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Working hours</Label>
              <Input value={settings.working_hours} onChange={(e) => setSettings((s) => ({ ...s, working_hours: e.target.value }))} placeholder="Mon to Sat, 10:00 to 18:00" />
            </div>
            <div className="space-y-1.5">
              <Label>Slot length (minutes)</Label>
              <Input type="number" value={settings.slot_minutes} onChange={(e) => setSettings((s) => ({ ...s, slot_minutes: Number(e.target.value) || 30 }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Timezone</Label>
              <Input value={settings.timezone} onChange={(e) => setSettings((s) => ({ ...s, timezone: e.target.value }))} placeholder="Asia/Dhaka" />
            </div>
            <div className="space-y-1.5">
              <Label>Bookable services</Label>
              <Input value={settings.services} onChange={(e) => setSettings((s) => ({ ...s, services: e.target.value }))} placeholder="Consultation, Test drive, Table for two" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Extra booking rules (optional)</Label>
            <Textarea rows={3} value={settings.instructions} onChange={(e) => setSettings((s) => ({ ...s, instructions: e.target.value }))}
              placeholder="e.g. Ask how many guests. No bookings on public holidays." />
          </div>
          <Button onClick={saveSettings} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Save settings
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Upcoming and recent</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : appts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No appointments yet. Once booking is on, requests from chats appear here.</p>
          ) : (
            <div className="space-y-3">
              {appts.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{a.customer_name || "Customer"}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${STATUS_STYLES[a.status] || "bg-slate-100"}`}>{a.status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {(a.service || "Appointment")} · {fmt(a.starts_at)}{a.customer_contact ? ` · ${a.customer_contact}` : ""}
                    </p>
                    {a.notes && <p className="text-xs text-muted-foreground mt-0.5">{a.notes}</p>}
                  </div>
                  <div className="flex gap-1.5">
                    {a.status !== "confirmed" && (
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => setStatus(a.id, "confirmed")}>
                        <Check className="h-3.5 w-3.5" />Confirm
                      </Button>
                    )}
                    {a.status !== "completed" && (
                      <Button size="sm" variant="outline" onClick={() => setStatus(a.id, "completed")}>Done</Button>
                    )}
                    {a.status !== "cancelled" && (
                      <Button size="sm" variant="ghost" className="text-red-600 gap-1" onClick={() => setStatus(a.id, "cancelled")}>
                        <X className="h-3.5 w-3.5" />Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
