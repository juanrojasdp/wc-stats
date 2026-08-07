"use client";

import { DataTable } from "@/components/DataTable";
import { EmptyStatePanel } from "@/components/EmptyStatePanel";
import { useLocale, useT } from "@/lib/i18n-provider";
import type { TableColumn } from "@/lib/table-sort";
import { formatRateValue, formatTeamCount } from "@/lib/team-profile-format";
import { FORMATIONS_SECTION_ID, type FormationRow } from "@/viz/team-profile-model";

/*
 * The #formations content (Story 2.16, AC 1): `formationUsage[]`, at most four
 * rows corpus-wide (1 -> 14 teams, 2 -> 21, 3 -> 8, 4 -> 5).
 *
 * ARTIFACT ORDER, WHICH IS PART OF THE CONTRACT. The schema description says
 * "ordered by descending match count", so re-sorting on mount would be the App
 * re-deriving a precomputed ordering (AR-5) — and `DataTable` has no
 * `defaultSort` prop precisely so that every table mounts at `null`, which IS
 * the artifact order. The caption states the default; it never mutates.
 *
 * FORMATION STRINGS ARE LOCALE-NEUTRAL DATA. "4-1-2-3" is a notation, not a
 * term: never translated, never dictionary-mapped, and safe as the row key
 * because the artifact's own distribution cannot repeat a formation.
 */

/** Separator glyphs are module consts, never bare JSX literals (i18n gate). */
const CAPTION_SEPARATOR = " — ";

export function TeamFormationsSection({ rows }: { rows: readonly FormationRow[] }) {
  const t = useT();
  const { locale } = useLocale();

  const title = t("team.sections.formations.title");
  const tableName = t("team.tableName.formations");

  /*
   * AN EMPTINESS BRANCH, NEVER A SHAPE BRANCH (ruled D9). `formationUsage` ships
   * at least one row on the real emission, so this cannot fire there — the
   * branch exists anyway because UX-DR13 gives an empty slot an
   * `EmptyStatePanel` ("never a silent absence, never layout collapse"), and a
   * zero-row table would present live sort controls over an empty `<tbody>`.
   * What it must NOT do is gate on the SHAPE of the field: every leaf on
   * `TeamProfile` is required and non-nullable, so there is no null to guard.
   */
  if (rows.length === 0) {
    return (
      <section id={FORMATIONS_SECTION_ID} className="mt-layer-gap">
        <h2 className="type-title text-ink-primary">{title}</h2>
        <div className="mt-3">
          <EmptyStatePanel
            headline={t("team.empty.formationsHeadline")}
            explanation={t("team.empty.formationsExplanation")}
          />
        </div>
      </section>
    );
  }

  const columns: TableColumn<FormationRow>[] = [
    {
      key: "formation",
      headText: t("team.column.formation"),
      headTitle: null,
      render: (row) => row.formation,
      align: "text",
      rowHeader: true,
      /*
       * TEXT SORT ON THE NOTATION ITSELF, which goes through `compareText()` at
       * its 'es' default inside the shipped sort contract — never
       * `localeCompare`, never `<`/`>` on strings.
       */
      sort: { kind: "text", valueOf: (row) => row.formation },
    },
    {
      key: "matches",
      headText: t("team.column.matchesPlayed"),
      headTitle: null,
      render: (row) => formatTeamCount(row.matches, locale),
      align: "numeric",
      /* The RAW count, never the formatted string. */
      sort: { kind: "number", valueOf: (row) => row.matches },
    },
    {
      key: "share",
      headText: t("team.column.share"),
      headTitle: null,
      render: (row) => formatRateValue(row.share, locale),
      align: "numeric",
      sort: { kind: "number", valueOf: (row) => row.share },
    },
  ];

  /* Hoisted: `caption` is a gated prop and the gate fires on a template literal
   * there even when every fragment is a t() call. */
  const caption = `${title}${CAPTION_SEPARATOR}${t("team.caption.formations")}`;

  return (
    <section id={FORMATIONS_SECTION_ID} className="mt-layer-gap">
      <h2 className="type-title text-ink-primary">{title}</h2>
      <div className="mt-3 w-full min-w-0 overflow-x-auto">
        <DataTable
          caption={caption}
          columns={columns}
          rows={rows}
          surface="canvas"
          tableName={tableName}
        />
      </div>
    </section>
  );
}
