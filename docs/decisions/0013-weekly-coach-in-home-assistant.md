# ADR 0013: The weekly coach lives in Home Assistant, and talks back

- **Status:** Accepted
- **Date:** 2026-11-04
- **Deciders:** Cody
- **Tags:** garmin-coaching-report, home-assistant, coach

## Context

The weekly mountain report was a 3,000-word email: a recap of each activity's heart
rate, no memory of the previous week, and a guessed forecast. Cody wanted it to coach
him the way a person would, and to be able to answer it. Email is one-way.

## Decision

- **The debrief is data, not an email.** Claude returns a structured debrief
  (`debrief.DebriefSchema`: headline, last week's plan versus what happened, insights,
  goals, a plan row per day, questions with tap answers). It is kept with the plan,
  Cody's answers and the week's conversation in `reports/weekly_coach.json`, copied to
  HA as `sensor.weekly_coach`. A markdown copy is still written for the archive and
  `SINCE=last`.
- **One place to read and answer: the Coach panel.** A week card shows the headline,
  one open question with tap answers, the week as a strip of days (green done, blue
  changed, amber nothing logged), goals, the full debrief behind a toggle, and the
  conversation with a message box. A lift or board day has "Build in Hevy".
  Since 2026-11-05 it is three cards: Coach (question, conversation; on a phone a thread
  quiet for 3 hours folds to one line so the day's plan is near the top), Today, and the
  debrief last. Kinds and goals carry an emoji and a color everywhere for scanning.
- **Phone first.** The Monday push carries the headline. Questions are pushed one at a
  time (7:30 PM, or after a reply) with two tap answers and Reply. Coach replies are
  pushed with Reply, so a whole exchange can happen in notifications.
- **Live replies.** A message or answer goes HA → `Coach` GitHub workflow →
  `run-coach.sh` → `coach_chat.py`, which saves it, asks Claude with the week, the
  thread, what Garmin and Hevy logged since Monday, and a fresh forecast, then saves the
  reply and any plan changes (today onward only). About a minute end to end.
- **Days check themselves.** A nightly cron pass marks past plan days from Garmin and
  Hevy; only a planned session that left nothing gets a 7:30 AM Done / Skipped /
  Changed push. Next Monday's debrief reads these statuses instead of guessing.
- **No fixed days.** Weekends vary; the plan puts the outdoor day where the forecast
  and the conversation say, and changes when Cody says a day won't work.

- **Garmin sync, and the coach checks in on its own** (added 2026-11-04). Every 30
  minutes in the day, cron runs `COACH_MODE=sync`: plan days are marked from Garmin and
  Hevy (today too, once something is logged), and every recent day's activity is kept
  for the panel, planned or not. When what was logged changes the plan (a different
  session, or a hard effort on an easy, rest or unplanned day), the coach takes one look
  and sends a short note only if it's worth saying, and may move coming days. Each event
  is looked at once, at most two check-ins a day, none from 9 PM to 7 AM.

- **Aggressive by default, walked back by readiness** (added 2026-11-04, Cody's call). The
  week is six training days, five hard and one moderate, balanced across his goals (two
  climbs, two lifts, a hard ride, a weekend outdoor day, a zone 2 or PT day). Each
  morning `readiness.py` compares last night's HRV and today's resting HR with his
  28-day median. Only both together, two days running or far off today, ask to ease a
  hard day: a push and a panel banner with Keep it / Ease it. Nothing changes unless he
  eases it. On his last 8 mornings only Nov 1 (HRV 16 vs 22, RHR +5) would have asked.
  From 2026-11-05 the sync runs every 15 minutes from 4:45 AM (he's up around 5; the 6 AM
  start missed that), and the panel always says where the check is: waiting on last
  night's HRV, on track (plan stands), or down. A "go" morning leaves the plan as it is.

## Consequences

- No report email; failures still alert by email.
- Each reply is a small Claude call (the week, thread and a few days of logs), much
  smaller than the weekly report.
- The state file has three writers (weekly report, replies, nightly check); all write
  under one lock after re-reading the file.
- The workflow passes text only through environment variables, never into the script.
