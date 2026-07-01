# Docker Host (10.0.0.4)

GitOps for the Raspberry Pi 5 home Docker host (`raspberrypi5`, `10.0.0.4`).

Push to `main` → GitHub Actions deploys to `/docker` on the Pi via a self-hosted runner.

## Stack

| Service | Port(s) | Config in repo |
|---------|---------|----------------|
| Home Assistant | 8123 | `homeassistant/config/` |
| Mosquitto (MQTT) | 1883 | `mosquitto/config/` |
| Nginx Proxy Manager | 80, 81, 443 | `docker-compose.yml` + `npm/nginx/custom/` |
| Pi-hole | 53, 8053 | `docker-compose.yml` |
| Portainer CE | 9000 | `docker-compose.yml` |
| node-exporter | 9100 | `node-exporter/` |
| pihole-exporter | 9617 | `pihole-exporter/` |
| npm-exporter | 9113 | `npm-exporter/` |
| npm-metrics-exporter | 9114 | `npm-metrics-exporter/` |
| unifi-poller | 9130 | `unifi-poller/` (optional) |
| garmin-coaching-report | — (Mon 6:00 cron) | `garmin-coaching-report/` |

Frigate NVR runs on **minipc** (`10.0.0.6`) — see [czampino/frigate](https://github.com/czampino/frigate).  
Prometheus/Grafana scrape this host from **minipc** — see [z0mp22/minipc](https://github.com/z0mp22/minipc).

## GitOps model

1. Edit config in this repo.
2. Push to `main`.
3. `deploy.yml` runs on the Pi runner (`self-hosted`, `docker-host`).
4. `scripts/deploy.sh` rsyncs config to `/docker`, runs `docker compose up -d`, validates health.
5. Secrets remain on the host — never committed.

Set `PULL_IMAGES=1` to pull latest images (optional; off by default to avoid microSD strain).

## Host secrets (not in git)

| Path | Used by |
|------|---------|
| `/docker/.env` | Pi-hole `WEBPASSWORD` in main compose |
| `/docker/pihole-exporter/.env` | Pi-hole API password for exporter |
| `/docker/unifi-poller/up.conf` | UniFi controller credentials |
| `/docker/homeassistant/secrets.yaml` | HA integrations |
| `/docker/garmin-coaching-report/.env` | Garmin, Anthropic, Gmail credentials |
| `/docker/garmin-coaching-report/tokens/` | Garmin OAuth token cache |
| `/docker/garmin-coaching-report/reports/` | Coaching reports + debug JSON |
| `/docker/npm/data/` | NPM proxy hosts + SSL (managed in NPM UI) |
| `/docker/pihole/etc-pihole/` | Pi-hole gravity/lists |
| `/docker/portainer/` | Portainer DB |

Copy from `*.example` on first deploy if missing.

## First-time setup

### 1. Create GitHub repo and push

```bash
cd docker-host
git init && git add . && git commit -m "Initial docker-host GitOps stack"
gh repo create z0mp22/docker-host --public --source=. --push
```

### 2. Register self-hosted runner on the Pi

See [runner/README.md](runner/README.md). Label must include `docker-host`.

### 3. Seed host secrets (one time)

```bash
ssh pi@10.0.0.4
# Copy existing passwords into place before first deploy overwrites nothing critical:
# /docker/.env, /docker/pihole-exporter/.env, /docker/homeassistant/secrets.yaml
```

### 4. Trigger deploy

Push to `main`, or run **workflow_dispatch** in GitHub Actions.

## Manual deploy (fallback)

```bash
ssh pi@10.0.0.4
cd /path/to/docker-host
bash scripts/deploy.sh
bash scripts/validate.sh
```

## Directory layout

```
docker-host/
├── .github/workflows/     # deploy.yml, runner.yml
├── scripts/               # deploy.sh, validate.sh
├── runner/                # self-hosted runner helper
├── docker-compose.yml     # HA, mosquitto, npm, pihole, portainer
├── homeassistant/config/  # YAML config (replaces czampino/homeassistant)
├── mosquitto/config/
├── npm/nginx/custom/
├── node-exporter/
├── pihole-exporter/
├── npm-exporter/
├── npm-metrics-exporter/
├── unifi-poller/
└── garmin-coaching-report/  # weekly coaching report (cron batch)
```

Runtime on Pi mirrors this under `/docker/`.

## Plex recordings (MQTT)

`media-laptop` (`10.0.0.22`) runs [czampino/plex_recordings](https://github.com/czampino/plex_recordings) and publishes to Mosquitto on this host:

| Topic | Purpose |
|-------|---------|
| `home/plex_recordings/events/scheduled` | Ephemeral push when a new DVR booking is created |
| `home/plex_recordings/events/completed` | Ephemeral push when a recording lands in the library |
| `home/plex_recordings/status` | Retained sync summary (queue, errors, ran_at) |

HA config: `homeassistant/config/command_line.yaml`, `dashboards/recordings.yaml`, `scripts/plex-mqtt-bridge.sh`, and notify automations in `automations.yaml`.

## Home Assistant note

HA config previously lived in [czampino/homeassistant](https://github.com/czampino/homeassistant).  
**This repo (`docker-host/homeassistant/config/`) is the GitOps source of truth** deployed to `/docker/homeassistant/` on the Pi. Mirror changes to `czampino/homeassistant` if you keep that repo for reference.

## Workflows

| Workflow | Triggers |
|----------|----------|
| `deploy.yml` | every push to `main` |
| `runner.yml` | `runner/**` changes |

Both validate service health before completing.
