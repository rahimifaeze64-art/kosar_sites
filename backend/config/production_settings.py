"""
Production settings for PythonAnywhere deployment
"""
from .settings import *

# SECURITY WARNING: Change this in production!
SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-CHANGE-THIS-IN-PRODUCTION')

# Debug should be False in production
DEBUG = False

# Add your PythonAnywhere domain
ALLOWED_HOSTS = [
    'yourusername.pythonanywhere.com',  # Replace with your actual username
    'localhost',
    '127.0.0.1',
]

# CORS settings for production
CORS_ALLOWED_ORIGINS = [
    "https://yourusername.pythonanywhere.com",  # Replace with your actual domain
]

# Static files
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Security settings
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'SAMEORIGIN'
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True
