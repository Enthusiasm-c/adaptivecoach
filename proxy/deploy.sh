#!/bin/bash

# AdaptiveCoach Proxy Deployment Script
# Usage: ./deploy.sh [domain]

set -e

DOMAIN=${1:-"api.adaptivecoach.app"}
SERVER="nota-server"
DEPLOY_DIR="/opt/adaptivecoach-proxy"

echo "🚀 Deploying AdaptiveCoach Proxy to $SERVER"

# Check SSH connection
echo "📡 Testing SSH connection..."
ssh -o ConnectTimeout=10 $SERVER "echo 'Connected successfully'" || {
    echo "❌ Cannot connect to server. Check if server is running."
    exit 1
}

# Create deployment directory on server
echo "📁 Creating deployment directory..."
ssh $SERVER "mkdir -p $DEPLOY_DIR/nginx/ssl $DEPLOY_DIR/logs"

# Copy files to server
echo "📦 Copying files..."
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'logs/*' \
    ./ $SERVER:$DEPLOY_DIR/

# Create .env file if it doesn't exist
ssh $SERVER "
if [ ! -f $DEPLOY_DIR/.env ]; then
    echo '⚙️ Creating .env file...'
    cat > $DEPLOY_DIR/.env << 'EOF'
PORT=3001
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
CLIENT_API_KEY=$(openssl rand -hex 32)
ALLOWED_ORIGIN=https://adaptivecoach.vercel.app
EOF
    echo '⚠️  Please edit $DEPLOY_DIR/.env with your actual API keys!'
fi
"

# Install Docker if not present
echo "🐳 Checking Docker..."
ssh $SERVER "
if ! command -v docker &> /dev/null; then
    echo 'Installing Docker...'
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi
"

# Build and start containers
echo "🔨 Building and starting containers..."
ssh $SERVER "
cd $DEPLOY_DIR
docker compose down || true
docker compose build --no-cache
docker compose up -d proxy
"

# Wait for service to start
echo "⏳ Waiting for service to start..."
sleep 5

# Check health
echo "🏥 Checking health..."
ssh $SERVER "curl -s http://localhost:3001/health" && echo ""

# Setup SSL with Let's Encrypt (optional)
echo ""
echo "✅ Proxy deployed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Edit /opt/adaptivecoach-proxy/.env on server with your API keys"
echo "2. (Optional) Setup SSL with: ./setup-ssl.sh $DOMAIN"
echo "3. Update your app to use: http://209.38.85.196:3001/api/gemini"
echo ""
echo "🔑 Your CLIENT_API_KEY is in the .env file on the server"
