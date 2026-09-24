#!/usr/bin/env bash
# Generates a local, self-signed HTTPS certificate for the mock backend, so the camera can be
# tested from another device (a real phone) on the same network. Never leaves this network,
# never committed (see .gitignore). Re-run this if your LAN IP address changes.
set -euo pipefail
cd "$(dirname "$0")/.."

LAN_IP="${1:-}"
if [ -z "$LAN_IP" ]; then
  echo "Usage: $0 <your-lan-ip>"
  echo "Find it with: ipconfig (Windows) or ifconfig/ip addr (Linux/macOS)"
  exit 1
fi

mkdir -p .certs-local
MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout .certs-local/key.pem -out .certs-local/cert.pem -days 30 \
  -subj "/CN=intern-manager-local" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:${LAN_IP}"

echo "Certificate written to .certs-local/ (git-ignored)."
echo "Start with: HOST=0.0.0.0 HTTPS=1 npm start"
