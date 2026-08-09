import { ThinkingOrb, type OrbState, type OrbSize, type OrbTheme } from "thinking-orbs";

/**
 * The app's one place for "something is happening and it has a character".
 *
 * Deliberately not a replacement for every spinner. A button that is saving
 * wants a small spinner inside it; swapping that for an animated canvas costs
 * more than it says. These orbs earn their place where the wait is long enough
 * to look at and the activity is worth naming: the assistant thinking, a call
 * being listened to, speech being synthesised, a carrier being searched.
 *
 * The state names are the library's and they are the point. Picking `listening`
 * for a live call rather than a generic spinner tells the owner what the AI is
 * doing, which is the thing they are anxious about.
 */
export function Thinking({
  state = "working",
  size = 64,
  label,
  theme,
  className,
  center,
}: {
  state?: OrbState;
  size?: OrbSize;
  /** Read out to screen readers and shown beside the orb when provided. */
  label?: string;
  /**
   * Leave unset to inherit the page. Pin it only where a surface hardcodes its
   * own colours instead of following the theme, or the ink comes out invisible.
   */
  theme?: OrbTheme;
  className?: string;
  center?: boolean;
}) {
  return (
    <div
      className={[
        "flex items-center gap-3",
        center ? "flex-col justify-center py-8 text-center" : "",
        className ?? "",
      ].filter(Boolean).join(" ")}
    >
      <ThinkingOrb
        state={state}
        size={size}
        theme={theme}
        aria-label={label ?? state}
        style={{ flexShrink: 0 }}
      />
      {label && (
        <span className={size === 20 ? "text-sm text-muted-foreground" : "text-sm text-muted-foreground"}>
          {label}
        </span>
      )}
    </div>
  );
}
