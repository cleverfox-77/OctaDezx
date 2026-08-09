import { formatDistanceToNow } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * The one transcript renderer.
 *
 * Chats and phone calls share chat_sessions and chat_messages, so they share
 * this too. A second renderer for calls would have drifted the moment either
 * one grew a feature.
 *
 * 'system' turns (call started, voicemail received, transferred) are events,
 * not speech, so they are shown as a centred note rather than a bubble from
 * either side.
 */
export interface TranscriptMessage {
  id: string;
  content: string;
  sender_type: "customer" | "ai" | "human" | "system";
  created_at: string;
  image_url?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface Props {
  messages: TranscriptMessage[];
  customerName?: string | null;
  /** Rendered after the last message, e.g. a scroll anchor. */
  footer?: React.ReactNode;
  className?: string;
  emptyText?: string;
}

const SENDER_STYLES: Record<string, string> = {
  customer: "bg-muted",
  ai: "bg-primary text-primary-foreground",
  human: "bg-secondary text-secondary-foreground",
};

export function ChatTranscript({
  messages, customerName, footer, className = "h-[60vh] pr-4",
  emptyText = "No messages yet.",
}: Props) {
  if (!messages.length) {
    return (
      <ScrollArea className={className}>
        <p className="py-8 text-center text-sm text-muted-foreground">{emptyText}</p>
        {footer}
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className={className}>
      <div className="space-y-4 py-4">
        {messages.map((message) => {
          if (message.sender_type === "system") {
            return (
              <div key={message.id} className="flex justify-center">
                <span className="rounded-full bg-muted/60 px-3 py-1 text-xs text-muted-foreground">
                  {message.content}
                </span>
              </div>
            );
          }

          const isCustomer = message.sender_type === "customer";
          const kind = (message.metadata as { kind?: string } | null)?.kind;

          return (
            <div key={message.id} className={`flex ${isCustomer ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[70%] rounded-lg p-3 break-words ${SENDER_STYLES[message.sender_type] ?? "bg-muted"}`}>
                <div className="mb-1 flex items-center gap-2 text-xs capitalize opacity-70">
                  <span>
                    {isCustomer
                      ? customerName || "Customer"
                      : message.sender_type === "ai" ? "AI Assistant" : "You"}
                  </span>
                  {/* Say where the words came from: a transcript reads very
                      differently once you know it was spoken, not typed. */}
                  {kind === "voicemail" && <span className="opacity-80">voicemail</span>}
                  {kind === "voice_note" && <span className="opacity-80">voice note</span>}
                  {kind === "voice_turn" && <span className="opacity-80">spoken</span>}
                </div>
                <div className="text-sm">{message.content}</div>
                {message.image_url && (
                  <img src={message.image_url} alt="Message attachment" className="mt-2 max-w-full rounded border" />
                )}
                <div className="mt-1 text-right text-xs opacity-70">
                  {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                </div>
              </div>
            </div>
          );
        })}
        {footer}
      </div>
    </ScrollArea>
  );
}

export default ChatTranscript;
