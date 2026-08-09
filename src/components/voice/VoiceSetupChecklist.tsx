/**
 * What to do next, for someone who has never set up a phone system.
 *
 * The Voice section is seven tabs deep, and a new owner lands on an empty call
 * list with no indication that a number has to be bought before anything can
 * happen. This turns that into four plain steps.
 *
 * Every step is derived from real database state rather than a stored "step 3
 * complete" flag. That means it cannot drift out of sync with reality, it is
 * correct for a business set up by somebody else, and releasing the last number
 * honestly puts step one back to incomplete.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, ChevronRight, PartyPopper } from "lucide-react";

export interface SetupState {
  hasNumber: boolean;
  hasHours: boolean;
  answering: boolean;
  hasCall: boolean;
}

interface Step {
  key: keyof SetupState;
  title: string;
  /** Why this matters, in words an owner can act on. */
  detail: string;
  action: string;
  tab: string;
  /** A step the assistant works without, so the owner is not blocked by it. */
  optional?: boolean;
}

const STEPS: Step[] = [
  {
    key: "hasNumber",
    title: "Get a phone number",
    detail: "This is the number your customers will call. Pick a country and we do the rest.",
    action: "Choose a number",
    tab: "numbers",
  },
  {
    key: "hasHours",
    title: "Set your opening hours",
    detail:
      "Callers outside these hours get your voicemail instead. Skip this and the assistant answers day and night.",
    action: "Set hours",
    tab: "hours",
    optional: true,
  },
  {
    key: "answering",
    title: "Turn answering on",
    detail: "Check the greeting sounds like your business, then switch the assistant on.",
    action: "Open settings",
    tab: "settings",
  },
  {
    key: "hasCall",
    title: "Call your number",
    detail:
      "Ring it from your own phone. The conversation appears in your call history as text, word for word.",
    action: "See call history",
    tab: "calls",
  },
];

export default function VoiceSetupChecklist({
  state,
  onGoToTab,
}: {
  state: SetupState;
  onGoToTab: (tab: string) => void;
}) {
  const done = STEPS.filter((s) => state[s.key]).length;

  // Once everything is done the card is just clutter on every future visit.
  if (done === STEPS.length) return null;

  // The first thing not yet done. Highlighting one step at a time is the whole
  // point: a list of four equally weighted tasks is what caused the confusion.
  const current = STEPS.find((s) => !state[s.key]);

  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {done === 0 ? <PartyPopper className="h-4 w-4 text-primary" /> : null}
          Finish setting up calls
        </CardTitle>
        <CardDescription>
          {done} of {STEPS.length} done. Takes about five minutes.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-2">
        {STEPS.map((step) => {
          const complete = state[step.key];
          const isCurrent = step === current;

          return (
            <div
              key={step.key}
              className={`flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center ${
                isCurrent ? "border-primary/40 bg-background" : "border-transparent"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                  complete
                    ? "bg-primary text-primary-foreground"
                    : "border border-muted-foreground/30 text-muted-foreground"
                }`}
                aria-hidden="true"
              >
                {complete ? <Check className="h-3.5 w-3.5" /> : STEPS.indexOf(step) + 1}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-sm font-medium ${complete ? "text-muted-foreground line-through" : ""}`}>
                    {step.title}
                  </span>
                  {step.optional && !complete && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      optional
                    </span>
                  )}
                </div>
                {!complete && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{step.detail}</p>
                )}
              </div>

              {!complete && (
                <Button
                  size="sm"
                  variant={isCurrent ? "default" : "outline"}
                  className="w-full sm:w-auto"
                  onClick={() => onGoToTab(step.tab)}
                >
                  {step.action}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
