#!/usr/bin/env python
"""
Create default users for production deployment
Run this script after migrations: python create_default_users.py
"""

import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from django.db import transaction

User = get_user_model()

DEFAULT_USERS = [
    {
        'username': 'taghizadeh',
        'password': 'taghizadeh',
        'first_name': 'عامل',
        'last_name': 'تقی زاده',
        'email': 'taghizadeh@alkawsar.com',
        'role': 'manager',
        'phone': '+98 912 123 4567',
        'active': True,
        'is_staff': True,
        'is_superuser': True,
    },
    {
        'username': 'sakhaei',
        'password': 'Z@z12345',
        'first_name': 'سخایی',
        'last_name': '',
        'email': 'sakhaei@alkawsar.com',
        'role': 'employee',
        'phone': '+98 912 234 5678',
        'active': True,
        'is_staff': False,
        'is_superuser': False,
    },
    {
        'username': 'farzad',
        'password': 'F@f12345',
        'first_name': 'فرزاد',
        'last_name': '',
        'email': 'farzad@alkawsar.com',
        'role': 'employee',
        'phone': '+98 912 345 6789',
        'active': True,
        'is_staff': False,
        'is_superuser': False,
    },
]


@transaction.atomic
def create_default_users():
    """Create default users if they don't exist"""
    
    print("=" * 60)
    print("Creating Default Users for Production")
    print("=" * 60)
    
    created_count = 0
    updated_count = 0
    skipped_count = 0
    
    for user_data in DEFAULT_USERS:
        username = user_data['username']
        password = user_data.pop('password')
        
        try:
            # Check if user exists
            user, created = User.objects.get_or_create(
                username=username,
                defaults=user_data
            )
            
            if created:
                # Set password for new user
                user.set_password(password)
                user.save()
                created_count += 1
                print(f"✅ Created user: {username} ({user_data['role']})")
            else:
                # Update existing user
                for key, value in user_data.items():
                    setattr(user, key, value)
                user.set_password(password)
                user.save()
                updated_count += 1
                print(f"🔄 Updated user: {username} ({user_data['role']})")
                
        except Exception as e:
            skipped_count += 1
            print(f"❌ Error with user {username}: {str(e)}")
    
    print("\n" + "=" * 60)
    print(f"Summary:")
    print(f"  Created: {created_count}")
    print(f"  Updated: {updated_count}")
    print(f"  Skipped: {skipped_count}")
    print("=" * 60)
    
    print("\n📝 Login Credentials:")
    print("-" * 60)
    for user_data in DEFAULT_USERS:
        print(f"Username: {user_data['username']}")
        print(f"Password: {user_data.get('password', 'N/A')}")
        print(f"Role: {user_data['role']}")
        print("-" * 60)


if __name__ == '__main__':
    create_default_users()
    print("\n✅ Default users setup complete!")
    print("You can now login with the credentials above.")
