"""The deviation vocabulary of the template-consistency gate.

All four categories exist from day one even though only two of them can fire today: the
report format is the contract that Stories 1.3-1.14 write into, and a category that
appears later would silently change the shape of every earlier gate result.

  missing-anchor  a registered section anchor did not resolve (fires now)
  unknown-rgb     a marker colour outside the known legend (Story 1.3 onward)
  count-mismatch  a parsed count disagreed with the count the page prints (Story 1.3 onward)
  probe-failure   the report's own identity could not be established (fires now)
"""

from __future__ import annotations

from dataclasses import dataclass


class DeviationCategory:
    """Closed set of deviation categories."""

    MISSING_ANCHOR = "missing-anchor"
    UNKNOWN_RGB = "unknown-rgb"
    COUNT_MISMATCH = "count-mismatch"
    PROBE_FAILURE = "probe-failure"


ALL_CATEGORIES: tuple[str, ...] = (
    DeviationCategory.MISSING_ANCHOR,
    DeviationCategory.UNKNOWN_RGB,
    DeviationCategory.COUNT_MISMATCH,
    DeviationCategory.PROBE_FAILURE,
)


@dataclass(frozen=True)
class Deviation:
    """One recorded departure from the expected report template.

    A deviation is data, not an error: verification mode records it and moves on to the
    next report, so a single broken report can never hide the state of the other 103.
    """

    report_id: str
    check: str
    category: str
    specifics: str

    def __post_init__(self) -> None:
        if self.category not in ALL_CATEGORIES:
            raise ValueError(
                f"unknown deviation category {self.category!r}; "
                f"expected one of {ALL_CATEGORIES}"
            )
        # Every field is serialized and sorted, so a non-string here would otherwise
        # surface as a TypeError inside json.dumps — after every PDF has been opened and
        # every check has run, with no manifest written and no gate result produced.
        for field, value in (
            ("report_id", self.report_id),
            ("check", self.check),
            ("specifics", self.specifics),
        ):
            if not isinstance(value, str):
                raise TypeError(
                    f"deviation {field} must be a str, got {type(value).__name__}: {value!r}"
                )

    def to_dict(self) -> dict[str, str]:
        """snake_case keys: `work/` is pipeline-internal staging (AD-9), not `/contract`."""
        return {
            "report_id": self.report_id,
            "check": self.check,
            "category": self.category,
            "specifics": self.specifics,
        }
