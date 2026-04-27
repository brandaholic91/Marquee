#!/usr/bin/env bash
# First-run setup on VM 260. Run once via: bash scripts/install-on-vm.sh
set -euo pipefail

# Install Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Create data directory
mkdir -p ~/.marquee/memory
mkdir -p ~/.marquee/skills

# Create .env template
cat > /opt/marquee/.env.example << 'EOF'
# Marquee configuration
DATA_DIR=/home/balazs/.marquee
PORT=7892
HERMES_PROVIDER_MODE=flat
# For api mode:
# OPENROUTER_API_KEY=sk-or-...
# HERMES_PROVIDER_MODE=api
EOF

echo "✓ VM setup complete. Copy /opt/marquee/.env.example to /opt/marquee/.env and fill in secrets."
