"""Typed errors for the coaching report pipeline."""


class CoachingReportError(Exception):
    """Base error for coaching report failures."""


class AuthExpiredError(CoachingReportError):
    """Garmin session tokens are missing or expired."""


class DataCollectionError(CoachingReportError):
    """Failed to collect data from Garmin Connect."""


class EmptyWindowError(DataCollectionError):
    """The resolved lookback window contains no days (e.g. SINCE=last when the
    previous report already covered through the end date). Not a failure --
    there is simply nothing new to report."""


class CoachError(CoachingReportError):
    """Failed to generate coaching report via Anthropic API."""


class EmailError(CoachingReportError):
    """Failed to send email notification."""
