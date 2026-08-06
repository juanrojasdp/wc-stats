"""Typed failures raised by precompute (AD-8: fail loud, never guess).

Same shape as `pipeline/extract/errors.py`: a `what` class attribute naming the failure
class, `__init__(reason, report_id=None)`, and a message reading
`[{where}] {what}: {reason}`.

The `report_id` is optional here in a way it is not in extract, and the difference is the
point. Precompute is corpus-level: a collision between two reports belongs to *both* of
them, and a registry defect belongs to none. When an id is available it is carried; when
the failure is genuinely corpus-level the message names every party instead.

One exception per failure kind. Never overload one class for two kinds, and never raise a
bare `ValueError` — the CLI maps these to exit 1 (a real finding) and lets anything
untyped surface as exit 2 (a broken harness), so overloading destroys that distinction.
"""

from __future__ import annotations

from pipeline.errors import PipelineError


class PrecomputeError(PipelineError):
    """Base class for cross-match precompute failures."""

    def __init__(self, reason: str, report_id: str | None = None) -> None:
        self.reason = reason
        self.report_id = report_id
        where = report_id if report_id is not None else "<corpus>"
        super().__init__(f"[{where}] {self.what}: {reason}")

    # Subclasses override with the phrase that names their failure class in messages.
    what = "precompute failed"


class ManifestUnreadableError(PrecomputeError):
    """The run manifest could not be read or parsed at all.

    The one precompute failure that is a HARNESS problem rather than a finding, and it
    has its own class for exactly that reason: the CLI maps it to exit 2 ("nothing was
    learned") while every other `PrecomputeError` is exit 1 ("the data or the rule is
    wrong and someone must rule on it"). A missing manifest and a manifest naming one
    match twice are not the same news, and reporting them under one code loses the
    difference in both directions.
    """

    what = "run manifest is unreadable"


class PlayerSlugError(PrecomputeError):
    """A player name produced no slug, or one the contract's `PlayerId` rejects.

    The message MUST carry the name in `repr()`. A name that looks right on screen but
    holds a doubled space, a non-breaking space or a stray zero-width character is the
    exact failure this class exists to localize, and it is invisible without `repr()`.
    """

    what = "player slug is not derivable"


class IdentityCollisionError(PrecomputeError):
    """Two distinct entities resolved to one id, or one entity to two ids.

    Both parties MUST be named. "a collision occurred" localizes nothing across 1,248
    players; "argentina#23 and argentina#23" versus the two names behind them localizes
    it immediately.
    """

    what = "identity collision"


class SlugRegistryError(PrecomputeError):
    """The committed registry and this run disagree, or the registry is itself stale.

    Three causes, all fatal: a pinned id that this run would change (AD-3's guarantee is
    that an emitted id never changes), an `OVERRIDES` entry naming a key that resolves to
    nobody (a stale override is how a registry rots silently), and a committed `/data`
    bundle carrying an id the registry does not pin.
    """

    what = "slug registry violation"


class SpineError(PrecomputeError):
    """The spine could not be built, or it would be built incomplete.

    Raised when a name path cannot be resolved to a player id, when a name disagrees with
    the shirt number it sits beside, or when a matchday round cannot be derived. The
    message MUST name the JSON path, because the spine mirrors the record's whole
    `domains` block and "a name did not resolve" is unlocalizable without it.
    """

    what = "spine construction failed"


class EmitError(PrecomputeError):
    """Match Bundle emission could not complete (Story 1.16).

    The general emission failure: a spine file that will not parse into a bundle, a
    shoot-out prose string that will not decompose, a penalty-goal shot that joins no
    lineup goal, a derived count that contradicts its own cross-check. Anything with a
    sharper class below uses that class instead.
    """

    what = "bundle emission failed"


class BudgetExceededError(PrecomputeError):
    """A bundle breached the AD-4 / NFR-1 payload budget.

    SM-C2 makes this a design conversation, never a serializer tweak: the resolution is a
    split or a logged budget decision, and NEVER dropping a field, truncating an array or
    lowering a precision to fit. The message MUST carry both byte counts per offending
    bundle — "over budget" alone does not say whether the overage is one row or one order
    of magnitude, and those need different answers.
    """

    what = "payload budget exceeded"


class BundleValidationError(PrecomputeError):
    """A bundle failed the `/contract` schema before it was written.

    Distinct from `EmitError` because the bundle was BUILT successfully and is wrong
    against the contract, which points at the mapping rather than at the source data.
    Carries every violation at once — `validate_artifact` reports them all, and the whole
    point of that is lost if this re-raises only the first.
    """

    what = "bundle is schema-invalid"


class ProfileError(PrecomputeError):
    """Team or player profile emission could not complete (Story 1.18).

    The general profile failure: a lineup entry whose minutes fall outside the match, a
    with-minutes entry with no Domain G row, a team whose group letter does not resolve, a
    numeric leaf reaching the serializer with no declared precision, a player carrying two
    shirt numbers. Anything with a sharper class below uses that class instead.

    Deliberately NOT reused for the budget: `BudgetExceededError` already carries SM-C2's
    "never truncate to fit" rule in its own docstring, and minting a profile-specific twin
    would split one policy across two classes.
    """

    what = "profile emission failed"


class ProfileValidationError(ProfileError):
    """A profile failed the `/contract` schema before it was written.

    Distinct from `ProfileError` because the profile was BUILT successfully and is wrong
    against the contract, which points at the reduction rather than at the source data.
    Carries every violation at once — `validate_artifact` reports them all, and the whole
    point of that is lost if this re-raises only the first.
    """

    what = "profile is schema-invalid"


class UnmappedFieldError(PrecomputeError):
    """The snake_case -> camelCase boundary is not total for some object.

    Either a source key reached the boundary with no declared target, or a contract-
    required target was left unfilled. Both are silent-corruption risks that a schema
    violation localizes badly or not at all, so the boundary asserts them itself and names
    BOTH the offending key and the `$def` whose property set it was measured against.
    """

    what = "emit mapping is not total"


class IndexEmitError(PrecomputeError):
    """Tournament index or leaderboard emission could not complete (Story 1.17).

    The general index failure: a spine block the aggregators read by subscript and cannot
    find, a group whose table does not close, a board whose metric names no field, an
    artifact count that contradicts `--expect-matches`. Anything with a sharper class
    below uses that class instead.

    **Named `IndexEmitError`, never `IndexError`.** That name is a builtin, and shadowing
    it inside a package whose callers routinely index lists would turn a genuine
    out-of-range bug into something that reads like a typed pipeline finding.
    """

    what = "index emission failed"


class TiebreakUnresolvedError(PrecomputeError):
    """A standings tie survived the implemented FIFA tiebreaker cascade (Story 1.17 D1).

    Tiers 1-3 are implemented — points, then goal difference, then goals scored. They are
    universally agreed, they are what this corpus exercises, and they reproduce the actual
    tournament outcome exactly. Tiers 4+ are DELIBERATELY unimplemented: the normative
    regulations text is not in this repository, head-to-head and fair play are not
    computable from the contracted `StandingsRow` (and adding a field to carry them is an
    AD-14 change request), and drawing of lots is non-deterministic and collides head-on
    with AD-8's byte-identical requirement.

    So a surviving tie raises rather than inventing an order. The message MUST name every
    tied team and the tier that ran out — "a tie survived" localizes nothing across twelve
    groups, and the whole reason this class exists is that the next person needs to know
    exactly which regulation to go and read.
    """

    what = "standings tie unresolved by the implemented cascade"


class RouteManifestError(PrecomputeError):
    """The AD-4 route-manifest bijection or the index id-containment gate failed.

    Its own class rather than a reuse of `IndexEmitError`, per this module's own rule:
    "One exception per failure kind." An artifact on disk that no entity list names, and
    an id in `data/index/` that no manifest pins, are both route-manifest failures — the
    App's `generateStaticParams` reads these lists, so either one ships a route that 404s
    or an entity that has no route at all.
    """

    what = "route manifest is not total"
