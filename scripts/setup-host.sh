#!/bin/bash
set -euo pipefail

echo "===> [Remote Setup] Installing Docker CE and configuring environment..."
export DEBIAN_FRONTEND=noninteractive

# Ensure iptables persist
mkdir -p /etc/iptables
iptables-save > /etc/iptables/rules.v4

# Install Docker dependencies
apt-get update -y
apt-get install -y ca-certificates curl gnupg git rsync

# Set up Docker official repository
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Configure docker permissions
usermod -aG docker ubuntu
systemctl enable docker
systemctl restart docker

# Create app directory
mkdir -p /opt/cricscore
chown -R ubuntu:ubuntu /opt/cricscore
touch /opt/cricscore/.init_complete

echo "===> [Remote Setup] Docker setup and initialization complete!"
docker --version
docker compose version
