from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from students.models import StudentProfile
from orders.models import Order, OrderTask
from decimal import Decimal
from datetime import date, timedelta

User = get_user_model()

class Command(BaseCommand):
    help = 'Create sample data for educational management system (Manager, employee, Doctor roles only)'

    def handle(self, *args, **options):
        self.stdout.write('Creating sample data for educational service management...')
        
        # Create Manager
        manager, created = User.objects.get_or_create(
            username='manager',
            defaults={
                'first_name': 'عامل',
                'last_name': 'تقی زاده',
                'email': 'taghizadeh@kosar.com',
                'role': 'manager',
                'phone': '+98 912 123 4567',
                'is_staff': True,
                'is_superuser': True
            }
        )
        if created:
            manager.set_password('123456')
            manager.save()
            self.stdout.write(f'✅ Manager created: {manager.username}')
        
        # Create employees
        employees_data = [
            {'username': 'zahra', 'first_name': 'زهرا', 'last_name': 'احمدی', 'department': 'هماهنگی عمومی'},
            {'username': 'zeinab', 'first_name': 'زینب', 'last_name': 'محمدی', 'department': 'هماهنگی پروژه‌ها'},
        ]
        
        employees = []
        for emp_data in employees_data:
            emp, created = User.objects.get_or_create(
                username=emp_data['username'],
                defaults={
                    'first_name': emp_data['first_name'],
                    'last_name': emp_data['last_name'],
                    'email': f"{emp_data['username']}@kosar.com",
                    'role': 'employee',
                    'department': emp_data['department'],
                    'phone': '+98 913 234 5678',
                }
            )
            if created:
                emp.set_password('123456')
                emp.save()
                employees.append(emp)
                self.stdout.write(f'✅ employee created: {emp.username}')
        
        # Create Doctors/Writers
        doctors_data = [
            {
                'username': 'masoumi',
                'first_name': 'عامل',
                'last_name': 'معصومی',
                'specialization': 'حقوق عمومی و بین‌الملل',
                'doctor_degree': 'عاملا'
            },
            {
                'username': 'zoghi',
                'first_name': 'عامل',
                'last_name': 'ذوقی',
                'specialization': 'حقوق خصوصی و تجارت',
                'doctor_degree': 'عاملا'
            },
            {
                'username': 'ahmadi',
                'first_name': 'عامل',
                'last_name': 'احمدی',
                'specialization': 'حقوق اساسی و اداری',
                'doctor_degree': 'عاملا'
            },
        ]
        
        doctors = []
        for doc_data in doctors_data:
            doctor, created = User.objects.get_or_create(
                username=doc_data['username'],
                defaults={
                    'first_name': doc_data['first_name'],
                    'last_name': doc_data['last_name'],
                    'email': f"{doc_data['username']}@kosar.com",
                    'role': 'doctor',
                    'specialization': doc_data['specialization'],
                    'doctor_degree': doc_data['doctor_degree'],
                    'phone': '+98 915 456 7890',
                }
            )
            if created:
                doctor.set_password('123456')
                doctor.save()
                doctors.append(doctor)
                self.stdout.write(f'✅ Doctor created: {doctor.username}')
        
        # Create Student Profiles (these are clients, not system users)
        students_data = [
            {
                'name': 'قاسم محمود حسن بغدادی',
                'email': 'qasim.baghdadi@gmail.com',
                'phone': '+964 775 678 9012',
                'profile': {
                    'university': 'دانشگاه قم',
                    'student_id': 'QOM2024001',
                    'system_password': 'qom123456',
                    'field': 'حقوق محض',
                    'degree': 'ارشد',
                    'interest': 'حقوق بین‌الملل و دیپلماسی',
                    'order_type': 'نوشتن رساله',
                    'committee_status': 'تایید شده',
                    'irandoc_status': 'در حال بررسی',
                    'supervisor': 'عامل علی احمدی',
                    'assigned_writer': 'عامل معصومی',
                    'delivery_date': date.today() + timedelta(days=90),
                    'admin_status': 'در حال انجام',
                    'typing_status': 'انجام نشده',
                    'summary_status': 'انجام نشده',
                    'peer_review_status': 'انجام نشده',
                    'article1_status': 'در حال نوشتن',
                    'article2_status': 'شروع نشده',
                }
            },
            {
                'name': 'حسن یاسر کرار حسینی',
                'email': 'hassan.hosseini@gmail.com',
                'phone': '+964 776 789 0123',
                'profile': {
                    'university': 'جامعه المصطفی',
                    'student_id': 'MOS2024002',
                    'system_password': 'mos789012',
                    'field': 'حقوق عمومی',
                    'degree': 'عاملا',
                    'interest': 'حقوق اساسی و قانون اساسی',
                    'order_type': 'نوشتن مقاله',
                    'committee_status': 'در انتظار',
                    'irandoc_status': 'ثبت نشده',
                    'supervisor': 'عامل محمد رضایی',
                    'assigned_writer': '',
                    'delivery_date': date.today() + timedelta(days=60),
                    'admin_status': 'انجام نشده',
                    'typing_status': 'انجام نشده',
                    'summary_status': 'انجام نشده',
                    'peer_review_status': 'انجام نشده',
                    'article1_status': 'شروع نشده',
                    'article2_status': 'شروع نشده',
                }
            },
            {
                'name': 'علی محمد صالح الدین',
                'email': 'ali.salah@gmail.com',
                'phone': '+964 777 890 1234',
                'profile': {
                    'university': 'دانشگاه بغداد',
                    'student_id': 'BGD2024003',
                    'system_password': 'bgd345678',
                    'field': 'حقوق خصوصی',
                    'degree': 'ارشد',
                    'interest': 'حقوق تجارت و قراردادها',
                    'order_type': 'نوشتن رساله',
                    'committee_status': 'در انتظار',
                    'irandoc_status': 'ثبت نشده',
                    'supervisor': 'عامل احمد کریمی',
                    'assigned_writer': '',
                    'delivery_date': date.today() + timedelta(days=120),
                    'admin_status': 'انجام نشده',
                    'typing_status': 'انجام نشده',
                    'summary_status': 'انجام نشده',
                    'peer_review_status': 'انجام نشده',
                    'article1_status': 'شروع نشده',
                    'article2_status': 'شروع نشده',
                }
            }
        ]
        
        # Create dummy users for student profiles (these represent clients)
        student_users = []
        for std_data in students_data:
            # Create a user record for the student (client)
            student_user, created = User.objects.get_or_create(
                username=std_data['name'].replace(' ', '_').lower(),
                defaults={
                    'first_name': std_data['name'].split()[0],
                    'last_name': ' '.join(std_data['name'].split()[1:]),
                    'email': std_data['email'],
                    'role': 'student',  # This is just for data structure, they won't login
                    'phone': std_data['phone'],
                    'is_active': False,  # They don't login to system
                }
            )
            if created:
                student_user.set_unusable_password()  # No login capability
                student_user.save()
                student_users.append(student_user)
                
                # Create student profile with all 18 fields
                profile, profile_created = StudentProfile.objects.get_or_create(
                    user=student_user,
                    defaults=std_data['profile']
                )
                
                self.stdout.write(f'✅ Student profile created: {std_data["name"]}')
        
        # Create Orders for the students
        if student_users and doctors:
            # Order 1 - In Progress
            order1, created = Order.objects.get_or_create(
                student=student_users[0],
                type='نوشتن رساله',
                defaults={
                    'university': 'دانشگاه قم',
                    'field': 'حقوق محض',
                    'degree': 'ارشد',
                    'status': 'in_progress',
                    'stage': 'عامل در حال نوشتن رساله',
                    'progress': 45,
                    'assigned_doctor': doctors[0] if doctors else None,
                    'deadline': date.today() + timedelta(days=90),
                    'estimated_days': 90,
                    'total_amount': Decimal('800.00'),
                    'doctor_share': Decimal('480.00'),
                    'manager_share': Decimal('320.00'),
                    'payment_status': 'partial',
                    'paid_amount': Decimal('400.00'),
                    'description': 'رساله در زمینه حقوق بین‌الملل',
                }
            )
            
            if created and doctors:
                # Create tasks for order 1
                OrderTask.objects.create(
                    order=order1,
                    title='انتخاب عنوان رساله',
                    status='completed',
                    assigned_to='doctor',
                    assigned_user=doctors[0],
                    due_date=date.today() - timedelta(days=30)
                )
                
                OrderTask.objects.create(
                    order=order1,
                    title='نوشتن فصل اول',
                    status='in_progress',
                    assigned_to='doctor',
                    assigned_user=doctors[0],
                    due_date=date.today() + timedelta(days=30)
                )
                
                self.stdout.write(f'✅ Order 1 created with tasks')
            
            # Order 2 - Pending
            if len(student_users) > 1:
                order2, created = Order.objects.get_or_create(
                    student=student_users[1],
                    type='نوشتن مقاله',
                    defaults={
                        'university': 'جامعه المصطفی',
                        'field': 'حقوق عمومی',
                        'degree': 'عاملا',
                        'status': 'pending',
                        'stage': 'در انتظار تایید مدیر',
                        'progress': 0,
                        'deadline': date.today() + timedelta(days=60),
                        'estimated_days': 60,
                        'total_amount': Decimal('300.00'),
                        'doctor_share': Decimal('210.00'),
                        'manager_share': Decimal('90.00'),
                        'payment_status': 'pending',
                        'paid_amount': Decimal('0.00'),
                        'description': 'مقاله در زمینه حقوق اساسی',
                    }
                )
                
                if created:
                    self.stdout.write(f'✅ Order 2 created')
            
            # Order 3 - Approved, waiting for assignment
            if len(student_users) > 2:
                order3, created = Order.objects.get_or_create(
                    student=student_users[2],
                    type='نوشتن رساله',
                    defaults={
                        'university': 'دانشگاه بغداد',
                        'field': 'حقوق خصوصی',
                        'degree': 'ارشد',
                        'status': 'approved',
                        'stage': 'تایید شده - در انتظار تخصیص به عامل',
                        'progress': 5,
                        'deadline': date.today() + timedelta(days=120),
                        'estimated_days': 120,
                        'total_amount': Decimal('800.00'),
                        'doctor_share': Decimal('480.00'),
                        'manager_share': Decimal('320.00'),
                        'payment_status': 'pending',
                        'paid_amount': Decimal('0.00'),
                        'description': 'رساله در زمینه حقوق تجارت',
                    }
                )
                
                if created:
                    self.stdout.write(f'✅ Order 3 created')
        
        self.stdout.write(
            self.style.SUCCESS(
                '\n🎉 Sample data created successfully!\n'
                '\n📊 System Overview:'
                '\n- This is an Educational Service Management System'
                '\n- Students are CLIENTS (not system users)'
                '\n- Staff provides educational services to students'
                '\n'
                '\n👥 System Users (Staff):'
                '\n- Manager: manager/123456 (Full system access)'
                '\n- employees: zahra/123456, zeinab/123456 (Project empination)'
                '\n- Doctors/Writers: masoumi/123456, zoghi/123456, ahmadi/123456 (Content creation)'
                '\n'
                '\n🎓 Student Clients (Data only, no login):'
                '\n- قاسم محمود حسن بغدادی (Active project)'
                '\n- حسن یاسر کرار حسینی (Pending approval)'
                '\n- علی محمد صالح الدین (Approved, awaiting assignment)'
                '\n'
                '\n🌐 Access Points:'
                '\n- Admin Panel: http://127.0.0.1:8000/admin/'
                '\n- API Endpoints: http://127.0.0.1:8000/api/'
                '\n- API Documentation: http://127.0.0.1:8000/api/ (DRF browsable API)'
                '\n'
            )
        )