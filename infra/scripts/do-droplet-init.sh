#!/usr/bin/env bash
# Initial setup script for a Tukio DigitalOcean droplet.
# Idempotent — safe to re-run.
#
# Usage:
#   ssh root@<droplet-ip> 'bash -s apps' < do-droplet-init.sh
#   ssh root@<droplet-ip> 'bash -s data' < do-droplet-init.sh
#
# Arguments:
#   $1 — role: "apps" or "data" (controls which deps + dirs are provisioned)

set -euo pipefail

ROLE="${1:-}"
if [[ "$ROLE" != "apps" && "$ROLE" != "data" ]]; then
  echo "ERROR: role must be 'apps' or 'data' (got: '$ROLE')" >&2
  echo "Usage: $0 <apps|data>" >&2
  exit 1
fi

echo "──────────────────────────────────────────────────────────────"
echo "  Tukio droplet initial setup — role: $ROLE"
echo "──────────────────────────────────────────────────────────────"

# ─── 0. Install Docker Engine if missing (base Ubuntu image) ─────────
# Supports both the docker-20-04 Marketplace image (Docker pre-installed)
# AND the ubuntu-24-04-x64 base image (Docker absent — installed below).
if ! command -v docker >/dev/null 2>&1; then
  echo "[0/9] Installing Docker Engine via get.docker.com..."
  DEBIAN_FRONTEND=noninteractive apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq curl ca-certificates
  curl -fsSL https://get.docker.com | sh >/dev/null
  systemctl enable --now docker
else
  echo "[0/9] Docker already installed — skipping install."
fi

# ─── 1. Create non-root user `tukio` ─────────────────────────────────
if ! id -u tukio >/dev/null 2>&1; then
  echo "[1/8] Creating user tukio (UID 1001)..."
  useradd -m -u 1001 -s /bin/bash -G docker,sudo tukio
  echo "tukio ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/tukio
  chmod 0440 /etc/sudoers.d/tukio
else
  echo "[1/8] User tukio already exists — skipping."
fi

# Copy root authorized_keys to tukio's home (one-time, only on first run).
if [[ ! -f /home/tukio/.ssh/authorized_keys ]]; then
  echo "      Copying SSH authorized_keys from root → tukio..."
  mkdir -p /home/tukio/.ssh
  if [[ -f /root/.ssh/authorized_keys ]]; then
    cp /root/.ssh/authorized_keys /home/tukio/.ssh/authorized_keys
  else
    # No root authorized_keys (e.g. password-only provisioning).
    # Create empty file — operator must add their public key manually.
    touch /home/tukio/.ssh/authorized_keys
    echo "WARN: /root/.ssh/authorized_keys not found — created empty file." >&2
    echo "      Add your SSH public key to /home/tukio/.ssh/authorized_keys before" >&2
    echo "      running step 2 (PermitRootLogin no will lock you out otherwise)." >&2
  fi
  chmod 700 /home/tukio/.ssh
  chmod 600 /home/tukio/.ssh/authorized_keys
  chown -R tukio:tukio /home/tukio/.ssh
fi

# ─── 2. Harden SSH: disable root login + password auth ───────────────
echo "[2/8] Hardening SSH..."
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config
# Ubuntu 22.04+ uses `ssh.service`, older releases use `sshd.service` — try both.
if systemctl list-unit-files ssh.service >/dev/null 2>&1; then
  systemctl restart ssh.service
elif systemctl list-unit-files sshd.service >/dev/null 2>&1; then
  systemctl restart sshd.service
else
  echo "WARN: neither ssh.service nor sshd.service found — SSH config changes not applied." >&2
fi

# ─── 3. System updates + unattended-upgrades ─────────────────────────
echo "[3/8] Installing unattended-upgrades..."
DEBIAN_FRONTEND=noninteractive apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq unattended-upgrades apt-listchanges
dpkg-reconfigure -f noninteractive unattended-upgrades

# Configure unattended-upgrades to apply security patches automatically.
cat > /etc/apt/apt.conf.d/52unattended-upgrades-tukio <<'EOF'
Unattended-Upgrade::Allowed-Origins {
  "${distro_id}:${distro_codename}-security";
  "${distro_id}ESMApps:${distro_codename}-apps-security";
  "${distro_id}ESM:${distro_codename}-infra-security";
};
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
EOF

# ─── 4. fail2ban (anti-brute-force SSH) ──────────────────────────────
# We rely on Ubuntu's default sshd jail (defaults-debian.conf):
# maxretry=5, findtime=600, bantime=600 — lenient enough to avoid
# self-lockout while still mitigating obvious brute-force.
# PasswordAuthentication=no (step 2) makes brute-force ineffective anyway.
# Earlier iteration installed a stricter override (maxretry=3, bantime=3600)
# but it caused founder lockout during init testing — kept defaults instead.
echo "[4/8] Installing fail2ban (default Ubuntu jail config)..."
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq fail2ban
# Remove any prior aggressive override (idempotent — survives previous runs).
rm -f /etc/fail2ban/jail.d/tukio-ssh.conf
systemctl enable --now fail2ban
systemctl restart fail2ban

# ─── 5. Verify Docker + compose plugin versions ──────────────────────
echo "[5/8] Verifying Docker..."
DOCKER_VERSION=$(docker --version | grep -oE '[0-9]+\.[0-9]+' | head -1)
DOCKER_MAJOR=$(echo "${DOCKER_VERSION}" | cut -d. -f1)
COMPOSE_VERSION=$(docker compose version --short 2>/dev/null || echo "0")
if [[ -z "$DOCKER_VERSION" ]]; then
  echo "FATAL: Docker missing after install attempt (step 0)." >&2
  exit 1
fi
if [[ "${DOCKER_MAJOR:-0}" -lt 24 ]]; then
  echo "FATAL: Docker ${DOCKER_VERSION} < 24 — upgrade required (get.docker.com)." >&2
  exit 1
fi
echo "      Docker $DOCKER_VERSION ✓, Compose $COMPOSE_VERSION"

# ─── 6. Create Tukio dirs + logrotate ────────────────────────────────
echo "[6/8] Creating Tukio dirs..."
mkdir -p /var/log/tukio
chown tukio:tukio /var/log/tukio
mkdir -p /home/tukio/tukio/secrets
chmod 700 /home/tukio/tukio/secrets
chown -R tukio:tukio /home/tukio/tukio

# logrotate config for Tukio application logs (backup.log, snapshot.log, etc.)
cat > /etc/logrotate.d/tukio <<'EOF'
/var/log/tukio/*.log {
  daily
  missingok
  rotate 14
  compress
  delaycompress
  notifempty
  create 640 tukio tukio
}
EOF

# Data droplet: prepare PG bind-mount dir + backup-postgres.sh working dir.
if [[ "$ROLE" == "data" ]]; then
  mkdir -p /var/lib/tukio/postgres
  chown 999:999 /var/lib/tukio/postgres  # postgres:16-alpine UID
  mkdir -p /var/lib/tukio/backups
  chown tukio:tukio /var/lib/tukio/backups  # backup-postgres.sh runs as tukio
fi

# ─── 7. rclone (only on data droplet — for backups to R2) ────────────
if [[ "$ROLE" == "data" ]]; then
  echo "[7/8] Installing rclone..."
  if ! command -v rclone >/dev/null 2>&1; then
    curl -fsSL https://rclone.org/install.sh | bash >/dev/null 2>&1
  else
    echo "      rclone already installed: $(rclone version | head -1)"
  fi
else
  echo "[7/8] Skipping rclone (apps role)."
fi

# ─── 8. doctl (for snapshots — installed on both droplets) ───────────
echo "[8/8] Installing doctl..."
if ! command -v doctl >/dev/null 2>&1; then
  DOCTL_VERSION=$(curl -fsSL https://api.github.com/repos/digitalocean/doctl/releases/latest \
    | grep -oE '"tag_name":\s*"v[0-9.]+"' | head -1 | grep -oE '[0-9.]+')
  curl -fsSL "https://github.com/digitalocean/doctl/releases/download/v${DOCTL_VERSION}/doctl-${DOCTL_VERSION}-linux-amd64.tar.gz" \
    | tar -xz -C /usr/local/bin doctl
  chmod +x /usr/local/bin/doctl
else
  echo "      doctl already installed: $(doctl version | head -1)"
fi

echo "──────────────────────────────────────────────────────────────"
echo "  ✅ Droplet ready (role: $ROLE)"
echo ""
echo "  Next steps (run as tukio user):"
echo "    1. SSH as tukio: ssh tukio@<this-ip>"
echo "    2. Clone the repo:"
echo "         git clone https://github.com/MohamedXi/tukio ~/tukio"
echo "         (or use deploy key: eval \"\$(ssh-agent)\" && ssh-add ~/.ssh/id_ed25519)"
echo "    3. Provision secrets:"
echo "         ~/tukio/infra/scripts/provision-secrets.sh $ROLE"
echo "    4. Authenticate doctl (for DO snapshots):"
echo "         doctl auth init --access-token \$DO_TOKEN"
if [[ "$ROLE" == "data" ]]; then
  echo "    5. Configure rclone for R2:"
  echo "         rclone config  (provider: Cloudflare R2)"
  echo "    6. Export Keycloak DB credentials before compose up:"
  echo "         export KC_DB_USERNAME=\$(cat ~/tukio/secrets/kc_db_username)"
  echo "         export KC_DB_PASSWORD=\$(cat ~/tukio/secrets/kc_db_password)"
  echo "    7. Start data stack:"
  echo "         cd ~/tukio && docker compose -f infra/docker-compose/data.prod.yml up -d --wait"
else
  echo "    5. Login GHCR: docker login ghcr.io -u MohamedXi"
  echo "    6. Create .env.staging (copy from .env.production template, set IMAGE_TAG=develop):"
  echo "         cp ~/tukio/infra/docker-compose/.env.production.example ~/tukio-apps/.env.staging"
  echo "    7. Start apps stack:"
  echo "         cd ~/tukio && docker compose -f infra/docker-compose/apps.prod.yml up -d"
fi
echo "──────────────────────────────────────────────────────────────"
