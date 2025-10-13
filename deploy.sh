#!/bin/bash

# Deployment script for WhatsApp Gateway Backend
# VPS IP: 158.220.108.90

echo "🚀 Starting deployment to VPS..."

# Update package list and install dependencies
echo "📦 Installing system dependencies..."
sudo apt update
sudo apt install -y nodejs npm nginx mysql-server certbot python3-certbot-nginx ufw

# Install Node.js 18.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Configure firewall
echo "🔒 Configuring firewall..."
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 3000
sudo ufw --force enable

# Navigate to project directory (adjust path as needed)
cd /home/ubuntu/whatsapp_gateway_backend

# Install npm dependencies
echo "📦 Installing npm dependencies..."
npm install

# Build the application
echo "🔨 Building the application..."
npm run build

# Create production .env file (you'll need to update these values)
echo "⚙️ Creating production environment file..."
cat > .env << EOL
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://158.220.108.90,http://158.220.108.90,http://localhost:3000

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=whatsapp_user
DB_PASSWORD=your_secure_db_password_here
DB_DATABASE=whatsapp_gateway

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-key-here-make-it-long-and-random-at-least-32-chars

# WhatsApp API Configuration
WHATSAPP_API_URL=https://graph.facebook.com/v22.0
WHATSAPP_API_TOKEN=your_whatsapp_api_token_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here

# Webhook Configuration
WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token_here
EOL

# Set up MySQL database
echo "🗄️ Setting up MySQL database..."
sudo mysql -e "CREATE DATABASE IF NOT EXISTS whatsapp_gateway;"
sudo mysql -e "CREATE USER IF NOT EXISTS 'whatsapp_user'@'localhost' IDENTIFIED BY 'your_secure_db_password_here';"
sudo mysql -e "GRANT ALL PRIVILEGES ON whatsapp_gateway.* TO 'whatsapp_user'@'localhost';"
sudo mysql -e "FLUSH PRIVILEGES;"

# Set up PM2 for process management
echo "⚙️ Installing PM2..."
sudo npm install -g pm2

# Create PM2 ecosystem file with socket.io support
cat > ecosystem.config.json << EOL
{
  "apps": [{
    "name": "whatsapp-gateway",
    "script": "dist/main.js",
    "instances": 1,
    "exec_mode": "fork",
    "env": {
      "NODE_ENV": "production"
    },
    "error_file": "logs/err.log",
    "out_file": "logs/out.log",
    "log_file": "logs/combined.log",
    "time": true,
    "max_memory_restart": "1G",
    "node_args": "--max-old-space-size=1024"
  }]
}
EOL

# Create logs directory
mkdir -p logs

# Start the application with PM2
echo "🚀 Starting the application..."
pm2 start ecosystem.config.json

# Save PM2 process list and set up startup script
pm2 save
pm2 startup

# Set up Nginx reverse proxy with WebSocket support
echo "🌐 Setting up Nginx with WebSocket support..."
sudo cat > /etc/nginx/sites-available/whatsapp-gateway << EOL
server {
    listen 80;
    server_name 158.220.108.90;

    # Main API routes
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }

    # WhatsApp webhook endpoint
    location /webhook {
        proxy_pass http://localhost:3000/webhook;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }

    # Socket.IO WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }

    # Default route (for health checks)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }
}
EOL

# Enable the site and restart Nginx
sudo ln -sf /etc/nginx/sites-available/whatsapp-gateway /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Set up SSL with Let's Encrypt (optional)
echo "🔒 Setting up SSL certificate..."
sudo certbot --nginx -d 158.220.108.90 --non-interactive --agree-tos --email your-email@example.com

echo "✅ Deployment completed!"
echo "📋 Next steps:"
echo "1. Update the .env file with your actual credentials:"
echo "   - DB_PASSWORD: Set a secure database password"
echo "   - JWT_SECRET: Generate a secure JWT secret (at least 32 characters)"
echo "   - WHATSAPP_API_TOKEN: Your WhatsApp Business API token"
echo "   - WHATSAPP_PHONE_NUMBER_ID: Your WhatsApp phone number ID"
echo "   - WEBHOOK_VERIFY_TOKEN: A secure token for webhook verification"
echo "2. Update CORS_ORIGIN in .env to match your frontend domain"
echo "3. Restart the application: pm2 restart whatsapp-gateway"
echo "4. Check logs: pm2 logs whatsapp-gateway"
echo "5. Test the API: curl https://158.220.108.90/api"
echo "6. Test WebSocket: Connect to wss://158.220.108.90/socket.io/"
echo "7. Test webhook: curl https://158.220.108.90/webhook"
echo ""
echo "🌐 Your WhatsApp Gateway is now running at:"
echo "   API: https://158.220.108.90/api"
echo "   WebSocket: wss://158.220.108.90/socket.io/"
echo "   Webhook: https://158.220.108.90/webhook"
echo ""
echo "🔧 Useful commands:"
echo "   pm2 status - Check application status"
echo "   pm2 logs whatsapp-gateway - View logs"
echo "   pm2 restart whatsapp-gateway - Restart application"
echo "   sudo systemctl status nginx - Check Nginx status"
echo "   sudo tail -f /var/log/nginx/error.log - View Nginx errors"
