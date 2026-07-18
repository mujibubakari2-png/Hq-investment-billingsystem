#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting Droplet Setup for HQ INVESTMENT ISP Billing System..."

# 1. Update and install basic dependencies
sudo apt-get update
sudo apt-get install -y curl git wget build-essential nginx

# 2. Create 2 GB swap file to prevent OOM-kills during builds
echo "💾 Creating 2 GB swap file..."
if [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  # Tune swappiness so swap is only used as a safety net
  sudo sysctl vm.swappiness=10
  echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
  echo "✅ Swap created and enabled (2 GB)"
else
  echo "ℹ️  Swap file already exists, skipping."
fi

# 3. Install Node.js (LTS)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# 4. Install pnpm
sudo npm install -g pnpm

# 5. Install PM2
sudo npm install -g pm2

# 6. Install Docker & Docker Compose v2
sudo apt-get install -y docker.io
sudo systemctl enable docker
sudo systemctl start docker

# 7. Configure Nginx (Basic placeholder)
echo "🔧 Configuring Nginx..."
sudo rm -f /etc/nginx/sites-enabled/default

# 8. Create directory for frontend static files
echo "📁 Creating frontend static files directory..."
sudo mkdir -p /var/www/html/billing
sudo chown -R $USER:$USER /var/www/html/billing

# 9. Add user to docker group (so sudo isn't needed for docker)
sudo usermod -aG docker $USER

echo "✅ Setup complete! Please log out and log back in for docker group changes to take effect."
echo "Next: Clone your repo, setup .env, build, run 'docker compose up -d', copy frontend to /var/www/html/billing, then run 'pm2 start ecosystem.config.js'"
echo ""
echo "📝 Build note: The frontend build script uses --max-old-space-size=1536 to cap"
echo "   Node's heap. Combined with the swap above, OOM kills should no longer occur."
