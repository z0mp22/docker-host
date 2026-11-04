"""Proves the lift-session feature cannot affect the mountain report's
prompt loading -- the specific regression this whole feature was built
carefully around (a prior incident this session: a model swap silently
changed the mountain report's output and had to be reverted; the lesson was
"keep new work strictly additive, never refactor the working prompt path").
"""

from coaching_report import prompts


def test_mountain_report_prompt_unaffected_by_exercising_the_lift_prompt_path():
    before_version = prompts.prompt_version()
    before_text = prompts.load_system_prompt()

    # Exercise the new, separate lift-prompt functions.
    prompts.load_lift_prompt()
    prompts.lift_prompt_version()

    after_version = prompts.prompt_version()
    after_text = prompts.load_system_prompt()

    assert after_version == before_version
    assert after_text == before_text


def test_system_and_lift_prompts_are_genuinely_different_files():
    assert prompts.prompt_path().name == "system.md"
    assert prompts.lift_prompt_path().name == "lift_system.md"
    assert prompts.prompt_path() != prompts.lift_prompt_path()
    assert prompts.prompt_path().read_text(encoding="utf-8") != prompts.lift_prompt_path().read_text(
        encoding="utf-8"
    )


def test_lift_prompt_mentions_none_of_the_mountain_report_shared_wording():
    """Loose but meaningful check: the lift prompt was written fresh, not
    extracted -- it should not be byte-identical to (or a substring of) the
    mountain report's goals/constraints wording, which would indicate an
    accidental shared-file reintroduction later."""
    system_text = prompts.load_system_prompt()
    lift_text = prompts.load_lift_prompt()
    assert lift_text != system_text
    assert lift_text not in system_text
    assert system_text not in lift_text
