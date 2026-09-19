"""Unit tests for the persistent athlete-feedback log."""

from coaching_report.lift_feedback import append_feedback, load_recent_feedback


def test_load_recent_feedback_empty_when_no_log_exists(tmp_path):
    assert load_recent_feedback(tmp_path) == []


def test_append_and_load_round_trip(tmp_path):
    append_feedback(tmp_path, "I don't like squats, prefer leg press")
    append_feedback(tmp_path, "Shoulder felt great this week")

    entries = load_recent_feedback(tmp_path)
    assert len(entries) == 2
    assert entries[0]["note"] == "I don't like squats, prefer leg press"
    assert entries[1]["note"] == "Shoulder felt great this week"
    assert all("date" in e for e in entries)


def test_load_recent_feedback_respects_limit_and_keeps_most_recent(tmp_path):
    for i in range(20):
        append_feedback(tmp_path, f"entry {i}")

    entries = load_recent_feedback(tmp_path, limit=5)
    assert len(entries) == 5
    # Most recent 5, oldest-of-those first (natural reading order).
    assert [e["note"] for e in entries] == [f"entry {i}" for i in range(15, 20)]


def test_malformed_line_is_skipped_not_raised(tmp_path):
    append_feedback(tmp_path, "good entry one")
    log_file = tmp_path / "lift_feedback_log.jsonl"
    with log_file.open("a", encoding="utf-8") as f:
        f.write("{not valid json\n")
    append_feedback(tmp_path, "good entry two")

    entries = load_recent_feedback(tmp_path)
    assert [e["note"] for e in entries] == ["good entry one", "good entry two"]
