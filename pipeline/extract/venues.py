"""Committed venue -> UTC-offset table for kickoff normalization (AD-7).

The PMSR cover prints kickoff as venue-local wall time with no offset, and the record
must carry ISO 8601 venue-local time *with* the UTC offset. The 16 corpus venue strings
below are exactly the set `work/verification/verification-report.json` enumerates; every
one of the 104 matches falls in 2026-06-11..2026-07-19, a window with no DST transition
in any host city, so one fixed offset per venue is correct and deterministic — no tzdata
dependency, no new requirements.txt entry.

Offsets, verified against the host cities' 2026 summer rules:
  Mexico (no DST since 2022):        Mexico City, Guadalajara, Monterrey        -06:00
  US Eastern (EDT) / Toronto (EDT):  Atlanta, Boston, Miami, New York/New Jersey,
                                     Philadelphia, Toronto                       -04:00
  US Central (CDT):                  Dallas, Houston, Kansas City               -05:00
  US Pacific (PDT) / Vancouver (PDT): Los Angeles, San Francisco Bay Area,
                                     Seattle, Vancouver                         -07:00

An unknown venue string raises `UnknownVenueError` — never a default offset, which would
stamp a plausible but wrong kickoff instant on every match at that venue (AD-8).
"""

from __future__ import annotations

from pipeline.extract.errors import UnknownVenueError

VENUE_UTC_OFFSETS: dict[str, str] = {
    "Atlanta Stadium": "-04:00",
    "BC Place Vancouver": "-07:00",
    "Boston Stadium": "-04:00",
    "Dallas Stadium": "-05:00",
    "Guadalajara Stadium": "-06:00",
    "Houston Stadium": "-05:00",
    "Kansas City Stadium": "-05:00",
    "Los Angeles Stadium": "-07:00",
    "Mexico City Stadium": "-06:00",
    "Miami Stadium": "-04:00",
    "Monterrey Stadium": "-06:00",
    "New York/New Jersey Stadium": "-04:00",
    "Philadelphia Stadium": "-04:00",
    "San Francisco Bay Area Stadium": "-07:00",
    "Seattle Stadium": "-07:00",
    "Toronto Stadium": "-04:00",
}


def utc_offset_for(venue: str, report_id: str | None = None) -> str:
    """The fixed UTC offset for a corpus venue string.

    Raises `UnknownVenueError` for anything outside the committed table — a new or
    reworded venue is a template change the pipeline must surface, not absorb.
    """
    try:
        return VENUE_UTC_OFFSETS[venue]
    except KeyError:
        raise UnknownVenueError(
            f"{venue!r} is not in the committed venue offset table", report_id
        ) from None
