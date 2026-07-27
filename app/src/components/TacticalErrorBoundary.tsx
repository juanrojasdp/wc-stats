"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { EmptyStatePanel } from "@/components/EmptyStatePanel";
import { useT } from "@/lib/i18n-provider";

/*
 * Containment for the Tactical Layer's deliberate fail-loud paths (2.5 review).
 *
 * @/lib/format throws on non-finite input by design — "never pre-sanitize" is
 * the right instinct, and it stays. What was missing is a floor under it: the
 * bundle is `as`-cast unvalidated JSON, MatchBundleRegion validates two scalars
 * before declaring success, and everything below then dereferences the payload
 * freely. One malformed numeric field, or one truncated object past the gate,
 * threw during render — outside the fetch promise, so the region's own "error"
 * branch could not catch it — and with no boundary anywhere under src/app/,
 * Next's default client-exception page replaced the whole route, taking the
 * BUILD-TIME Hero down with it.
 *
 * A story whose thesis is FR-22's honest absence must not answer a bad payload
 * with a blank page. This boundary sits below the Hero and around the layer
 * only, so a throw degrades to a named panel in the layer's slot while the
 * Hero, the site chrome and the language/theme controls stay usable.
 *
 * It lives in src/components/ rather than as an app/ error.tsx deliberately:
 * a route-level error.tsx replaces the entire segment including the Hero, and
 * client bodies under src/app/ escape the i18n import seam (a known gap this
 * story is told not to trigger).
 */

function TacticalErrorFallback() {
  const t = useT();
  return (
    <EmptyStatePanel
      headline={t("match.bundle.crashed")}
      explanation={t("match.bundle.crashedExplanation")}
    />
  );
}

export class TacticalErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Fail loud in the console — the throw is still a real defect upstream,
    // and swallowing it silently would trade one dishonesty for another.
    console.error("TacticalLayer render failed", error, info.componentStack);
  }

  render() {
    return this.state.failed ? <TacticalErrorFallback /> : this.props.children;
  }
}
