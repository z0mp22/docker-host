# Garmin Weekly Coaching Report

Automated Monday morning mountain sports coaching report: pulls Garmin Connect data, analyzes via Claude, saves markdown + debug JSON to a host volume, emails HTML report.

Runs on **docker-host** (`10.0.0.4`) via GitOps — push to `main` deploys image + cron.

## Prerequisites (one-time, on the Pi)

### 1. Create `.env` with secrets

```bash
cp /docker/garmin-coaching-report/.env.example /docker/garmin-coaching-report/.env
nano /docker/garmin-coaching-report/.env
```

| Variable | Where to get it |
|----------|-----------------|
| `GARMIN_EMAIL` | Your Garmin Connect login email |
| `GARMIN_PASSWORD` | Your Garmin Connect password |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com/) → API Keys |
| `GMAIL_USER` | Your Gmail address |
| `GMAIL_APP_PASSWORD` | [Google App Passwords](https://myaccount.google.com/apppasswords) (requires 2FA on Google account) |

### 2. Garmin OAuth token setup (interactive, once)

MFA users must run this with `-it`:

```bash
docker run -it --rm \
  --env-file /docker/garmin-coaching-report/.env \
  -v /docker/garmin-coaching-report/tokens:/root/.garminconnect \
  --entrypoint python \
  garmin-coaching-report:local \
  -m garmin_connect_mcp.scripts.setup_auth
```

Tokens persist in `/docker/garmin-coaching-report/tokens/`. Re-run if you get an auth-failure alert email.

### 3. Test a report manually

```bash
bash /docker/garmin-coaching-report/scripts/run-report.sh
```

Check outputs in `/docker/garmin-coaching-report/reports/`:

- `mountain-sports-coaching-YYYY-MM-DD.md` — coaching report + token metadata footer
- `mountain-sports-coaching-YYYY-MM-DD.meta.json` — run stats for iteration
- `mountain-sports-coaching-YYYY-MM-DD.input.json` — full payload sent to Claude + raw Garmin data (debug)

## Schedule

Cron installed by `deploy.sh` to `/etc/cron.d/garmin-coaching-report`:

- **Monday 9:00 AM** local Pi time
- Logs: `/docker/garmin-coaching-report/cron.log`

## Iteration workflow

1. Edit `prompts/system.md` or code in this repo
2. Push to `main` → GitHub Actions deploys
3. Run `bash /docker/garmin-coaching-report/scripts/run-report.sh` manually
4. Compare `.meta.json` files across runs (token usage, compression level)

## Move IQ backfill

Garmin **Move IQ** events (auto-detected walks/rides, grey in the app) never become real
activities, so they're invisible to the coaching report. `scripts/` has two backfillers:

| Script | Purpose |
|--------|---------|
| `backfill-moveiq.py` | Minimal — Move IQ event → plain manual activity (time + type only). |
| `enrich-moveiq.py` | Manual activity with summary fields set directly: avg/max/min HR, walking distance/cadence (steps × stride), elevation, respiration, calibrated calories. Garmin computes Training Effect / load. Stats it won't store on a manual activity (time-in-zone, steps, intensity minutes) go in the **description**. |
| `backfill-moveiq-fit.py` | Synthesises a FIT from the all-day HR stream (2-min samples → 10 s records) + step-derived distance for walks, and `upload_activity()`s it. Garmin ingests it as a recording and computes HR zones, **time-in-zone** (`get_activity_hr_in_timezones`) and intensity minutes from the stream. Needs `fit-tool` (bundled in the image). |

All default to a dry run; pass `--commit` to write. Shared flags: `--date today|yesterday|YYYY-MM-DD`,
`--bike-type e_bike_fitness`, `--min-minutes`, `--replace-id <id>` (delete + re-do). Run via the
**Backfill Move IQ** GitHub Action (`workflow_dispatch`, `method` = `summary` or `fit`) or manually:

```bash
docker run --rm --env-file /docker/garmin-coaching-report/.env \
  -v /docker/garmin-coaching-report/tokens:/root/.garminconnect \
  -v "$PWD/garmin-coaching-report/scripts/enrich-moveiq.py:/tmp/x.py:ro" \
  --entrypoint python garmin-coaching-report:local /tmp/x.py --date yesterday --commit
```

Never recoverable after the fact: GPS track, real per-second HR, cycling distance/speed/power.

## Foundation

Vendors [eddmann/garmin-connect-mcp](https://github.com/eddmann/garmin-connect-mcp) as a git submodule at `vendor/garmin-connect-mcp/`.
