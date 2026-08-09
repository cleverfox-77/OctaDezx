import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PhoneIncoming, PhoneOutgoing, Play, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import ChatTranscript, { type TranscriptMessage } from "@/components/ChatTranscript";

export interface VoiceCall {
  id: string;
  session_id: string | null;
  direction: "inbound" | "outbound";
  from_e164: string | null;
  to_e164: string | null;
  status: string;
  disposition: string | null;
  answered_by: string | null;
  started_at: string;
  duration_seconds: number;
  recording_path: string | null;
}

const DISPOSITION_STYLES: Record<string, string> = {
  ai_handled: "bg-green-100 text-green-800",
  escalated_to_human: "bg-amber-100 text-amber-800",
  voicemail: "bg-blue-100 text-blue-800",
  abandoned: "bg-slate-200 text-slate-700",
  machine: "bg-slate-200 text-slate-700",
  failed: "bg-red-100 text-red-700",
  over_limit: "bg-red-100 text-red-700",
};

const DISPOSITION_LABELS: Record<string, string> = {
  ai_handled: "Handled by AI",
  escalated_to_human: "Passed to your team",
  voicemail: "Left a voicemail",
  abandoned: "No answer",
  machine: "Answering machine",
  failed: "Failed",
  over_limit: "Out of minutes",
};

export const formatDuration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.max(seconds, 0) % 60).padStart(2, "0")}`;

export default function CallHistory({ businessId }: { businessId: string }) {
  const db = supabase as any;
  const [calls, setCalls] = useState<VoiceCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<VoiceCall | null>(null);
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!businessId) return;
    (async () => {
      setLoading(true);
      const { data } = await db.from("voice_calls").select("*")
        .eq("business_id", businessId).order("started_at", { ascending: false }).limit(200);
      setCalls((data ?? []) as VoiceCall[]);
      setLoading(false);
    })();
  }, [businessId]);

  const openCall = async (call: VoiceCall) => {
    setOpen(call);
    setMessages([]);
    setAudioUrl(null);
    if (!call.session_id) return;

    setLoadingTranscript(true);
    const { data } = await db.from("chat_messages")
      .select("id, content, sender_type, created_at, metadata")
      .eq("session_id", call.session_id).order("created_at", { ascending: true });
    setMessages((data ?? []) as TranscriptMessage[]);
    setLoadingTranscript(false);

    // The bucket is private, so playback needs a short-lived signed URL rather
    // than a public link that would outlive the dialog.
    if (call.recording_path) {
      const { data: signed } = await db.storage.from("call-recordings")
        .createSignedUrl(call.recording_path, 300);
      if (signed?.signedUrl) setAudioUrl(signed.signedUrl);
    }
  };

  if (loading) return <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;

  if (!calls.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">No calls yet</CardTitle>
          <CardDescription>
            Once a phone number is connected and voice is switched on, every call
            appears here with a full transcript.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {calls.map((call) => {
          const peer = call.direction === "inbound" ? call.from_e164 : call.to_e164;
          return (
            <Card key={call.id} className="cursor-pointer transition-colors hover:bg-muted/50" onClick={() => openCall(call)}>
              <CardContent className="flex flex-wrap items-center gap-3 py-4">
                {call.direction === "inbound"
                  ? <PhoneIncoming className="h-4 w-4 shrink-0 text-green-600" />
                  : <PhoneOutgoing className="h-4 w-4 shrink-0 text-blue-600" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{peer || "Unknown number"}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(call.started_at), { addSuffix: true })}
                    {" • "}{formatDuration(call.duration_seconds)}
                  </div>
                </div>
                {call.recording_path && <Play className="h-4 w-4 text-muted-foreground" />}
                {call.disposition && (
                  <Badge className={DISPOSITION_STYLES[call.disposition] ?? ""} variant="secondary">
                    {DISPOSITION_LABELS[call.disposition] ?? call.disposition}
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {open?.direction === "inbound" ? "Call from " : "Call to "}
              {(open?.direction === "inbound" ? open?.from_e164 : open?.to_e164) || "unknown number"}
            </DialogTitle>
            <DialogDescription>
              {open && `${formatDuration(open.duration_seconds)} • ${DISPOSITION_LABELS[open.disposition ?? ""] ?? open.status}`}
            </DialogDescription>
          </DialogHeader>

          {audioUrl && (
            <audio controls src={audioUrl} className="w-full">
              Your browser cannot play this recording.
            </audio>
          )}

          {loadingTranscript
            ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
            : <ChatTranscript
                messages={messages}
                customerName={open?.direction === "inbound" ? open?.from_e164 : open?.to_e164}
                className="h-[50vh] pr-4"
                emptyText="This call has no transcript. It may have gone straight to voicemail."
              />}

          {open?.session_id && (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" asChild>
                <a href="#chats" onClick={() => setOpen(null)}>Open the full conversation</a>
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
