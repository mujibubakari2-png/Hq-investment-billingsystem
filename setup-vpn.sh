#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# WireGuard VPN Setup Script for HQ INVESTMENT Billing System
# Run this once on your droplet/VPS to initialize the VPN server
# ═══════════════════════════════════════════════════════════════

set -e  # Exit immediately on error

echo "🚀 Starting HQ INVESTMENT VPN Setup..."

# 1. Install WireGuard
sudo apt update
sudo apt install -y wireguard iptables

# 2. Generate server keys (NEVER hardcode these — generate fresh each time)
echo "🔑 Generating WireGuard server keys..."
SERVER_PRIVATE_KEY=$(wg genkey)
SERVER_PUBLIC_KEY=$(echo "$SERVER_PRIVATE_KEY" | wg pubkey)
ETH_INTERFACE=$(ip route list default | awk '{print $5}')

echo "   WAN Interface detected: $ETH_INTERFACE"

# 3. Create Configuration
cat <<EOF | sudo tee /etc/wireguard/wg0.conf
[Interface]
PrivateKey = $SERVER_PRIVATE_KEY
Address = 10.0.0.1/24
ListenPort = 51820
# Enable NAT so MikroTik tunnel clients can route through this server if needed
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o $ETH_INTERFACE -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o $ETH_INTERFACE -j MASQUERADE

# NOTE: MikroTik router peers are added dynamically by the billing system backend.
# DO NOT add peers manually here — they will be overwritten.
EOF

# 4. Secure the config file (private key must not be world-readable)
sudo chmod 600 /etc/wireguard/wg0.conf

# 5. Enable IP Forwarding
echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# 6. Start and Enable Service
sudo systemctl enable wg-quick@wg0
sudo systemctl start wg-quick@wg0

# 7. Configure Firewall (UFW)
echo "🛡️  Configuring UFW firewall rules..."
sudo ufw allow 51820/udp comment 'WireGuard VPN'
sudo ufw allow in on wg0 comment 'Allow all traffic from WireGuard VPN peers'
sudo ufw allow 1812/udp comment 'RADIUS Authentication'
sudo ufw allow 1813/udp comment 'RADIUS Accounting'
sudo ufw allow 3799/udp comment 'RADIUS CoA (Disconnect/Change-of-Authorization)'
sudo ufw allow 80/tcp comment 'Billing Portal HTTP'
sudo ufw allow 443/tcp comment 'Billing Portal HTTPS'
sudo ufw allow 22/tcp comment 'SSH Management'

echo ""
echo "✅ VPN Setup Complete!"
echo "══════════════════════════════════════════════════════"
echo "  SERVER PUBLIC KEY : $SERVER_PUBLIC_KEY"
echo "  SERVER VPN IP     : 10.0.0.1"
echo "  LISTEN PORT       : 51820"
echo "══════════════════════════════════════════════════════"
echo ""
echo "⚠️  IMPORTANT: Save the server public key above."
echo "   Add it to your .env file as: WG_SERVER_PUBLIC_KEY=$SERVER_PUBLIC_KEY"
echo "   The private key is stored securely in /etc/wireguard/wg0.conf"
echo ""
echo "   MikroTik router peers will be added automatically"
echo "   when you click 'Auto-Push to Router' in the dashboard."
