# GitHub Actions Runner (Pi docker host)

Native self-hosted runner on `raspberrypi5` (`10.0.0.4`) for GitOps deploys.

## Installation

Runner binary: `/home/pi/actions-runner`  
Label: `docker-host`

### First-time setup on the Pi

```bash
# On 10.0.0.4 as pi
mkdir -p ~/actions-runner && cd ~/actions-runner
# Download latest arm64 runner from GitHub → Actions → Runners → New self-hosted runner
curl -o actions-runner-linux-arm64.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.321.0/actions-runner-linux-arm64-2.321.0.tar.gz
tar xzf actions-runner-linux-arm64.tar.gz

# Registration token: GitHub repo → Settings → Actions → Runners → New self-hosted runner
./config.sh --unattended \
  --url https://github.com/z0mp22/docker-host \
  --token YOUR_TOKEN \
  --name raspberrypi5 \
  --labels docker-host

# Install as a service (survives reboot)
sudo ./svc.sh install pi
sudo ./svc.sh start
```

Or use `runner/manage.sh start` for a foreground/nohup install.

## Usage

```bash
./runner/manage.sh status
./runner/manage.sh start
./runner/manage.sh stop
```

## CI

- `deploy.yml` — sync repo to `/docker`, `docker compose up -d`, validate health
- `runner.yml` — ensure the listener is running after runner script changes

The runner user (`pi`) must have Docker access (`docker` group) and passwordless sudo is **not** required.

## Notes

- Deploy workflows use `[self-hosted, docker-host]`
- Secrets stay on the host: `/docker/.env`, `/docker/pihole-exporter/.env`, `/docker/unifi-poller/up.conf`, `/docker/homeassistant/secrets.yaml`
