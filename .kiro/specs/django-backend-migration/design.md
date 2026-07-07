# Design Document - Django Backend Migration

## Overview

این پروژه شامل تبدیل سیستم مدیریت تحصیلی موجود از JavaScript محض به Django backend با PostgreSQL است. هدف حفظ کامل frontend موجود و ایجاد API backend قدرتمند برای مدیریت داده‌ها و فایل‌ها.

## Architecture

### High-Level Architecture
```
Frontend (HTML/CSS/JS/Tailwind) 
    ↓ AJAX/Fetch API calls
Django REST API Backend
    ↓ ORM
PostgreSQL Database
    ↓ File Storage
Media Files (DOCX, PDF, Images, etc.)
```

### Technology Stack
- **Backend**: Django 4.2+ with Django REST Framework
- **Database**: PostgreSQL 14+
- **Frontend**: Existing HTML/CSS/JS/Tailwind (unchanged)
- **Authentication**: Django built-in authentication
- **File Storage**: Django file handling with media directory
- **API**: RESTful API with JSON responses

## Components and Interfaces

### 1. Django Apps Structure
```
edu_system/
├── accounts/          # User management and authentication
├── students/          # Student profiles and 18 fields
├── orders/           # Order management
├── files/            # File upload/download management
├── dashboard/        # Dashboard data and statistics
└── api/              # API endpoints and serializers
```

### 2. Models Design

#### User Model (Extended)
```python
class CustomUser(AbstractUser):
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    phone = models.CharField(max_length=20, blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
```

#### Student Profile Model (18 Fields)
```python
class StudentProfile(models.Model):
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE)
    # Basic Info
    university = models.CharField(max_length=100)
    student_id = models.CharField(max_length=50)
    system_password = models.CharField(max_length=100, blank=True)
    field = models.CharField(max_length=100)
    degree = models.CharField(max_length=20, choices=DEGREE_CHOICES)
    interest = models.TextField(blank=True)
    
    # Order & Progress
    order_type = models.CharField(max_length=50, blank=True)
    committee_status = models.CharField(max_length=50, blank=True)
    irandoc_status = models.CharField(max_length=50, blank=True)
    supervisor = models.CharField(max_length=100, blank=True)
    assigned_writer = models.CharField(max_length=100, blank=True)
    delivery_date = models.DateField(null=True, blank=True)
    
    # Additional Services
    admin_status = models.CharField(max_length=50, blank=True)
    typing_status = models.CharField(max_length=50, blank=True)
    summary_status = models.CharField(max_length=50, blank=True)
    peer_review_status = models.CharField(max_length=50, blank=True)
    article1_status = models.CharField(max_length=50, blank=True)
    article2_status = models.CharField(max_length=50, blank=True)
```

#### Order Model
```python
class Order(models.Model):
    student = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    university = models.CharField(max_length=100)
    field = models.CharField(max_length=100)
    degree = models.CharField(max_length=20)
    type = models.CharField(max_length=50)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    stage = models.CharField(max_length=200)
    deadline = models.DateField()
    assigned_doctor = models.ForeignKey(CustomUser, null=True, blank=True, 
                                       related_name='assigned_orders', on_delete=models.SET_NULL)
    progress = models.IntegerField(default=0)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    doctor_share = models.DecimalField(max_digits=10, decimal_places=2)
    manager_share = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
```

#### File Management Model
```python
class OrderFile(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='files')
    uploaded_by = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    file = models.FileField(upload_to='order_files/%Y/%m/%d/')
    file_type = models.CharField(max_length=10)  # DOCX, PDF, IMAGE, TEXT
    description = models.TextField(blank=True)
    version = models.IntegerField(default=1)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
```

### 3. API Endpoints Design

#### Authentication Endpoints
- `POST /api/auth/login/` - User login
- `POST /api/auth/logout/` - User logout
- `GET /api/auth/user/` - Get current user info

#### User Management Endpoints
- `GET /api/users/` - List users (admin only)
- `POST /api/users/` - Create user (admin only)
- `GET /api/users/{id}/` - Get user details
- `PUT /api/users/{id}/` - Update user
- `DELETE /api/users/{id}/` - Delete user (admin only)

#### Student Profile Endpoints
- `GET /api/students/profile/` - Get current student profile
- `PUT /api/students/profile/` - Update student profile
- `GET /api/students/{id}/profile/` - Get specific student profile (admin/employee)

#### Order Management Endpoints
- `GET /api/orders/` - List orders (filtered by role)
- `POST /api/orders/` - Create new order
- `GET /api/orders/{id}/` - Get order details
- `PUT /api/orders/{id}/` - Update order
- `POST /api/orders/{id}/assign/` - Assign order to doctor
- `POST /api/orders/{id}/approve/` - Approve order
- `POST /api/orders/{id}/reject/` - Reject order

#### File Management Endpoints
- `GET /api/orders/{id}/files/` - List order files
- `POST /api/orders/{id}/files/` - Upload file
- `GET /api/files/{id}/download/` - Download file
- `DELETE /api/files/{id}/` - Delete file

#### Dashboard Endpoints
- `GET /api/dashboard/stats/` - Get dashboard statistics
- `GET /api/dashboard/recent-orders/` - Get recent orders

## Data Models

### Database Schema
```sql
-- Users table (Django built-in with extensions)
-- Student profiles table (18 fields)
-- Orders table
-- Order files table
-- Tasks table (for order workflow)
-- Rejection history table
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Authentication Consistency
*For any* user login attempt, the Django authentication system should return consistent results based on valid credentials stored in PostgreSQL_DB
**Validates: Requirements 3.1, 3.2**

### Property 2: File Upload Security
*For any* file upload operation, the system should validate file type, size, and user permissions before storing in the media directory
**Validates: Requirements 4.1, 4.4**

### Property 3: API Response Format
*For any* API endpoint call, the Django system should return JSON responses in the exact format expected by the existing frontend
**Validates: Requirements 6.3, 6.4**

### Property 4: Role-Based Access Control
*For any* user action, the system should enforce permissions based on the user's role and only allow authorized operations
**Validates: Requirements 3.3, 7.5**

### Property 5: Data Migration Integrity
*For any* existing data, the migration process should preserve all information without loss or corruption
**Validates: Requirements 8.5**

## Error Handling

### API Error Responses
- 400 Bad Request: Invalid input data
- 401 Unauthorized: Authentication required
- 403 Forbidden: Insufficient permissions
- 404 Not Found: Resource not found
- 500 Internal Server Error: Server-side errors

### File Upload Error Handling
- File size validation
- File type validation
- Storage space checks
- Permission validation

### Database Error Handling
- Connection error handling
- Transaction rollback on failures
- Data validation errors

## Testing Strategy

### Unit Testing
- Model validation tests
- API endpoint tests
- Authentication tests
- File upload/download tests

### Integration Testing
- Frontend-backend integration tests
- Database integration tests
- File system integration tests

### Property-Based Testing
- User authentication property tests (Property 1)
- File security property tests (Property 2)
- API format consistency tests (Property 3)
- Permission enforcement tests (Property 4)
- Data integrity tests (Property 5)

Each property-based test should run minimum 100 iterations to ensure reliability.