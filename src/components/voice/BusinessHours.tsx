import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Plus, Trash2 } from "lucide-react";

// 0 = Sunday, matching EXTRACT(DOW) which is_business_open uses.
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface HourRow { id?: string; day_of_week: number; opens_at: string; closes_at: string; }
interface Exception { id?: string; on_date: string; is_closed: boolean; label: string | null; }

const hhmm = (t: string) => (t ?? "").slice(0, 5);

export default function BusinessHours({
  businessId,
  onChanged,
}: {
  businessId: string;
  onChanged?: () => void;
}) {
  const db = supabase as any;
  const { toast } = useToast();
  const [rows, setRows] = useState<Record<number, HourRow | null>>({});
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: hours }, { data: exc }] = await Promise.all([
      db.from("voice_business_hours").select("*").eq("business_id", businessId).order("day_of_week"),
      db.from("voice_hours_exceptions").select("*").eq("business_id", businessId).order("on_date"),
    ]);
    const byDay: Record<number, HourRow | null> = {};
    for (let d = 0; d < 7; d++) byDay[d] = null;
    for (const h of (hours ?? []) as HourRow[]) {
      byDay[h.day_of_week] = { ...h, opens_at: hhmm(h.opens_at), closes_at: hhmm(h.closes_at) };
    }
    setRows(byDay);
    setExceptions((exc ?? []) as Exception[]);
    setLoading(false);
  };
  useEffect(() => { if (businessId) load(); /* eslint-disable-next-line */ }, [businessId]);

  const toggleDay = (day: number, open: boolean) =>
    setRows((r) => ({ ...r, [day]: open ? { day_of_week: day, opens_at: "09:00", closes_at: "18:00" } : null }));

  const setTime = (day: number, key: "opens_at" | "closes_at", value: string) =>
    setRows((r) => (r[day] ? { ...r, [day]: { ...r[day]!, [key]: value } } : r));

  const save = async () => {
    setSaving(true);
    // Replace rather than diff: seven rows is not worth a merge algorithm, and
    // a wrong diff here means the phone answers at the wrong time.
    const { error: delErr } = await db.from("voice_business_hours").delete().eq("business_id", businessId);
    if (delErr) {
      setSaving(false);
      toast({ title: "Could not save hours", description: delErr.message, variant: "destructive" });
      return;
    }
    const payload = Object.values(rows).filter(Boolean).map((h) => ({
      business_id: businessId, day_of_week: h!.day_of_week, opens_at: h!.opens_at, closes_at: h!.closes_at,
    }));
    if (payload.length) {
      const { error } = await db.from("voice_business_hours").insert(payload);
      if (error) {
        setSaving(false);
        toast({ title: "Could not save hours", description: error.message, variant: "destructive" });
        return;
      }
    }
    setSaving(false);
    toast({ title: "Hours saved" });
    load();
    onChanged?.();
  };

  const addException = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await db.from("voice_hours_exceptions")
      .upsert({ business_id: businessId, on_date: today, is_closed: true, label: "Closed" },
              { onConflict: "business_id,on_date" });
    if (error) toast({ title: "Could not add", description: error.message, variant: "destructive" });
    load();
  };

  const updateException = async (e: Exception, patch: Partial<Exception>) => {
    await db.from("voice_hours_exceptions").update(patch).eq("id", e.id);
    setExceptions((list) => list.map((x) => (x.id === e.id ? { ...x, ...patch } : x)));
  };

  const removeException = async (e: Exception) => {
    await db.from("voice_hours_exceptions").delete().eq("id", e.id);
    setExceptions((list) => list.filter((x) => x.id !== e.id));
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const anyOpen = Object.values(rows).some(Boolean);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Opening hours</CardTitle>
          <CardDescription>
            Calls outside these hours follow your out-of-hours setting.
            {!anyOpen && " With no hours set, the assistant answers around the clock."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* A day label plus two time pickers is wider than a phone screen in
              one row, so the times drop to their own line below sm. */}
          {DAYS.map((name, day) => (
            <div key={day} className="rounded-md border p-3">
              <div className="flex items-center gap-3">
                <Switch checked={!!rows[day]} onCheckedChange={(v) => toggleDay(day, v)} aria-label={name} />
                <span className="flex-1 text-sm font-medium sm:flex-none sm:w-24">{name}</span>
                {rows[day] ? (
                  <div className="hidden items-center gap-2 sm:flex">
                    <Input type="time" className="w-32" value={rows[day]!.opens_at}
                           onChange={(e) => setTime(day, "opens_at", e.target.value)}
                           aria-label={`${name} opening time`} />
                    <span className="text-sm text-muted-foreground">to</span>
                    <Input type="time" className="w-32" value={rows[day]!.closes_at}
                           onChange={(e) => setTime(day, "closes_at", e.target.value)}
                           aria-label={`${name} closing time`} />
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Closed</span>
                )}
              </div>

              {rows[day] && (
                <div className="mt-3 flex items-center gap-2 sm:hidden">
                  <Input type="time" className="min-w-0 flex-1" value={rows[day]!.opens_at}
                         onChange={(e) => setTime(day, "opens_at", e.target.value)}
                         aria-label={`${name} opening time`} />
                  <span className="text-sm text-muted-foreground">to</span>
                  <Input type="time" className="min-w-0 flex-1" value={rows[day]!.closes_at}
                         onChange={(e) => setTime(day, "closes_at", e.target.value)}
                         aria-label={`${name} closing time`} />
                </div>
              )}
            </div>
          ))}
          <div className="flex justify-end pt-2">
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save hours
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Holidays and one-off changes</CardTitle>
          <CardDescription>These override the weekly pattern for a single date.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {exceptions.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center gap-3 rounded-md border p-3">
              <Input type="date" className="w-full sm:w-40" value={e.on_date}
                     aria-label="Date"
                     onChange={(ev) => updateException(e, { on_date: ev.target.value })} />
              <Input className="min-w-0 flex-1" placeholder="Label, e.g. Eid holiday"
                     aria-label="Label"
                     value={e.label ?? ""} onChange={(ev) => updateException(e, { label: ev.target.value })} />
              <div className="flex items-center gap-2">
                <Switch id={`closed-${e.id}`} checked={e.is_closed}
                        onCheckedChange={(v) => updateException(e, { is_closed: v })} />
                <Label htmlFor={`closed-${e.id}`} className="text-sm">Closed</Label>
              </div>
              <Button size="sm" variant="ghost" aria-label="Remove this date"
                      onClick={() => removeException(e)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addException}>
            <Plus className="mr-2 h-4 w-4" /> Add a date
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
