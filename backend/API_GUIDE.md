# راهنمای کامل API - سیستم مدیریت تحصیلی کوثر

## 🎯 مفهوم سیستم

این سیستم برای **ارائه خدمات تحصیلی به دانشجویان** طراحی شده است:

- **دانشجویان**: مشتریان سیستم (داده‌ها فقط، بدون ورود)
- **کارکنان**: کاربران سیستم (مدیر، کارمند، عامل/نویسنده)
- **خدمات**: نوشتن رساله، مقاله، ترجمه، تلخیص، و غیره

## 🌐 Base URL

```
http://127.0.0.1:8000/api/
```

## 🔐 Authentication

### Login
```http
POST /api/auth/login/
Content-Type: application/json

{
    "username": "manager",
    "password": "123456"
}
```

**Response:**
```json
{
    "user": {
        "id": 1,
        "username": "manager",
        "first_name": "عامل",
        "last_name": "تقی زاده",
        "role": "manager",
        "email": "taghizadeh@kosar.com"
    },
    "message": "ورود موفقیت‌آمیز"
}
```

### Logout
```http
POST /api/auth/logout/
```

### Get Current User
```http
GET /api/auth/user/
```

## 👥 User Management

### Get All Users (Staff)
```http
GET /api/users/
```

**Response:**
```json
[
    {
        "id": 1,
        "username": "manager",
        "first_name": "عامل",
        "last_name": "تقی زاده",
        "role": "manager",
        "specialization": null,
        "department": null
    },
    {
        "id": 2,
        "username": "masoumi",
        "first_name": "عامل",
        "last_name": "معصومی",
        "role": "doctor",
        "specialization": "حقوق عمومی و بین‌الملل"
    }
]
```

### Create New User (Manager Only)
```http
POST /api/users/
Content-Type: application/json

{
    "username": "new_doctor",
    "first_name": "عامل",
    "last_name": "جدید",
    "email": "new@kosar.com",
    "role": "doctor",
    "specialization": "حقوق کیفری",
    "password": "123456"
}
```

## 🎓 Student Management (Clients)

### Get All Student Profiles
```http
GET /api/students/
```

**Query Parameters:**
- `search`: جستجو در نام، شماره دانشجویی، دانشگاه
- `university`: فیلتر بر اساس دانشگاه
- `field`: فیلتر بر اساس رشته

**Response:**
```json
[
    {
        "id": 1,
        "user": 4,
        "user_name": "قاسم محمود حسن بغدادی",
        "university": "دانشگاه قم",
        "student_id": "QOM2024001",
        "field": "حقوق محض",
        "degree": "ارشد",
        "interest": "حقوق بین‌الملل و دیپلماسی",
        "order_type": "نوشتن رساله",
        "committee_status": "تایید شده",
        "irandoc_status": "در حال بررسی",
        "supervisor": "عامل علی احمدی",
        "assigned_writer": "عامل معصومی",
        "delivery_date": "2026-04-01",
        "admin_status": "در حال انجام",
        "typing_status": "انجام نشده",
        "summary_status": "انجام نشده",
        "peer_review_status": "انجام نشده",
        "article1_status": "در حال نوشتن",
        "article2_status": "شروع نشده",
        "completion_percentage": 78,
        "created_at": "2026-01-01T16:18:25.123456Z"
    }
]
```

### Create Student Profile
```http
POST /api/students/
Content-Type: application/json

{
    "user": {
        "first_name": "احمد",
        "last_name": "محمدی",
        "email": "ahmad@example.com"
    },
    "university": "دانشگاه تهران",
    "student_id": "TEH2024004",
    "field": "حقوق عمومی",
    "degree": "ارشد",
    "interest": "حقوق اداری"
}
```

### Update Student Profile
```http
PUT /api/students/{id}/
Content-Type: application/json

{
    "committee_status": "تایید شده",
    "irandoc_status": "تایید شده",
    "assigned_writer": "عامل احمدی"
}
```

### Student Statistics
```http
GET /api/students/statistics/
```

## 📋 Order Management

### Get All Orders
```http
GET /api/orders/
```

**Query Parameters:**
- `status`: pending, approved, in_progress, completed, rejected
- `type`: نوشتن رساله, نوشتن مقاله, ترجمه رساله, تلخیص
- `doctor`: ID عامل تخصیص یافته

**Response:**
```json
[
    {
        "id": 1,
        "student": 4,
        "student_name": "قاسم محمود حسن بغدادی",
        "university": "دانشگاه قم",
        "field": "حقوق محض",
        "degree": "ارشد",
        "type": "نوشتن رساله",
        "status": "in_progress",
        "stage": "عامل در حال نوشتن رساله",
        "progress": 45,
        "assigned_doctor": 2,
        "assigned_doctor_name": "عامل معصومی",
        "deadline": "2026-04-01",
        "total_amount": "800.00",
        "doctor_share": "480.00",
        "manager_share": "320.00",
        "payment_status": "partial",
        "paid_amount": "400.00",
        "tasks": [
            {
                "id": 1,
                "title": "انتخاب عنوان رساله",
                "status": "completed",
                "assigned_user_name": "عامل معصومی"
            }
        ],
        "days_remaining": 90,
        "is_overdue": false
    }
]
```

### Create New Order
```http
POST /api/orders/
Content-Type: application/json

{
    "student": 5,
    "university": "دانشگاه اصفهان",
    "field": "حقوق خصوصی",
    "degree": "عاملا",
    "type": "نوشتن مقاله",
    "deadline": "2026-06-01",
    "description": "مقاله در زمینه حقوق قراردادها",
    "total_amount": "300.00"
}
```

### Assign Order to Doctor
```http
POST /api/orders/{id}/assign_doctor/
Content-Type: application/json

{
    "doctor_id": 3
}
```

### Approve Order
```http
POST /api/orders/{id}/approve/
```

### Reject Order
```http
POST /api/orders/{id}/reject/
Content-Type: application/json

{
    "reason": "اطلاعات ناکافی - لطفاً توضیحات بیشتری ارائه دهید"
}
```

## 📁 File Management

### Get Files for Order
```http
GET /api/files/?order={order_id}
```

### Upload File
```http
POST /api/files/
Content-Type: multipart/form-data

{
    "order": 1,
    "file": [file_data],
    "description": "فصل اول رساله"
}
```

### Download File
```http
GET /api/files/{id}/download/
```

## 📊 Dashboard Statistics

### Get Dashboard Stats
```http
GET /api/dashboard/stats/
```

**Response (Manager):**
```json
{
    "total_orders": 15,
    "pending_orders": 3,
    "in_progress_orders": 8,
    "completed_orders": 4,
    "total_revenue": "12500.00",
    "total_students": 25,
    "active_doctors": 5
}
```

**Response (Doctor):**
```json
{
    "total_orders": 15,
    "pending_orders": 3,
    "in_progress_orders": 8,
    "completed_orders": 4,
    "total_revenue": "12500.00",
    "total_students": 25,
    "active_doctors": 5,
    "my_orders": 6,
    "my_earnings": "2880.00",
    "assigned_orders": 4
}
```

### Get Recent Orders
```http
GET /api/dashboard/recent_orders/
```

## 🔒 Permissions

### Manager
- تمام عملیات
- ایجاد/ویرایش/حذف کاربران
- تایید/رد سفارشات
- تخصیص به عامل
- مشاهده تمام آمار

### employee
- مشاهده سفارشات pending و in_progress
- تایید/رد سفارشات
- تخصیص به عامل
- مدیریت پروفایل دانشجویان

### Doctor
- مشاهده سفارشات تخصیص یافته
- آپلود/دانلود فایل‌ها
- به‌روزرسانی پیشرفت کار
- مشاهده آمار شخصی

## 🧪 Test Credentials

```
Manager: manager/123456
employee 1: zahra/123456
employee 2: zeinab/123456
Doctor 1: masoumi/123456
Doctor 2: zoghi/123456
Doctor 3: ahmadi/123456
```

## 📱 Frontend Integration

### JavaScript Example
```javascript
// Login
const response = await fetch('/api/auth/login/', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken')
    },
    body: JSON.stringify({
        username: 'manager',
        password: '123456'
    })
});

// Get Orders
const orders = await fetch('/api/orders/', {
    credentials: 'include'
});

// Create Order
const newOrder = await fetch('/api/orders/', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken')
    },
    credentials: 'include',
    body: JSON.stringify(orderData)
});
```

## 🚀 Next Steps

1. **Frontend Integration**: تبدیل localStorage calls به API calls
2. **File Upload**: پیاده‌سازی آپلود فایل در frontend
3. **Real-time Updates**: WebSocket برای به‌روزرسانی لحظه‌ای
4. **Notifications**: سیستم اعلانات
5. **Reports**: گزارش‌گیری پیشرفته

## 🔧 Development

```bash
# Start server
python manage.py runserver

# Create migrations
python manage.py makemigrations

# Apply migrations  
python manage.py migrate

# Create sample data
python manage.py create_sample_data

# Create superuser
python manage.py createsuperuser
```