import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import ChatTranscript, { type TranscriptMessage } from "@/components/ChatTranscript";
import { formatDuration } from "./CallHistory";

interface LiveCall {
  id: string;
  session_id: string | null;
  direction: "inbound" | "outbound";
  from_e164: string | null;
  to_e164: string | null;
  started_at: string;
}

/**
 * Calls happening right now, with the transcript filling in as people speak.
 *
 * Deliberately not live audio listen-in: silently joining a call raises consent
 * questions in every jurisdiction that regulates recording, and the transcript
 * is what an owner actually needs in order to decide whether to step in.
 */
export default function LiveCalls({ businessId }: { businessId: string }) {
  const db = supabase as any;
  const [calls, setCalls] = useState<LiveCall[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [now, setNow] = useState(Date.now());

  const loadCalls = useCallback(async () => {
    const { data } = await db.from("voice_calls")
      .select("id, session_id, direction, from_e164, to_e164, started_at")
      .eq("business_id", businessId).eq("status", "in_progress")
      .order("started_at", { ascending: false });
    const rows = (data ?? []) as LiveCall[];
    setCalls(rows);
    setSelected((cur) => (cur && rows.some((c) => c.id === cur) ? cur : rows[0]?.id ?? null));
  }, [businessId]);

  useEffect(() => { if (businessId) loadCalls(); }, [businessId, loadCalls]);

  // voice_calls is in the supabase_realtime publication (20260803000000), so
  // this is a push, not a poll.
  useEffect(() => {
    if (!businessId) return;
    const channel = supabase
      .channel("voice-live-calls")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "voice_calls", filter: `business_id=eq.${businessId}` },
        () => loadCalls())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [businessId, loadCalls]);

  const session = calls.find((c) => c.id === selected)?.session_id ?? null;

  const loadMessages = useCallback(async () => {
    if (!session) { setMessages([]); return; }
    const { data } = await db.from("chat_messages")
      .select("id, content, sender_type, created_at, metadata")
      .eq("session_id", session).order("created_at", { ascending: true });
    setMessages((data ?? []) as TranscriptMessage[]);
  }, [session]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`voice-live-transcript-${session}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `session_id=eq.${session}` },
        () => loadMessages())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session, loadMessages]);

  // Only ticking while something is live, so an idle tab does no work.
  useEffect(() => {
    if (!calls.length) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [calls.length]);

  if (!calls.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">No calls in progress</CardTitle>
          <CardDescription>Live calls appear here as they happen, with the transcript building in real time.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="space-y-2">
        {calls.map((call) => {
          const peer = call.direction === "inbound" ? call.from_e164 : call.to_e164;
          const elapsed = Math.floor((now - new Date(call.started_at).getTime()) / 1000);
          return (
            <Card key={call.id}
                  className={`cursor-pointer transition-colors ${selected === call.id ? "border-primary" : "hover:bg-muted/50"}`}
                  onClick={() => setSelected(call.id)}>
              <CardContent className="flex items-center gap-3 py-3">
                {call.direction === "inbound"
                  ? <PhoneIncoming className="h-4 w-4 shrink-0 text-green-600" />
                  : <PhoneOutgoing className="h-4 w-4 shrink-0 text-blue-600" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{peer || "Unknown"}</div>
                  <div className="text-xs text-muted-foreground">{formatDuration(elapsed)}</div>
                </div>
                {/* The orb says what the assistant is actually doing on this
                    call, which is the thing an owner watching this screen is
                    anxious about. A generic pulse only says "something". */}
                <Badge variant="secondary" className="gap-1.5 pl-1.5">
                  <ThinkingOrb state="listening" size={20} aria-label="Assistant is on this call" />
                  live
                </Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Transcript</CardTitle>
          <CardDescription>Updates as the call goes on.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChatTranscript
            messages={messages}
            className="h-[55vh] pr-4"
            emptyText="Waiting for the first words."
          />
        </CardContent>
      </Card>
    </div>
  );
}
