import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Volume2 } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import { callVoiceAdmin } from "./voiceApi";

export interface VoiceSettings {
  business_id: string;
  enabled: boolean;
  greeting: string;
  tts_provider: string;
  tts_voice: string;
  language: string;
  timezone: string;
  max_call_seconds: number;
  record_calls: boolean;
  consent_mode: "off" | "announce" | "announce_and_require_ack";
  recording_announcement: string;
  retention_days: number;
  transfer_enabled: boolean;
  transfer_e164: string | null;
  voicemail_enabled: boolean;
  voicemail_greeting: string;
  voicemail_max_seconds: number;
  after_hours_action: "voicemail" | "ai" | "transfer" | "hangup";
  outbound_enabled: boolean;
  outbound_window_start: string;
  outbound_window_end: string;
  amd_enabled: boolean;
  amd_message: string;

  persona_name: string | null;
  persona_role: string | null;
  persona_style: string;
  outbound_greeting: string;
  inbound_instructions: string;
  outbound_instructions: string;
  outbound_script: string;
  disclose_ai: boolean;
  include_opt_out: boolean;
  can_book_appointments: boolean;
  can_take_orders: boolean;
  can_answer_questions: boolean;
}

export const DEFAULT_SETTINGS: VoiceSettings = {
  business_id: "",
  enabled: false,
  greeting: "Hi, thanks for calling. How can I help?",
  tts_provider: "deepgram",
  tts_voice: "aura-2-thalia-en",
  language: "en",
  timezone: "UTC",
  max_call_seconds: 600,
  record_calls: false,
  consent_mode: "announce",
  recording_announcement: "This call may be recorded for quality and training.",
  retention_days: 30,
  transfer_enabled: false,
  transfer_e164: "",
  voicemail_enabled: true,
  voicemail_greeting: "Sorry we missed you. Please leave a message after the tone and we will get back to you.",
  voicemail_max_seconds: 120,
  after_hours_action: "voicemail",
  outbound_enabled: false,
  outbound_window_start: "09:00",
  outbound_window_end: "20:00",
  amd_enabled: true,
  amd_message: "Hi, sorry we missed you. Please give us a call back when you get a chance.",

  persona_name: "",
  persona_role: "",
  persona_style: "Warm, natural and easy to talk to. Sounds like a real colleague, not a script.",
  outbound_greeting: "Hi, sorry to call out of the blue. Do you have a quick minute?",
  inbound_instructions: "",
  outbound_instructions: "",
  outbound_script: "",
  disclose_ai: false,
  include_opt_out: false,
  can_book_appointments: true,
  can_take_orders: true,
  can_answer_questions: true,
};

const VOICES = [
  { id: "aura-2-thalia-en", label: "Thalia, clear and warm" },
  { id: "aura-2-andromeda-en", label: "Andromeda, calm and even" },
  { id: "aura-2-apollo-en", label: "Apollo, confident" },
  { id: "aura-2-arcas-en", label: "Arcas, friendly" },
  { id: "aura-2-asteria-en", label: "Asteria, bright" },
  { id: "aura-2-orion-en", label: "Orion, deep and steady" },
];

const AFTER_HOURS = [
  { id: "voicemail", label: "Take a voicemail" },
  { id: "ai", label: "Let the AI answer anyway" },
  { id: "transfer", label: "Transfer to a person" },
  { id: "hangup", label: "Politely end the call" },
];

const PERSONA_STYLES = [
  "Warm, natural and easy to talk to. Sounds like a real colleague, not a script.",
  "Friendly and upbeat. Quick, chatty, gets things moving.",
  "Calm and professional. Measured, precise, never rushed.",
  "Direct and efficient. Short answers, no small talk.",
];

export default function VoiceSettingsPanel({
  businessId, settings, onSaved,
}: { businessId: string; settings: VoiceSettings | null; onSaved: (s: VoiceSettings) => void }) {
  const db = supabase as any;
  const { toast } = useToast();
  const [form, setForm] = useState<VoiceSettings>({ ...DEFAULT_SETTINGS, business_id: businessId });
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (settings) setForm({ ...DEFAULT_SETTINGS, ...settings, business_id: businessId });
  }, [settings, businessId]);

  const set = <K extends keyof VoiceSettings>(k: K, v: VoiceSettings[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    const { error } = await db.from("voice_settings")
      .upsert({ ...form, business_id: businessId, transfer_e164: form.transfer_e164 || null,
                updated_at: new Date().toISOString() }, { onConflict: "business_id" });
    setSaving(false);
    if (error) { toast({ title: "Could not save", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Voice settings saved" });
    onSaved(form);
  };

  const preview = async () => {
    setPreviewing(true);
    try {
      const res = await callVoiceAdmin("preview", {
        business_id: businessId, voice: form.tts_voice, text: form.greeting.slice(0, 200),
      });
      const audio = new Audio(`data:${res.mime};base64,${res.audio_base64}`);
      audioRef.current = audio;
      await audio.play();
    } catch (e: any) {
      toast({ title: "Preview failed", description: e.message, variant: "destructive" });
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How your assistant answers</CardTitle>
          <CardDescription>What callers hear first, and in whose voice.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm font-medium">Answer incoming calls</Label>
              <p className="text-xs text-muted-foreground">Turn this off to send every caller to voicemail.</p>
            </div>
            <Switch checked={form.enabled} onCheckedChange={(v) => set("enabled", v)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="greeting">Greeting for calls coming in</Label>
            <Textarea id="greeting" rows={2} value={form.greeting} onChange={(e) => set("greeting", e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Spoken when someone rings you. Calls you make have their own opener, further down.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Voice</Label>
              <div className="flex gap-2">
                <Select value={form.tts_voice} onValueChange={(v) => set("tts_voice", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VOICES.map((v) => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={preview} disabled={previewing} aria-label="Preview voice">
                  {previewing
                    ? <ThinkingOrb state="composing" size={20} aria-label="Making the sample" />
                    : <Volume2 className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tz">Timezone</Label>
              <Input id="tz" value={form.timezone} onChange={(e) => set("timezone", e.target.value)}
                     placeholder="Asia/Dhaka" />
              <p className="text-xs text-muted-foreground">Used for your opening hours and calling window.</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="maxlen">Longest call (minutes)</Label>
            <Input id="maxlen" type="number" min={1} max={30}
                   value={Math.round(form.max_call_seconds / 60)}
                   onChange={(e) => set("max_call_seconds", Math.max(1, Number(e.target.value)) * 60)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Who your caller thinks they are speaking to</CardTitle>
          <CardDescription>
            Give the assistant a name and a manner and it stops sounding like a menu.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pname">Name</Label>
              <Input id="pname" value={form.persona_name ?? ""} placeholder="e.g. Maya"
                     onChange={(e) => set("persona_name", e.target.value)} />
              <p className="text-xs text-muted-foreground">Leave blank and it just speaks for the business.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prole">Job title</Label>
              <Input id="prole" value={form.persona_role ?? ""} placeholder="e.g. front desk"
                     onChange={(e) => set("persona_role", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pstyle">Manner</Label>
            <Textarea id="pstyle" rows={2} value={form.persona_style}
                      onChange={(e) => set("persona_style", e.target.value)} />
            <div className="flex flex-wrap gap-2 pt-1">
              {PERSONA_STYLES.map((s) => (
                <Button key={s} type="button" variant="outline" size="sm" className="h-7 text-xs"
                        onClick={() => set("persona_style", s)}>
                  {s.split(".")[0]}
                </Button>
              ))}
            </div>
          </div>

          {/* Both of these were previously hardcoded into every call. They are
              settings now, and the wording says what each one is actually for
              so the choice is made with the facts rather than blind. */}
          <div className="flex items-start justify-between gap-4 rounded-md border p-3">
            <div className="min-w-0">
              <Label className="text-sm font-medium">Say that it is automated</Label>
              <p className="text-xs text-muted-foreground">
                When on, the assistant tells callers it is automated if asked, and says so up front on
                calls you place. California and the EU require this for some businesses and customers.
              </p>
            </div>
            <Switch checked={form.disclose_ai} onCheckedChange={(v) => set("disclose_ai", v)} />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-md border p-3">
            <div className="min-w-0">
              <Label className="text-sm font-medium">Offer an opt-out on calls you make</Label>
              <p className="text-xs text-muted-foreground">
                Adds "just say stop calling" to the opener. US rules expect this on automated outbound
                calls. Saying stop calling always works either way, this only decides whether it is offered aloud.
              </p>
            </div>
            <Switch checked={form.include_opt_out} onCheckedChange={(v) => set("include_opt_out", v)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Train your assistant</CardTitle>
          <CardDescription>
            Plain instructions in your own words. Answering someone who rang you and ringing someone
            yourself are different jobs, so they are trained separately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="inb">When someone calls you</Label>
            <Textarea id="inb" rows={4} value={form.inbound_instructions}
                      onChange={(e) => set("inbound_instructions", e.target.value)}
                      placeholder={"e.g. Always ask which branch they mean before quoting a price.\nIf they mention a complaint, take their number and promise a call back within the hour."} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="outb">When you call someone</Label>
            <Textarea id="outb" rows={4} value={form.outbound_instructions}
                      onChange={(e) => set("outbound_instructions", e.target.value)}
                      placeholder={"e.g. Keep it under two minutes.\nIf they sound busy, offer to call back tomorrow and let them go."} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ogreet">Opener for calls you make</Label>
            <Textarea id="ogreet" rows={2} value={form.outbound_greeting}
                      onChange={(e) => set("outbound_greeting", e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Use {"{{name}}"} for the assistant's name and {"{{business}}"} for your business name.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="oscript">Default reason for calling</Label>
            <Textarea id="oscript" rows={3} value={form.outbound_script}
                      onChange={(e) => set("outbound_script", e.target.value)}
                      placeholder="e.g. Following up on a quote we sent in the last week." />
            <p className="text-xs text-muted-foreground">
              Used when a queued call has nothing written in its own "what the call is about" box.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What it can do on a call</CardTitle>
          <CardDescription>
            With these on, the assistant finishes the job on the phone instead of describing it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {([
            ["can_book_appointments", "Book appointments",
              "Takes the name, day and time, reads it back, and files the booking before hanging up."],
            ["can_take_orders", "Take orders",
              "Only from your product list, with the whole order read back before it is confirmed."],
            ["can_answer_questions", "Answer questions",
              "Uses your knowledge base and product details. Says it will check rather than guessing."],
          ] as const).map(([key, title, desc]) => (
            <div key={key} className="flex items-start justify-between gap-4 rounded-md border p-3">
              <div className="min-w-0">
                <Label className="text-sm font-medium">{title}</Label>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Switch checked={form[key]} onCheckedChange={(v) => set(key, v)} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">When you are closed or busy</CardTitle>
          <CardDescription>What happens when nobody is around.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Out of hours</Label>
            <Select value={form.after_hours_action} onValueChange={(v) => set("after_hours_action", v as VoiceSettings["after_hours_action"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {AFTER_HOURS.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm font-medium">Take voicemails</Label>
              <p className="text-xs text-muted-foreground">Transcribed and delivered to your inbox.</p>
            </div>
            <Switch checked={form.voicemail_enabled} onCheckedChange={(v) => set("voicemail_enabled", v)} />
          </div>

          {form.voicemail_enabled && (
            <div className="space-y-1.5">
              <Label htmlFor="vmg">Voicemail greeting</Label>
              <Textarea id="vmg" rows={2} value={form.voicemail_greeting}
                        onChange={(e) => set("voicemail_greeting", e.target.value)} />
            </div>
          )}

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm font-medium">Transfer to a person</Label>
              <p className="text-xs text-muted-foreground">Used when the AI hands over, or out of hours if you chose transfer.</p>
            </div>
            <Switch checked={form.transfer_enabled} onCheckedChange={(v) => set("transfer_enabled", v)} />
          </div>

          {form.transfer_enabled && (
            <div className="space-y-1.5">
              <Label htmlFor="xfer">Transfer to</Label>
              <Input id="xfer" value={form.transfer_e164 ?? ""} placeholder="+8801700000000"
                     onChange={(e) => set("transfer_e164", e.target.value)} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recording and privacy</CardTitle>
          <CardDescription>
            Recording law varies by country and, in the United States, by state. When in
            doubt, announce it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm font-medium">Record calls</Label>
              <p className="text-xs text-muted-foreground">Transcripts are always kept. This is about the audio.</p>
            </div>
            <Switch checked={form.record_calls} onCheckedChange={(v) => set("record_calls", v)} />
          </div>

          {form.record_calls && (
            <>
              <div className="space-y-1.5">
                <Label>Consent</Label>
                <Select value={form.consent_mode} onValueChange={(v) => set("consent_mode", v as VoiceSettings["consent_mode"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="announce">Announce that the call may be recorded</SelectItem>
                    <SelectItem value="announce_and_require_ack">Announce and ask them to press 1</SelectItem>
                    <SelectItem value="off">Do not announce (only where this is lawful)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ann">Announcement</Label>
                <Input id="ann" value={form.recording_announcement}
                       onChange={(e) => set("recording_announcement", e.target.value)} />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ret">Keep audio for (days)</Label>
            <Input id="ret" type="number" min={1} max={365} value={form.retention_days}
                   onChange={(e) => set("retention_days", Math.min(365, Math.max(1, Number(e.target.value)))) } />
            <p className="text-xs text-muted-foreground">
              After this, the recording is deleted. The transcript stays.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save settings
        </Button>
      </div>
    </div>
  );
}
