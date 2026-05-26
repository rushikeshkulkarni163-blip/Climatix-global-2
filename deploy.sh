#!/bin/bash
# Climactix Global — EC2 Bootstrap + Deploy Script
# Run once on a fresh Ubuntu 22.04 EC2 instance:
#   curl -sL https://raw.githubusercontent.com/YOUR_REPO/main/deploy.sh | bash
set -e

DOMAIN="climactixglobal.com"
EMAIL="rushikeshkulkarni163@gmail.com"
REPO="https://github.com/YOUR_GITHUB_USERNAME/Climatix-global.git"

echo "▶ Installing system packages..."
apt-get update -q
apt-get install -y -q git docker.io docker-compose-plugin certbot python3-certbot-nginx curl

systemctl enable --now docker

echo "▶ Cloning repository..."
if [ -d /opt/climactix ]; then
  cd /opt/climactix && git pull
else
  git clone "$REPO" /opt/climactix
fi
cd /opt/climactix

echo "▶ Setting up production env..."
if [ ! -f backend/.env.prod ]; then
  cp backend/.env.prod.example backend/.env.prod
  echo ""
  echo "⚠️  Edit /opt/climactix/backend/.env.prod with your API keys before continuing."
  echo "   nano /opt/climactix/backend/.env.prod"
  echo ""
  read -p "Press ENTER when done..."
fi

echo "▶ Obtaining SSL certificate..."
certbot certonly --standalone --non-interactive --agree-tos \
  -m "$EMAIL" -d "$DOMAIN" -d "www.$DOMAIN" || true

echo "▶ Building and starting containers..."
docker compose -f docker-compose.prod.yml up --build -d

echo "▶ Waiting for health check..."
sleep 10
curl -sf "http://localhost/health" && echo " ✓ API healthy" || echo " ✗ Check logs: docker compose -f docker-compose.prod.yml logs api"

echo ""
echo "✅  Climactix is live at https://$DOMAIN"
echo ""
echo "Useful commands:"
echo "  docker compose -f docker-compose.prod.yml logs -f api    # Stream API logs"
echo "  docker compose -f docker-compose.prod.yml restart api    # Restart API"
echo "  docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d  # Update"
