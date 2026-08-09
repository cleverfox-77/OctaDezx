import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PhoneCall, Sparkles } from "lucide-react";
import { useSubscription, VOICE_MINUTES, VOICE_PLANS } from "@/hooks/useSubscription";
import CallHistory from "./CallHistory";
import VoicemailInbox from "./VoicemailInbox";
import PhoneNumbers from "./PhoneNumbers";
import BusinessHours from "./BusinessHours";
import OutboundQueue from "./OutboundQueue";
import LiveCalls from "./LiveCalls";
import VoiceSettingsPanel, { type VoiceSettings } from "./VoiceSettingsPanel";
import VoiceSetupChecklist from "./VoiceSetupChecklist";

export default function VoiceCenter({ businessId }: { businessId: string }) {
  const db = supabase as any;
  const { planType } = useSubscription();
  const [settings, setSettings] = useState<VoiceSettings | null>(null);
  const [unread, setUnread] = useState(0);
  const [usedSeconds, setUsedSeconds] = useState(0);
  const [numberCount, setNumberCount] = useState(0);
  const [hoursCount, setHoursCount] = useState(0);
  const [callCount, setCallCount] = useState(0);
  // Controlled so the setup checklist can send someone straight to the tab
  // that finishes the step they are on.
  const [tab, setTab] = useState("calls");

  const canUseVoice = VOICE_PLANS.includes(planType);
  // Enterprise is metered rather than capped, so it has no included figure and
  // the bar below becomes a plain count instead of a progress bar.
  const metered = planType === "enterprise";
  const allowanceMinutes = VOICE_MINUTES[planType] ?? 0;
  const usedMinutes = Math.floor(usedSeconds / 60);

  const load = useCallback(async () => {
    const month = new Date();
    const firstOfMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1))
      .toISOString().slice(0, 10);

    const [{ data: s }, { data: usage }, { count }, { count: hours }, { count: calls }] = await Promise.all([
      db.from("voice_settings").select("*").eq("business_id", businessId).maybeSingle(),
      db.from("voice_usage_monthly").select("seconds_used")
        .eq("business_id", businessId).eq("usage_month", firstOfMonth).maybeSingle(),
      db.from("voice_phone_numbers").select("id", { count: "exact", head: true })
        .eq("business_id", businessId).eq("status", "active"),
      db.from("voice_business_hours").select("business_id", { count: "exact", head: true })
        .eq("business_id", businessId),
      db.from("voice_calls").select("id", { count: "exact", head: true })
        .eq("business_id", businessId),
    ]);
    setSettings((s ?? null) as VoiceSettings | null);
    setUsedSeconds(usage?.seconds_used ?? 0);
    setNumberCount(count ?? 0);
    setHoursCount(hours ?? 0);
    setCallCount(calls ?? 0);
  }, [businessId]);

  useEffect(() => { if (businessId) load(); }, [businessId, load]);

  if (!canUseVoice) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PhoneCall className="h-4 w-4" /> Voice comes with every paid plan
          </CardTitle>
          <CardDescription>
            Give your AI a phone number and it answers calls in real time, takes voicemails
            when you are closed, and writes every call down as plain text in the same history
            as your chats.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>Starter includes 100 minutes a month</li>
            <li>Pro includes 400 minutes</li>
            <li>Advanced includes 900 minutes</li>
            <li>Enterprise is metered at $0.12 a minute with no cap</li>
          </ul>
          <Button asChild>
            <a href="/pricing"><Sparkles className="mr-2 h-4 w-4" /> See the plans</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const pct = allowanceMinutes ? Math.min(100, (usedMinutes / allowanceMinutes) * 100) : 0;

  return (
    <div className="space-y-6">
      <VoiceSetupChecklist
        state={{
          hasNumber: numberCount > 0,
          hasHours: hoursCount > 0,
          answering: !!settings?.enabled,
          hasCall: callCount > 0,
        }}
        onGoToTab={setTab}
      />

      <Card>
        <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
          <div className="min-w-0 flex-1 sm:min-w-[200px]">
            <div className="mb-1 flex items-center justify-between gap-2 text-sm">
              <span className="font-medium">Voice minutes this month</span>
              <span className="shrink-0 text-muted-foreground">
                {metered ? `${usedMinutes} used` : `${usedMinutes} of ${allowanceMinutes}`}
              </span>
            </div>
            {!metered && <Progress value={pct} />}
            {!metered && pct >= 80 && (
              <p className="mt-1 text-xs text-amber-700">
                You are close to your monthly minutes. Calls go to voicemail once they run out.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Badge variant={settings?.enabled ? "secondary" : "outline"}>
              {settings?.enabled ? "Answering calls" : "Not answering"}
            </Badge>
            <Badge variant="outline">{numberCount} number{numberCount === 1 ? "" : "s"}</Badge>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        {/* Seven tabs wrap into three stacked rows on a phone. A single
            horizontally scrollable strip keeps them one row at any width. */}
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList className="inline-flex w-max">
            <TabsTrigger value="calls">Calls</TabsTrigger>
            <TabsTrigger value="live">Live</TabsTrigger>
            <TabsTrigger value="voicemail">
              Voicemail{unread > 0 && <span className="ml-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{unread}</span>}
            </TabsTrigger>
            <TabsTrigger value="numbers">Numbers</TabsTrigger>
            <TabsTrigger value="hours">Hours</TabsTrigger>
            <TabsTrigger value="outbound">Outbound</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="calls" className="mt-4"><CallHistory businessId={businessId} /></TabsContent>
        <TabsContent value="live" className="mt-4"><LiveCalls businessId={businessId} /></TabsContent>
        <TabsContent value="voicemail" className="mt-4">
          <VoicemailInbox businessId={businessId} onUnreadChange={setUnread} />
        </TabsContent>
        <TabsContent value="numbers" className="mt-4">
          {/* onChanged reloads the counts so the checklist ticks a step off the
              moment it actually happens, rather than on the next page visit. */}
          <PhoneNumbers businessId={businessId} canUseVoice={canUseVoice} onChanged={load} />
        </TabsContent>
        <TabsContent value="hours" className="mt-4">
          <BusinessHours businessId={businessId} onChanged={load} />
        </TabsContent>
        <TabsContent value="outbound" className="mt-4">
          <OutboundQueue businessId={businessId} settings={settings}
                         canUseVoice={canUseVoice} onSettingsChanged={load} />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <VoiceSettingsPanel businessId={businessId} settings={settings} onSaved={setSettings} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
