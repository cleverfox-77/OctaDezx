import { useEffect, useRef } from "react";

const SRC = "https://getlaunchlist.com/js/widget.js";

/**
 * GetLaunchList signup form.
 *
 * Their documented integration puts the script in <head> and the target div in
 * the page. That works when the markup is server rendered, but this app renders
 * on the client: a deferred script in <head> runs while #root is still the
 * crawler fallback, finds no .launchlist-widget to attach to, and quietly does
 * nothing. So the script is loaded here instead, after the div exists.
 *
 * Re-added on every mount rather than loaded once, because the widget scans for
 * targets when it executes and offers no public re-scan. Appending the element
 * again is what makes the form appear after a client-side route change; the
 * file itself comes from the browser cache, so this is not a second download.
 */
export default function LaunchListWidget({
  keyId,
  className = "",
}: {
  keyId: string;
  className?: string;
}) {
  const host = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // The widget injects its markup into the div. Clearing first keeps a
    // remount from stacking a second copy of the form underneath the first.
    if (host.current) host.current.innerHTML = "";

    document.querySelectorAll(`script[src="${SRC}"]`).forEach((s) => s.remove());

    const script = document.createElement("script");
    script.src = SRC;
    script.defer = true;
    document.head.appendChild(script);

    return () => { script.remove(); };
  }, [keyId]);

  return <div ref={host} className={`launchlist-widget ${className}`.trim()} data-key-id={keyId} />;
}
