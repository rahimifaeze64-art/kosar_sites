#!/bin/bash

# Educational Management System - Production Deployment Script
# Usage: ./deploy.sh [SERVER_IP]

set -e  # Exit on error

echo "=================================="
echo "Educational Management System"
echo "Production Deployment Script"
echo "=================================="
echo ""

# Check if SERVER_IP is provided
if [ -z "$1" ]; then
    echo "❌ Error: Server IP not provided"
    echo "Usage: ./deploy.sh YOUR_SERVER_IP"
    exit 1
fi

SERVER_IP=$1
echo "🎯 Target Server: $SERVER_IP"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Step 1: Update API URLs in frontend
print_info "Step 1: Updating API URLs in frontend..."
sed -i "s|baseURL: 'http://127.0.0.1:8000/api'|baseURL: 'http://$SERVER_IP/api'|g" js/api-orders.js
sed -i "s|http://127.0.0.1:8000/api|http://$SERVER_IP/api|g" login.html
print_success "API URLs updated"

# Step 2: Update Django settings
print_info "Step 2: Updating Django settings..."
cat > backend/config/settings_prod.py << EOF
from .settings import *
import os

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', '$(python3 -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())")')
DEBUG = False
ALLOWED_HOSTS = ['$SERVER_IP', 'localhost', '127.0.0.1']

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = []

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

CORS_ALLOWED_ORIGINS = [
    "http://$SERVER_IP",
    "http://localhost",
]

CORS_ALLOW_CREDENTIALS = True

SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'logs' / 'django.log',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['file'],
            'level': 'INFO',
            'propagate': True,
        },
    },
}
EOF
print_success "Django settings updated"

# Step 3: Create deployment package
print_info "Step 3: Creating deployment package..."
DEPLOY_DIR="edu-system-deploy-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEPLOY_DIR"

# Copy necessary files
cp -r backend "$DEPLOY_DIR/"
cp -r js "$DEPLOY_DIR/"
cp -r assets "$DEPLOY_DIR/"
cp -r css "$DEPLOY_DIR/" 2>/dev/null || true
cp *.html "$DEPLOY_DIR/" 2>/dev/null || true
cp *.md "$DEPLOY_DIR/" 2>/dev/null || true

# Create deployment scripts
cat > "$DEPLOY_DIR/install.sh" << 'INSTALL_EOF'
#!/bin/bash
set -e

echo "Installing Educational Management System..."

# Update system
sudo apt update
sudo apt upgrade -y

# Install dependencies
sudo apt install -y python3 python3-pip python3-venv nginx

# Create virtual environment
cd backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn

# Create directories
mkdir -p logs media staticfiles

# Run migrations
export DJANGO_SETTINGS_MODULE=config.settings_prod
python manage.py migrate
python manage.py collectstatic --noinput
python create_default_users.py

echo "✅ Installation complete!"
INSTALL_EOF

chmod +x "$DEPLOY_DIR/install.sh"

# Create tar archive
tar -czf "$DEPLOY_DIR.tar.gz" "$DEPLOY_DIR"
print_success "Deployment package created: $DEPLOY_DIR.tar.gz"

# Step 4: Create deployment instructions
cat > "$DEPLOY_DIR/DEPLOY_INSTRUCTIONS.txt" << EOF
===========================================
Educational Management System
Deployment Instructions
===========================================

1. Upload the package to your server:
   scp $DEPLOY_DIR.tar.gz user@$SERVER_IP:/home/user/

2. SSH to your server:
   ssh user@$SERVER_IP

3. Extract the package:
   tar -xzf $DEPLOY_DIR.tar.gz
   cd $DEPLOY_DIR

4. Run the installation script:
   chmod +x install.sh
   ./install.sh

5. Configure Gunicorn service:
   sudo nano /etc/systemd/system/gunicorn.service
   
   [Copy the content from PRODUCTION_DEPLOYMENT_GUIDE.md]
   
   sudo systemctl start gunicorn
   sudo systemctl enable gunicorn

6. Configure Nginx:
   sudo nano /etc/nginx/sites-available/edu-system
   
   [Copy the content from PRODUCTION_DEPLOYMENT_GUIDE.md]
   [Replace YOUR_SERVER_IP with: $SERVER_IP]
   
   sudo ln -s /etc/nginx/sites-available/edu-system /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx

7. Access your application:
   http://$SERVER_IP

8. Login with default credentials:
   Username: taghizadeh
   Password: taghizadeh

===========================================
For detailed instructions, see:
PRODUCTION_DEPLOYMENT_GUIDE.md
===========================================
EOF

print_success "Deployment instructions created"

# Summary
echo ""
echo "=================================="
echo "📦 Deployment Package Ready!"
echo "=================================="
echo ""
echo "Package: $DEPLOY_DIR.tar.gz"
echo "Size: $(du -h "$DEPLOY_DIR.tar.gz" | cut -f1)"
echo ""
echo "Next steps:"
echo "1. Upload package to server:"
echo "   scp $DEPLOY_DIR.tar.gz user@$SERVER_IP:/home/user/"
echo ""
echo "2. Follow instructions in:"
echo "   $DEPLOY_DIR/DEPLOY_INSTRUCTIONS.txt"
echo ""
echo "3. Or see detailed guide:"
echo "   PRODUCTION_DEPLOYMENT_GUIDE.md"
echo ""
print_success "Deployment preparation complete!"
