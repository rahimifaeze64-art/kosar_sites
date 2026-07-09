"""
Script to create initial data for the system
Run with: python manage.py shell < create_initial_data.py
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from students.models import StudentProfile
from orders.models import Order, OrderTask
from datetime import datetime, timedelta

User = get_user_model()

def create_users():
    """Create initial users"""
    print("Creating users...")
    
    # Manager
    manager, created = User.objects.get_or_create(
        username='manager',
        defaults={
            'first_name': 'عامل',
            'last_name': 'تقی زاده',
            'email': 'taghizadeh@edu-system.com',
            'role': 'manager',
            'phone': '+98 912 123 4567',
            'active': True,
            'is_staff': True,
            'is_superuser': True,
        }
    )
    if created:
        manager.set_password('123456')
        manager.save()
        print(f"✓ Created manager: {manager.username}")
    
    # employees
    employees_data = [
        {'username': 'zahra', 'first_name': 'زهرا', 'last_name': 'محمدی', 'email': 'zahra@edu-system.com', 'phone': '+98 913 234 5678', 'department': 'هماهنگی عمومی'},
        {'username': 'fatemeh', 'first_name': 'زینب', 'last_name': 'احمدی', 'email': 'fatemeh@edu-system.com', 'phone': '+98 914 345 6789', 'department': 'هماهنگی پروژه‌ها'},
        {'username': 'farzad', 'first_name': 'فرزاد', 'last_name': 'فتحی', 'email': 'farzad@edu-system.com', 'phone': '+98 915 456 7890', 'department': 'هماهنگی مالی'},
        {'username': 'soleiman', 'first_name': 'حسینی م', 'last_name': 'سجادی', 'email': 'soleiman@edu-system.com', 'phone': '+98 916 567 8901', 'department': 'هماهنگی فنی'},
    ]
    
    for data in employees_data:
        user, created = User.objects.get_or_create(
            username=data['username'],
            defaults={
                'first_name': data['first_name'],
                'last_name': data['last_name'],
                'email': data['email'],
                'role': 'employee',
                'phone': data['phone'],
                'department': data['department'],
                'active': True,
            }
        )
        if created:
            user.set_password('123456')
            user.save()
            print(f"✓ Created employee: {user.username}")
    
    # Agents
    agents_data = [
        {'username': 'masoumi', 'first_name': 'عامل', 'last_name': 'معصومی', 'email': 'masoumi@edu-system.com', 'phone': '+98 915 456 7890', 'specialization': 'نوشتن رساله'},
        {'username': 'zoghi', 'first_name': 'عامل', 'last_name': 'ذوقی', 'email': 'zoghi@edu-system.com', 'phone': '+98 916 567 8901', 'specialization': 'نوشتن مقاله'},
        {'username': 'rezaei', 'first_name': 'فتحی', 'last_name': '', 'email': 'rezaei@edu-system.com', 'phone': '+98 917 678 9012', 'specialization': 'ترجمه'},
        {'username': 'karimi', 'first_name': 'سجادی', 'last_name': '', 'email': 'karimi@edu-system.com', 'phone': '+98 918 789 0123', 'specialization': 'تلخیص'},
    ]
    
    for data in agents_data:
        user, created = User.objects.get_or_create(
            username=data['username'],
            defaults={
                'first_name': data['first_name'],
                'last_name': data['last_name'],
                'email': data['email'],
                'role': 'agent',
                'phone': data['phone'],
                'specialization': data['specialization'],
                'active': True,
            }
        )
        if created:
            user.set_password('123456')
            user.save()
            print(f"✓ Created agent: {user.username}")
    
    # Students
    students_data = [
        {
            'username': 'qasim',
            'first_name': 'قاسم محمود حسن',
            'last_name': 'بغدادی',
            'email': 'qasim.baghdadi@gmail.com',
            'phone': '+964 775 678 9012',
            'passport_number': 'A12345678',
            'profile': {
                'university': 'دانشگاه قم',
                'student_id': 'QOM2024001',
                'field': 'حقوق محض',
                'degree': 'ارشد',
                'interest': 'حقوق بین‌الملل',
            }
        },
        {
            'username': 'hassan',
            'first_name': 'حسن یاسر کرار',
            'last_name': 'حسینی',
            'email': 'hassan.hosseini@gmail.com',
            'phone': '+964 776 789 0123',
            'passport_number': 'B23456789',
            'profile': {
                'university': 'جامعه المصطفی',
                'student_id': 'MOS2024002',
                'field': 'حقوق عمومی',
                'degree': 'عاملا',
                'interest': 'حقوق اساسی',
            }
        },
    ]
    
    for data in students_data:
        user, created = User.objects.get_or_create(
            username=data['username'],
            defaults={
                'first_name': data['first_name'],
                'last_name': data['last_name'],
                'email': data['email'],
                'role': 'student',
                'phone': data['phone'],
                'passport_number': data['passport_number'],
                'active': True,
            }
        )
        if created:
            user.set_password('123456')
            user.save()
            print(f"✓ Created student: {user.username}")
            
            # Create student profile
            profile, profile_created = StudentProfile.objects.get_or_create(
                user=user,
                defaults=data['profile']
            )
            if profile_created:
                print(f"  ✓ Created profile for {user.username}")
    
    print("\n✅ All users created successfully!")
    return User.objects.all()


def create_orders():
    """Create sample orders"""
    print("\nCreating sample orders...")
    
    # Get users
    student1 = User.objects.get(username='qasim')
    student2 = User.objects.get(username='hassan')
    agent1 = User.objects.get(username='masoumi')
    
    # Order 1 - In Progress
    order1, created = Order.objects.get_or_create(
        student=student1,
        type='نوشتن رساله',
        defaults={
            'university': 'دانشگاه قم',
            'field': 'حقوق محض',
            'degree': 'ارشد',
            'status': 'in_progress',
            'stage': 'عامل در حال نوشتن رساله شما است',
            'progress': 45,
            'assigned_doctor': agent1,
            'deadline': datetime.now().date() + timedelta(days=45),
            'estimated_days': 45,
            'total_amount': 800,
            'doctor_share': 480,
            'manager_share': 320,
            'payment_status': 'partial',
            'paid_amount': 400,
            'description': 'نوشتن رساله کارشناسی ارشد در زمینه حقوق محض',
        }
    )
    if created:
        print(f"✓ Created order: {order1.id}")
        
        # Create tasks for order 1
        OrderTask.objects.create(
            order=order1,
            title='انتخاب عنوان رساله',
            status='completed',
            assigned_to='doctor',
            assigned_user=agent1,
            due_date=datetime.now().date() - timedelta(days=30),
        )
        OrderTask.objects.create(
            order=order1,
            title='تایید عنوان توسط لجنه',
            status='completed',
            assigned_to='employee',
            due_date=datetime.now().date() - timedelta(days=20),
        )
        OrderTask.objects.create(
            order=order1,
            title='نوشتن فصل اول رساله',
            status='in_progress',
            assigned_to='doctor',
            assigned_user=agent1,
            due_date=datetime.now().date() + timedelta(days=15),
        )
    
    # Order 2 - Pending
    order2, created = Order.objects.get_or_create(
        student=student2,
        type='نوشتن مقاله',
        defaults={
            'university': 'جامعه المصطفی',
            'field': 'حقوق عمومی',
            'degree': 'عاملا',
            'status': 'pending',
            'stage': 'در انتظار تایید مدیر',
            'progress': 0,
            'deadline': datetime.now().date() + timedelta(days=60),
            'estimated_days': 0,
            'total_amount': 600,
            'doctor_share': 420,
            'manager_share': 180,
            'payment_status': 'pending',
            'paid_amount': 0,
            'description': 'نوشتن مقاله علمی برای مجله ISI',
        }
    )
    if created:
        print(f"✓ Created order: {order2.id}")
    
    # Order 3 - Approved
    order3, created = Order.objects.get_or_create(
        student=student1,
        type='نوشتن مقاله',
        defaults={
            'university': 'دانشگاه قم',
            'field': 'حقوق محض',
            'degree': 'ارشد',
            'status': 'approved',
            'stage': 'مدیر پروژه را تایید کرد - هماهنگی در حال انجام است',
            'progress': 10,
            'deadline': datetime.now().date() + timedelta(days=90),
            'estimated_days': 30,
            'total_amount': 300,
            'doctor_share': 210,
            'manager_share': 90,
            'payment_status': 'pending',
            'paid_amount': 0,
            'description': 'نوشتن مقاله کنفرانس',
        }
    )
    if created:
        print(f"✓ Created order: {order3.id}")
    
    print("\n✅ All orders created successfully!")


def main():
    """Main function to create all initial data"""
    print("=" * 60)
    print("Creating Initial Data for Educational Management System")
    print("=" * 60)
    
    create_users()
    create_orders()
    
    print("\n" + "=" * 60)
    print("✅ Initial data creation completed!")
    print("=" * 60)
    print("\nDefault credentials:")
    print("  Manager: username='manager', password='123456'")
    print("  employees: username='zahra/fatemeh/farzad/soleiman', password='123456'")
    print("  Agents: username='masoumi/zoghi/rezaei/karimi', password='123456'")
    print("  Students: username='qasim/hassan', password='123456'")
    print("\nAccess admin panel at: http://127.0.0.1:8000/admin/")
    print("=" * 60)


if __name__ == '__main__':
    main()
