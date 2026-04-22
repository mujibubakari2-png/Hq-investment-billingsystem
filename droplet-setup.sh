#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting Droplet Setup for Kenge ISP Billing System..."

# 1. Update and install basic dependencies
sudo apt-get update
sudo apt-get install -y curl git wget build-essential nginx

# 2. Install Node.js (LTS)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Install pnpm
sudo npm install -g pnpm

# 4. Install PM2
sudo npm install -g pm2

# 5. Install Docker & Docker Compose
sudo apt-get install -y docker.io docker-compose
sudo systemctl enable docker
sudo systemctl start docker

# 6. Configure Nginx (Basic placeholder)
echo "🔧 Configuring Nginx..."
sudo rm -f /etc/nginx/sites-enabled/default

# 7. Add user to docker group (so sudo isn't needed for docker)
sudo usermod -aG docker $USER

echo "✅ Setup complete! Please log out and log back in for docker group changes to take effect."
echo "Next: Clone your repo, setup .env, and run 'docker-compose up -d' followed by 'pm2 start ecosystem.config.js'"
