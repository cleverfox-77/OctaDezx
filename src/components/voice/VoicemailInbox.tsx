import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Voicemail, Check } from "lucide-react";
import { Thinking } from "@/components/ui/thinking";
import { formatDistanceToNow } from "date-fns";
import { formatDuration } from "./CallHistory";

interface VoicemailRow {
  id: string;
  from_e164: string | null;
  recording_path: string;
  duration_seconds: number | null;
  transcript: string | null;
  transcript_status: "pending" | "done" | "failed";
  reason: string | null;
  is_read: boolean;
  created_at: string;
}

const REASONS: Record<string, string> = {
  after_hours: "Called outside your hours",
  no_human_available: "Nobody picked up the transfer",
  caller_opted: "Asked to leave a message",
  overflow: "Too many calls at once",
  ai_unavailable: "Assistant unavailable",
  over_limit: "Out of voice minutes",
};

export default function VoicemailInbox({
  businessId, onUnreadChange,
}: { businessId: string; onUnreadChange?: (n: number) => void }) {
  const db = supabase as any;
  const [items, setItems] = useState<VoicemailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [playing, setPlaying] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await db.from("voice_voicemails").select("*")
      .eq("business_id", businessId).order("created_at", { ascending: false }).limit(100);
    const rows = (data ?? []) as VoicemailRow[];
    setItems(rows);
    onUnreadChange?.(rows.filter((v) => !v.is_read).length);
    setLoading(false);
  };

  useEffect(() => { if (businessId) load(); /* eslint-disable-next-line */ }, [businessId]);

  // Signed on demand: minting a URL for every voicemail on load would be a
  // burst of pointless requests for messages nobody opens.
  const listen = async (vm: VoicemailRow) => {
    if (urls[vm.id]) { setPlaying(vm.id); return; }
    setPlaying(vm.id);
    const { data } = await db.storage.from("call-recordings").createSignedUrl(vm.recording_path, 300);
    if (data?.signedUrl) setUrls((u) => ({ ...u, [vm.id]: data.signedUrl }));
  };

  const markRead = async (vm: VoicemailRow) => {
    await db.from("voice_voicemails").update({ is_read: true }).eq("id", vm.id);
    setItems((list) => list.map((v) => (v.id === vm.id ? { ...v, is_read: true } : v)));
    onUnreadChange?.(items.filter((v) => !v.is_read && v.id !== vm.id).length);
  };

  if (loading) return <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;

  if (!items.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">No voicemails</CardTitle>
          <CardDescription>
            Callers who reach you outside your hours, or when nobody picks up a
            transfer, can leave a message. It lands here transcribed.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((vm) => (
        <Card key={vm.id} className={vm.is_read ? "" : "border-primary/40"}>
          <CardContent className="space-y-3 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <Voicemail className="h-4 w-4 shrink-0 text-blue-600" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{vm.from_e164 || "Unknown number"}</div>
                <div className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(vm.created_at), { addSuffix: true })}
                  {vm.duration_seconds != null && ` • ${formatDuration(vm.duration_seconds)}`}
                  {vm.reason && ` • ${REASONS[vm.reason] ?? vm.reason}`}
                </div>
              </div>
              {!vm.is_read && <Badge variant="secondary">New</Badge>}
            </div>

            {vm.transcript_status === "done" && vm.transcript && (
              <p className="border-l-2 border-primary/40 pl-3 text-sm">{vm.transcript}</p>
            )}
            {vm.transcript_status === "pending" && (
              <Thinking state="listening" size={20} label="Transcribing" />
            )}
            {vm.transcript_status === "failed" && (
              <p className="text-sm text-muted-foreground">
                We could not transcribe this one. Listen to it instead.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {/* min-w on the player pushed the row past a 375px viewport.
                  Full width on a phone, shared with the buttons above that. */}
              {playing === vm.id && urls[vm.id]
                ? <audio controls autoPlay src={urls[vm.id]}
                         className="h-9 w-full min-w-0 sm:w-auto sm:flex-1" />
                : vm.recording_path
                  ? <Button size="sm" variant="outline" onClick={() => listen(vm)}>Listen</Button>
                  : <span className="text-xs text-muted-foreground">Audio has passed its retention window.</span>}
              {!vm.is_read && (
                <Button size="sm" variant="ghost" onClick={() => markRead(vm)}>
                  <Check className="mr-1 h-3 w-3" /> Mark read
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
