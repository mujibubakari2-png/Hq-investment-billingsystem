#!/bin/bash

# ─────────────────────────────────────────────────────────────────────────────
# HQ INVESTMENT ISP — Professional RADIUS Diagnostic Tool
# This script performs deep inspection of the RADIUS & VPN stack to identify
# why MikroTik routers are not getting responses from the server.
# ─────────────────────────────────────────────────────────────────────────────

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}       HQ INVESTMENT RADIUS & VPN Diagnostic Tool               ${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""

# 1. System Info
echo -e "${YELLOW}[1/7] System Information...${NC}"
echo "Date: $(date)"
echo "OS: $(lsb_release -ds)"
echo "Kernel: $(uname -r)"

# 2. WireGuard Status
echo ""
echo -e "${YELLOW}[2/7] Checking WireGuard (VPN) Status...${NC}"
if ip addr show wg0 > /dev/null 2>&1; then
    WG_IP=$(ip -4 addr show wg0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}')
    echo -e "${GREEN}✅ wg0 interface is UP${NC}"
    echo "   IP Address: $WG_IP"
    
    PEER_COUNT=$(sudo wg show wg0 peers | wc -l)
    if [ "$PEER_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✅ $PEER_COUNT peer(s) configured in WireGuard${NC}"
        echo "--- Handshake Status ---"
        sudo wg show wg0 latest-handshakes
    else
        echo -e "${RED}❌ No peers found in WireGuard. Check your dashboard config.${NC}"
    fi
else
    echo -e "${RED}❌ wg0 interface is DOWN or not found!${NC}"
    echo "   Did you run setup-vpn.sh?"
fi

# 3. FreeRADIUS Service
echo ""
echo -e "${YELLOW}[3/7] Checking FreeRADIUS Service Status...${NC}"
if systemctl is-active --quiet freeradius; then
    echo -e "${GREEN}✅ FreeRADIUS service is ACTIVE${NC}"
else
    echo -e "${RED}❌ FreeRADIUS service is NOT RUNNING!${NC}"
    echo "   Try: sudo systemctl start freeradius"
fi

# 4. Port Listening
echo ""
echo -e "${YELLOW}[4/7] Checking Port Listening (UDP 1812/1813)...${NC}"
PORT_1812=$(sudo ss -ulnp | grep ":1812" || true)
PORT_1813=$(sudo ss -ulnp | grep ":1813" || true)

if [ -n "$PORT_1812" ]; then
    echo -e "${GREEN}✅ Port 1812 (Auth) is listening${NC}"
    echo "   $PORT_1812"
else
    echo -e "${RED}❌ Port 1812 (Auth) is NOT listening!${NC}"
fi

if [ -n "$PORT_1813" ]; then
    echo -e "${GREEN}✅ Port 1813 (Acct) is listening${NC}"
    echo "   $PORT_1813"
else
    echo -e "${RED}❌ Port 1813 (Acct) is NOT listening!${NC}"
fi

# 5. Firewall Check
echo ""
echo -e "${YELLOW}[5/7] Checking Firewall (UFW) Status...${NC}"
if sudo ufw status | grep -q "active"; then
    echo -e "${BLUE}ℹ️ UFW is active. Verifying rules...${NC}"
    UFW_1812=$(sudo ufw status | grep "1812/udp" || true)
    UFW_WG0=$(sudo ufw status | grep "wg0" || true)
    
    if [ -n "$UFW_1812" ]; then
        echo -e "${GREEN}✅ UFW allows 1812/udp${NC}"
    else
        echo -e "${RED}❌ UFW does NOT allow 1812/udp!${NC}"
        echo "   Run: sudo ufw allow 1812/udp"
    fi
    
    if [ -n "$UFW_WG0" ]; then
        echo -e "${GREEN}✅ UFW allows traffic on wg0 interface${NC}"
    else
        echo -e "${YELLOW}⚠️ UFW might be blocking wg0 interface. Recommended: sudo ufw allow in on wg0${NC}"
    fi
else
    echo -e "${GREEN}✅ UFW is inactive (no local firewall blocking)${NC}"
fi

# 6. Configuration Check (clients.conf)
echo ""
echo -e "${YELLOW}[6/7] Verifying RADIUS Client Configuration...${NC}"
if [ -f /etc/freeradius/3.0/clients.conf ]; then
    if grep -q "HQ INVESTMENT" /etc/freeradius/3.0/clients.conf; then
        echo -e "${GREEN}✅ clients.conf contains HQ INVESTMENT managed clients${NC}"
        # Check subnet
        SUBNET=$(grep -A 5 "client wireguard_subnet" /etc/freeradius/3.0/clients.conf | grep "ipaddr" | awk '{print $3}')
        echo "   Configured Subnet: $SUBNET"
    else
        echo -e "${RED}❌ clients.conf is missing HQ INVESTMENT configuration!${NC}"
        echo "   Please run: sudo bash backend/scripts/setup-freeradius.sh"
    fi
else
    echo -e "${RED}❌ /etc/freeradius/3.0/clients.conf not found!${NC}"
fi

# 7. Real-time Packet Trace (Optional)
echo ""
echo -e "${YELLOW}[7/7] Real-time Traffic Trace...${NC}"
echo -e "${BLUE}We will now listen for RADIUS packets on wg0 for 15 seconds.${NC}"
echo -e "${BLUE}PLEASE GO TO YOUR MIKROTIK AND TRY TO CONNECT A VOUCHER NOW.${NC}"
echo ""

# Check if tcpdump is installed
if command -v tcpdump > /dev/null 2>&1; then
    echo "Listening on wg0 for UDP 1812..."
    sudo timeout 15s tcpdump -i wg0 udp port 1812 -n || echo "Trace finished."
else
    echo -e "${YELLOW}⚠️ tcpdump not installed. Cannot trace packets in real-time.${NC}"
    echo "   To install: sudo apt install tcpdump"
fi

echo ""
echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}                   DIAGNOSTIC COMPLETE                          ${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""
echo -e "${YELLOW}POSSIBLE SOLUTIONS:${NC}"
echo -e "1. ${YELLOW}Secret Mismatch:${NC} Ensure the secret in your .env (RADIUS_NAS_SECRET) matches the one in MikroTik."
echo -e "2. ${YELLOW}DigitalOcean Firewall:${NC} Check DO Control Panel -> Networking -> Firewalls. Ensure UDP 1812/1813/51820 are open."
echo -e "3. ${YELLOW}RADIUS Not Listening:${NC} If FreeRADIUS is active but not listening, it might have a config error. Check: sudo freeradius -X"
echo -e "4. ${YELLOW}PostgreSQL Connectivity:${NC} Check if RADIUS can talk to the DB: sudo journalctl -u freeradius -n 100"
echo ""
