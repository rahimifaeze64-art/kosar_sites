#!/usr/bin/env python3
"""
Django Project Setup Script
This script sets up the Django project structure for the educational management system.
"""

import os
import subprocess
import sys

def run_command(command, description):
    """Run a command and handle errors"""
    print(f"\n🔄 {description}...")
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {description} completed successfully")
        if result.stdout:
            print(f"Output: {result.stdout}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Error in {description}: {e}")
        if e.stderr:
            print(f"Error details: {e.stderr}")
        return False

def create_django_project():
    """Create Django project and apps"""
    
    # Create virtual environment
    if not run_command("python -m venv venv", "Creating virtual environment"):
        return False
    
    # Activate virtual environment and install requirements
    if os.name == 'nt':  # Windows
        activate_cmd = "venv\\Scripts\\activate && pip install -r requirements.txt"
    else:  # Unix/Linux/Mac
        activate_cmd = "source venv/bin/activate && pip install -r requirements.txt"
    
    if not run_command(activate_cmd, "Installing Django and dependencies"):
        return False
    
    # Create Django project
    if os.name == 'nt':  # Windows
        django_cmd = "venv\\Scripts\\activate && django-admin startproject edu_system ."
    else:
        django_cmd = "source venv/bin/activate && django-admin startproject edu_system ."
    
    if not run_command(django_cmd, "Creating Django project"):
        return False
    
    # Create Django apps
    apps = ['accounts', 'students', 'orders', 'files', 'dashboard', 'api']
    
    for app in apps:
        if os.name == 'nt':  # Windows
            app_cmd = f"venv\\Scripts\\activate && python manage.py startapp {app}"
        else:
            app_cmd = f"source venv/bin/activate && python manage.py startapp {app}"
        
        if not run_command(app_cmd, f"Creating {app} app"):
            return False
    
    print("\n🎉 Django project setup completed successfully!")
    print("\nNext steps:")
    print("1. Configure PostgreSQL database")
    print("2. Update settings.py with database configuration")
    print("3. Create and run migrations")
    print("4. Create superuser")
    
    return True

if __name__ == "__main__":
    print("🚀 Setting up Django Educational Management System...")
    create_django_project()