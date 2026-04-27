#!/usr/bin/env bash
set -euo pipefail
HOST="balazs@192.168.2.60"
KEY="$HOME/.ssh/id_ed25519"

echo "→ build server"
npm run build

echo "→ build frontend"
cd packages/web && npm run build && cd ../..

echo "→ rsync to VM"
ssh -i "$KEY" "$HOST" "sudo mkdir -p /opt/marquee && sudo chown balazs:balazs /opt/marquee"
rsync -e "ssh -i $KEY" -az --delete \
  --include 'packages/server/dist/***' \
  --include 'packages/server/drizzle/***' \
  --include 'packages/server/package.json' \
  --include 'packages/web/dist/***' \
  --include 'packages/*/' \
  --include 'packages/' \
  --include 'infra/***' \
  --include 'infra/' \
  --include 'package.json' \
  --include 'package-lock.json' \
  --exclude '*' \
  ./ "$HOST:/opt/marquee/"

echo "→ npm install (prod deps only)"
ssh -i "$KEY" "$HOST" "cd /opt/marquee && npm install --omit=dev"

echo "→ install systemd unit"
ssh -i "$KEY" "$HOST" "sudo cp /opt/marquee/infra/marquee.service /etc/systemd/system/marquee.service && sudo systemctl daemon-reload"

echo "→ disable old wuphf service (if present)"
ssh -i "$KEY" "$HOST" "sudo systemctl disable --now wuphf 2>/dev/null || true"

echo "→ restart marquee"
ssh -i "$KEY" "$HOST" "sudo systemctl enable --now marquee && sudo systemctl status marquee --no-pager"

echo "✓ deploy complete"
