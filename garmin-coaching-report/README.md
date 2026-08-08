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

## Foundation

Vendors [eddmann/garmin-connect-mcp](https://github.com/eddmann/garmin-connect-mcp) as a git submodule at `vendor/garmin-connect-mcp/`.
