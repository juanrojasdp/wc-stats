"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { EmptyStatePanel } from "@/components/EmptyStatePanel";
import type { DictionaryKey } from "@/lib/i18n";
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

/*
 * Story 2.18 ruled decision 7 makes this boundary reusable at PER-SECTION
 * granularity as well as whole-layer. The copy is opt-in and defaults with `??`
 * INSIDE the fallback rather than through defaultProps, so MatchBundleRegion's
 * call site stays byte-identical and the whole-layer mount keeps the exact
 * strings it shipped with. Neither prop name is on the sixteen-name gated list.
 *
 * The per-section copy is NOT match.bundle.crashed reused: that string names a
 * BUNDLE-level failure ("the tactical analysis for this match"), and a
 * bundle-wide fault surfacing as "we couldn't display this section" would be a
 * narrower and possibly false claim in one direction, while a section-level
 * fault claiming the whole analysis is gone is false in the other.
 */
function TacticalErrorFallback({
  headlineKey,
  explanationKey,
}: {
  headlineKey?: DictionaryKey;
  explanationKey?: DictionaryKey;
}) {
  const t = useT();
  return (
    <EmptyStatePanel
      headline={t(headlineKey ?? "match.bundle.crashed")}
      explanation={t(explanationKey ?? "match.bundle.crashedExplanation")}
    />
  );
}

/**
 * The console label's default — the exact string this boundary has logged
 * since Story 2.5, so the Tactical mount is byte-identical without it.
 */
const DEFAULT_LOG_LABEL = "TacticalLayer render failed";

export class TacticalErrorBoundary extends Component<
  {
    children: ReactNode;
    headlineKey?: DictionaryKey;
    explanationKey?: DictionaryKey;
    /*
     * Story 2.11b: two sibling instances now mount on the match route, and a
     * console line reading "TacticalLayer render failed" over an EXPERT crash
     * misdirects whoever reads it.
     *
     * NAMED `logLabel`, NOT `label` — `label` is one of the i18n gate's sixteen
     * gated prop names, so every call site passing a literal would fail
     * `eslint --max-warnings 0`. This string is a DEVELOPER-facing console
     * label, never user-visible copy, so it must not be routed through t().
     */
    logLabel?: string;
  },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Fail loud in the console — the throw is still a real defect upstream,
    // and swallowing it silently would trade one dishonesty for another.
    console.error(this.props.logLabel ?? DEFAULT_LOG_LABEL, error, info.componentStack);
  }

  render() {
    return this.state.failed ? (
      <TacticalErrorFallback
        headlineKey={this.props.headlineKey}
        explanationKey={this.props.explanationKey}
      />
    ) : (
      this.props.children
    );
  }
}
