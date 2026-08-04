"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

/*
 * The ONE polite live region for UX-DR12's sort announcements (Story 2.11a
 * ruled decision 9). EXPERIENCE.md:115 authorises exactly this region; Story
 * 2.8 decision 16 enumerates all three the project allows.
 *
 * IT CANNOT LIVE INSIDE THE TABLE, and that is the whole reason this file
 * exists. A region rendered by the shared `DataTable` would mint TWENTY of
 * them, and every instance sitting inside a `ViewDataDisclosure` would be
 * CONDITIONALLY MOUNTED (`{open ? <div…> : null}`) — a live region that mounts
 * already-populated does not announce reliably, so the first sort after opening
 * "Ver los datos" would be silent.
 *
 * So: one provider, mounted ONCE in MatchBundleRegion, rendering one PERSISTENT
 * region whose text changes. This is the shipped `i18n-provider.tsx` /
 * `MatchBundleRegion.tsx` pattern, not a new one.
 *
 * No `role="status"`, no `role="alert"`, no second region.
 */

type Announce = (message: string) => void;

const SortAnnounceContext = createContext<Announce | null>(null);

interface Announcement {
  message: string;
  /**
   * Monotonic, and the inner span's React key.
   *
   * A live region announces on a DOM CHANGE inside it. Two tables in one
   * disclosure can carry the same column head — `#offers-to-receive` renders
   * "Equipo" in both of its tables — so sorting that column in each would
   * produce a BYTE-IDENTICAL string, React would reconcile the text node in
   * place, and the second sort would be silent. Keying on the tick replaces the
   * node instead, while the region element itself stays mounted throughout.
   */
  tick: number;
}

export function SortAnnouncerProvider({ children }: { children: ReactNode }) {
  const [announcement, setAnnouncement] = useState<Announcement>({ message: "", tick: 0 });

  const announce = useCallback<Announce>((message) => {
    setAnnouncement((previous) => ({ message, tick: previous.tick + 1 }));
  }, []);

  /*
   * The function identity is stable (useCallback with no deps), so consuming
   * tables do not re-render when the announcement changes — only this provider
   * does. Without that, every sort in any table would re-render all twenty.
   */
  return (
    <SortAnnounceContext.Provider value={announce}>
      {children}
      <span aria-live="polite" className="sr-only">
        <span key={announcement.tick}>{announcement.message}</span>
      </span>
    </SortAnnounceContext.Provider>
  );
}

/**
 * Announce a sort change politely.
 *
 * Returns a NO-OP outside a provider rather than throwing, unlike `useLocale`.
 * A missing announcer costs a screen-reader user one spoken sentence; throwing
 * would take all eleven Tactical sections down through the single shared error
 * boundary. The table is the load-bearing surface, the announcement is not.
 */
export function useSortAnnounce(): Announce {
  const announce = useContext(SortAnnounceContext);
  return useMemo<Announce>(() => announce ?? (() => undefined), [announce]);
}
