#!/bin/bash
# WireGuard VPN Setup Script for HQInvestment Billing System

echo "🚀 Starting VPN Setup..."

# 1. Install WireGuard
sudo apt update
sudo apt install -y wireguard iptables

# 2. Generate Server Keys
SERVER_PRIVATE_KEY=$(wg genkey)
SERVER_PUBLIC_KEY=$(echo "$SERVER_PRIVATE_KEY" | wg pubkey)
ETH_INTERFACE=$(ip route list default | awk '{print $5}')

# 3. Create Configuration
cat <<EOF | sudo tee /etc/wireguard/wg0.conf
[Interface]
PrivateKey = $SERVER_PRIVATE_KEY
Address = 10.0.0.1/24
ListenPort = 51820
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o $ETH_INTERFACE -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o $ETH_INTERFACE -j MASQUERADE

# Peer definitions will be added below manually or via backend
EOF

# 4. Enable IP Forwarding
echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# 5. Start and Enable Service
sudo systemctl enable wg-quick@wg0
sudo systemctl start wg-quick@wg0

# 6. Configure Firewall
sudo ufw allow 51820/udp

echo "✅ VPN Setup Finished!"
echo "--------------------------------------------------"
echo "SERVER PUBLIC KEY: $SERVER_PUBLIC_KEY"
echo "SERVER VPN IP: 10.0.0.1"
echo "--------------------------------------------------"
echo "Use the Public Key above to configure your MikroTik."
