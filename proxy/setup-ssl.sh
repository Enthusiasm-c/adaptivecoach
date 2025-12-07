#!/bin/bash

# SSL Setup Script with Let's Encrypt
# Usage: ./setup-ssl.sh domain.com

set -e

DOMAIN=${1:-"api.adaptivecoach.app"}
SERVER="nota-server"
DEPLOY_DIR="/opt/adaptivecoach-proxy"
EMAIL="admin@$DOMAIN"

echo "🔐 Setting up SSL for $DOMAIN"

# Check if domain points to server
echo "📡 Checking DNS..."
EXPECTED_IP="209.38.85.196"
ACTUAL_IP=$(dig +short $DOMAIN | head -1)

if [ "$ACTUAL_IP" != "$EXPECTED_IP" ]; then
    echo "⚠️  Warning: $DOMAIN points to $ACTUAL_IP, expected $EXPECTED_IP"
    echo "Please update your DNS records first!"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Install certbot and get certificate
ssh $SERVER "
# Install certbot if needed
if ! command -v certbot &> /dev/null; then
    apt-get update
    apt-get install -y certbot
fi

# Stop nginx temporarily
cd $DEPLOY_DIR
docker compose --profile with-nginx down nginx 2>/dev/null || true

# Get certificate
certbot certonly --standalone -d $DOMAIN --email $EMAIL --agree-tos --non-interactive

# Copy certificates to nginx directory
cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $DEPLOY_DIR/nginx/ssl/
cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $DEPLOY_DIR/nginx/ssl/

# Update nginx config with actual domain
sed -i 's/api.adaptivecoach.app/$DOMAIN/g' $DEPLOY_DIR/nginx/nginx.conf

# Start nginx
docker compose --profile with-nginx up -d nginx

# Setup auto-renewal
echo '0 12 * * * root certbot renew --quiet && cp /etc/letsencrypt/live/$DOMAIN/*.pem $DEPLOY_DIR/nginx/ssl/ && docker exec adaptivecoach-nginx nginx -s reload' > /etc/cron.d/certbot-renewal
"

echo ""
echo "✅ SSL setup complete!"
echo "Your API is now available at: https://$DOMAIN"
