#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# CricScore High-Speed Production Deployer for Oracle Cloud Infrastructure
# ==============================================================================

SERVER_IP="130.210.61.202"
SSH_KEY="$HOME/.ssh/oci_cric_key"
REMOTE_USER="ubuntu"
APP_DIR="/opt/cricscore"

echo "================================================================="
echo "       CricScore Overlay - Fast Production Deployer              "
echo "================================================================="
echo "Target Server : ${SERVER_IP}"
echo "SSH Key       : ${SSH_KEY}"

# 1. Build Docker image locally (fast multi-core build)
echo ""
echo "===> [1/4] Building production Docker image locally..."
docker build -t cricscore-app:latest .

# 2. Sync compose configuration and Caddyfile to remote server
echo ""
echo "===> [2/4] Syncing docker-compose and Caddy configuration..."
ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no "${REMOTE_USER}@${SERVER_IP}" "mkdir -p ${APP_DIR}"
rsync -avz -e "ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no" \
  docker-compose.yml Caddyfile \
  "${REMOTE_USER}@${SERVER_IP}:${APP_DIR}/"

# 3. Stream compressed image directly to remote Docker daemon
echo ""
echo "===> [3/4] Streaming Docker image to remote instance over SSH..."
docker save cricscore-app:latest | gzip -1 | ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no "${REMOTE_USER}@${SERVER_IP}" "docker load"

# 4. Restart containers
echo ""
echo "===> [4/4] Starting updated containers..."
ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no "${REMOTE_USER}@${SERVER_IP}" "cd ${APP_DIR} && docker compose up -d --remove-orphans"

# 5. Verification
echo ""
echo "===> Verifying deployment health..."
sleep 3
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://${SERVER_IP}/api/health" || true)

if [ "${HEALTH_STATUS}" = "200" ]; then
  echo "===> SUCCESS! CricScore is live and healthy!"
  echo "     URL: http://${SERVER_IP}"
  echo "     Health: http://${SERVER_IP}/api/health"
else
  echo "===> Warning: Health endpoint returned HTTP ${HEALTH_STATUS}. Please check container logs:"
  echo "     ssh -i ${SSH_KEY} ${REMOTE_USER}@${SERVER_IP} 'docker compose -f ${APP_DIR}/docker-compose.yml logs'"
fi
