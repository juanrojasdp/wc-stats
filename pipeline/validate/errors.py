"""Typed failures raised by contract validation (AD-8: fail loud, never skip silently)."""

from __future__ import annotations

from pipeline.errors import PipelineError


class ValidationError(PipelineError):
    """Base class for validation failures."""


class SchemaValidationError(ValidationError):
    """An artifact did not satisfy its schema.

    Carries every violation rather than only the first: an emitted bundle that is wrong in
    six places should say so once, not force six re-runs of a 104-report batch. `errors` are
    formatted `"<json pointer>: <message>"` strings, sorted, so two runs over the same bad
    instance produce byte-identical output (AD-8).
    """

    def __init__(
        self,
        schema_name: str,
        errors: "list[str]",
        instance_label: str | None = None,
    ) -> None:
        self.schema_name = schema_name
        self.errors = list(errors)
        self.instance_label = instance_label
        where = instance_label if instance_label is not None else "<instance>"
        detail = "\n  ".join(self.errors)
        super().__init__(
            f"[{where}] does not satisfy {schema_name}: "
            f"{len(self.errors)} violation(s)\n  {detail}"
        )


class SchemaNotFoundError(ValidationError):
    """A schema was requested by a name that /contract does not define.

    An authoring bug, not report data: a typo here would otherwise make `validate_artifact`
    silently validate against nothing at all.
    """

    def __init__(self, schema_name: str, available: "list[str]") -> None:
        self.schema_name = schema_name
        self.available = list(available)
        super().__init__(
            f"no schema named {schema_name!r} in /contract; available: "
            f"{', '.join(sorted(self.available))}"
        )
