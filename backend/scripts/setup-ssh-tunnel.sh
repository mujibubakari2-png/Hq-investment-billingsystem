#!/bin/bash

# setup-ssh-tunnel.sh
# Sets up dropbear for MikroTik reverse tunnel

echo "🔧 Setting up SSH Tunnel (Dropbear)..."

# 1. Create a directory for keys if it doesn't exist
mkdir -p /app/ssh_keys

# 2. Generate Host Key if missing
if [ ! -f /app/ssh_keys/dropbear_rsa_host_key ]; then
    echo "🔑 Generating Dropbear host key..."
    dropbearkey -t rsa -f /app/ssh_keys/dropbear_rsa_host_key
fi

# 3. Handle Authorized Keys from Environment Variable
# The user should set SSH_AUTHORIZED_KEY in Railway
if [ -n "$SSH_AUTHORIZED_KEY" ]; then
    echo "📜 Setting up authorized keys..."
    mkdir -p ~/.ssh
    echo "$SSH_AUTHORIZED_KEY" > ~/.ssh/authorized_keys
    chmod 600 ~/.ssh/authorized_keys
fi

# 4. Start Dropbear on port 2222
# -E: Log to stderr
# -R: Create host keys if they don't exist (but we did it manually)
# -p: Port
# -F: Run in foreground (we will background it in the start script)
echo "🚀 Starting Dropbear on port ${SSH_PORT:-2222}..."
dropbear -E -p ${SSH_PORT:-2222} -r /app/ssh_keys/dropbear_rsa_host_key -F &
DROPBEAR_PID=$!

echo "✅ Dropbear started with PID $DROPBEAR_PID"
