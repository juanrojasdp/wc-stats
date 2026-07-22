"""Typed failures raised by discovery (AD-8: fail loud, never skip silently)."""

from __future__ import annotations

from pipeline.errors import PipelineError


class DiscoveryError(PipelineError):
    """Base class for discovery failures."""


class MissingAnchorError(DiscoveryError):
    """A required section anchor was not found anywhere in the report.

    Never swallow this: in verification mode it is caught by the runner and recorded
    as a `missing-anchor` deviation, which is exactly the signal a mid-tournament
    template revision produces.
    """

    def __init__(self, anchor_text: str, report_id: str | None = None) -> None:
        self.anchor_text = anchor_text
        self.report_id = report_id
        where = report_id if report_id is not None else "<unknown report>"
        super().__init__(f"[{where}] anchor not found: {anchor_text!r}")


class ProbeError(DiscoveryError):
    """The cover-page metadata probe could not produce a usable report identity.

    The report is recorded as a `probe-failure` deviation and excluded from
    stratification keys — it can neither be assigned a venue nor a matchday round.
    """

    def __init__(self, reason: str, report_id: str | None = None) -> None:
        self.reason = reason
        self.report_id = report_id
        where = report_id if report_id is not None else "<unknown report>"
        super().__init__(f"[{where}] metadata probe failed: {reason}")
