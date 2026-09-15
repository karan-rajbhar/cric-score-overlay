#!/bin/bash
set -euo pipefail

echo "===> [OCI Init] Starting Cloud-Init provisioning for CricScore Overlay..."

# 1. Non-interactive apt configuration
export DEBIAN_FRONTEND=noninteractive

# 2. Configure 4GB swap space (prevents OOM during build/run)
if [ ! -f /swapfile ]; then
  echo "===> [OCI Init] Creating 4GB swapfile..."
  fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl vm.swappiness=10
  echo 'vm.swappiness=10' >> /etc/sysctl.conf
fi

# 3. Update packages and install dependencies
echo "===> [OCI Init] Installing base tools..."
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release iptables-persistent netfilter-persistent git rsync ufw

# 4. Open OCI host firewall for HTTP (80) & HTTPS (443)
echo "===> [OCI Init] Configuring firewall rules for 80/443..."
iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT || iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT || iptables -A INPUT -p tcp --dport 443 -j ACCEPT
iptables -I INPUT 6 -m state --state NEW -p udp --dport 443 -j ACCEPT || iptables -A INPUT -p udp --dport 443 -j ACCEPT
netfilter-persistent save || true

# 5. Install Docker & Docker Compose
echo "===> [OCI Init] Installing Docker CE..."
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 6. Docker group configuration
usermod -aG docker ubuntu
systemctl enable docker
systemctl start docker

# 7. Prepare Application Directory
echo "===> [OCI Init] Preparing /opt/cricscore directory..."
mkdir -p /opt/cricscore
chown -R ubuntu:ubuntu /opt/cricscore

echo "===> [OCI Init] Provisioning completed successfully!"
touch /opt/cricscore/.init_complete
