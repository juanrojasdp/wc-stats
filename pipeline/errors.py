"""Base exception for the pipeline.

Consistency convention: one typed exception per failure class, each carrying enough
context (report id, the thing that failed) to localize the problem without a debugger.
Verification mode catches these and records them as deviations instead of aborting.
"""

from __future__ import annotations


class PipelineError(Exception):
    """Base class for every pipeline failure."""
