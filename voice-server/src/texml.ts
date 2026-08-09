/**
 * TeXML builders.
 *
 * TeXML is Telnyx's TwiML-compatible dialect, so most of this is unchanged from
 * the Twilio version: Say, Record, Dial, Gather, Reject, Pause and Redirect all
 * behave the same. The one verb that genuinely differs is Stream, below.
 *
 * Voicemail deliberately uses the carrier's native <Record> rather than our
 * media server: Telnyx already handles the beep, silence detection and max
 * length, and doing it ourselves would buy nothing while adding failure modes.
 */

const esc = (s: string) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
           .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const wrap = (inner: string) => `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;

/**
 * Hand the call to the media server's WebSocket for real-time conversation.
 *
 * Every attribute here is load bearing:
 *
 *  - bidirectionalMode="rtp" is what makes the socket two way at all. The
 *    default is "mp3", which accepts whole audio files at roughly one per
 *    second and cannot carry a live conversation.
 *  - codec and bidirectionalCodec pin both directions to PCMU 8 kHz. This is
 *    usually the default for a PSTN leg, but the STT stream and the 20 ms frame
 *    arithmetic both assume it, so it is stated rather than inherited.
 *  - track="inbound_track" keeps our own speech out of the stream we transcribe.
 *    With both_tracks the agent hears itself and barges in on its own voice.
 */
export function connectStream(wsUrl: string, announcement?: string): string {
  // The recording announcement is spoken by the carrier, not by our TTS: it
  // must be deterministic and must not depend on a vendor being up.
  const say = announcement ? `<Say>${esc(announcement)}</Say>` : "";
  return wrap(
    `${say}<Connect>` +
      `<Stream url="${esc(wsUrl)}" track="inbound_track" codec="PCMU" ` +
        `bidirectionalMode="rtp" bidirectionalCodec="PCMU" bidirectionalSamplingRate="8000"/>` +
    `</Connect>`,
  );
}

/** Consent gate for two-party jurisdictions. */
export function consentGather(actionUrl: string, announcement: string): string {
  return wrap(
    `<Gather numDigits="1" action="${esc(actionUrl)}" method="POST" timeout="6">` +
      `<Say>${esc(announcement)} Press 1 to carry on, or 2 to carry on without recording.</Say>` +
    `</Gather>` +
    // No key pressed: proceed without recording, the conservative default.
    `<Redirect method="POST">${esc(actionUrl)}?Digits=2</Redirect>`,
  );
}

export function voicemail(opts: {
  greeting: string;
  actionUrl: string;
  recordingStatusUrl: string;
  maxSeconds: number;
}): string {
  return wrap(
    `<Say>${esc(opts.greeting)}</Say>` +
    `<Record maxLength="${opts.maxSeconds}" playBeep="true" trim="trim-silence" ` +
      `timeout="5" transcribe="false" ` +
      `action="${esc(opts.actionUrl)}" method="POST" ` +
      `recordingStatusCallback="${esc(opts.recordingStatusUrl)}" ` +
      `recordingStatusCallbackMethod="POST"/>` +
    `<Say>We did not get a message. Goodbye.</Say><Hangup/>`,
  );
}

/**
 * Transfer to a human. The action callback is what stops a busy or unanswered
 * transfer from simply dropping the caller.
 */
export function dialHuman(e164: string, actionUrl: string, sayFirst?: string): string {
  const say = sayFirst ? `<Say>${esc(sayFirst)}</Say>` : "";
  return wrap(
    `${say}<Dial timeout="25" action="${esc(actionUrl)}" method="POST">${esc(e164)}</Dial>`,
  );
}

export function sayAndHangup(text: string): string {
  return wrap(`<Say>${esc(text)}</Say><Hangup/>`);
}

export function reject(reason: "rejected" | "busy" = "rejected"): string {
  return wrap(`<Reject reason="${reason}"/>`);
}

/** Outbound leg that reached an answering machine. */
export function leaveMachineMessage(text: string): string {
  return wrap(`<Pause length="1"/><Say>${esc(text)}</Say><Hangup/>`);
}
