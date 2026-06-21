"""Typed errors for the coaching report pipeline."""


class CoachingReportError(Exception):
    """Base error for coaching report failures."""


class AuthExpiredError(CoachingReportError):
    """Garmin session tokens are missing or expired."""


class DataCollectionError(CoachingReportError):
    """Failed to collect data from Garmin Connect."""


class CoachError(CoachingReportError):
    """Failed to generate coaching report via Anthropic API."""


class EmailError(CoachingReportError):
    """Failed to send email notification."""
