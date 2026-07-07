from django.db import models
from django.conf import settings
from decimal import Decimal

class Order(models.Model):
    """
    Order model for managing student orders (thesis, articles, translations, etc.)
    """
    
    STATUS_CHOICES = [
        ('pending', 'در انتظار'),
        ('in_progress', 'در حال انجام'),
        ('completed', 'تکمیل شده'),
    ]
    
    TYPE_CHOICES = [
        ('نوشتن رساله', 'نوشتن رساله'),
        ('نوشتن مقاله', 'نوشتن مقاله'),
        ('ترجمه رساله', 'ترجمه رساله'),
        ('تلخیص', 'تلخیص'),
        ('آماده‌سازی ارائه', 'آماده‌سازی ارائه'),
        ('تحقیق و بررسی', 'تحقیق و بررسی'),
    ]
    
    DEGREE_CHOICES = [
        ('ارشد', 'کارشناسی ارشد'),
        ('عاملا', 'عاملا'),
    ]
    
    PAYMENT_STATUS_CHOICES = [
        ('pending', 'در انتظار پرداخت'),
        ('partial', 'پرداخت جزئی'),
        ('paid', 'پرداخت شده'),
        ('refunded', 'بازگشت داده شده'),
    ]
    
    # Basic Information
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='orders'
    )
    
    # Order Details
    university = models.CharField(max_length=100)
    field = models.CharField(max_length=100)
    degree = models.CharField(max_length=20, choices=DEGREE_CHOICES)
    type = models.CharField(max_length=50, choices=TYPE_CHOICES)
    
    # Status and Progress
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    stage = models.CharField(max_length=200, blank=True)
    progress = models.IntegerField(default=0)  # 0-100 percentage
    
    # Assignment
    assigned_doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_orders',
        limit_choices_to={'role': 'doctor'}
    )
    
    # Dates
    deadline = models.DateField()
    estimated_days = models.IntegerField(default=0)
    
    # Financial
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    doctor_share = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    manager_share = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='pending')
    paid_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    # Additional Information
    description = models.TextField(blank=True)
    passport_number = models.CharField(max_length=50, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    assigned_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        verbose_name = 'سفارش'
        verbose_name_plural = 'سفارشات'
        ordering = ['-created_at']
        
    def __str__(self):
        return f"{self.student.get_full_name()} - {self.type}"
    
    def save(self, *args, **kwargs):
        """Override save to calculate shares automatically"""
        if self.total_amount and not self.doctor_share:
            self.calculate_shares()
        super().save(*args, **kwargs)
    
    def calculate_shares(self):
        """Calculate doctor and manager shares based on order type"""
        pricing_config = {
            'نوشتن رساله': {'doctor_share': 0.6, 'manager_share': 0.4},
            'نوشتن مقاله': {'doctor_share': 0.7, 'manager_share': 0.3},
            'ترجمه رساله': {'doctor_share': 0.6, 'manager_share': 0.4},
            'تلخیص': {'doctor_share': 0.5, 'manager_share': 0.5},
            'آماده‌سازی ارائه': {'doctor_share': 0.6, 'manager_share': 0.4},
            'تحقیق و بررسی': {'doctor_share': 0.6, 'manager_share': 0.4},
        }
        
        config = pricing_config.get(self.type, {'doctor_share': 0.6, 'manager_share': 0.4})
        self.doctor_share = self.total_amount * Decimal(str(config['doctor_share']))
        self.manager_share = self.total_amount * Decimal(str(config['manager_share']))
    
    @property
    def student_name(self):
        return self.student.get_full_name()
    
    @property
    def assigned_doctor_name(self):
        return self.assigned_doctor.get_full_name() if self.assigned_doctor else None
    
    @property
    def is_overdue(self):
        from django.utils import timezone
        return self.deadline < timezone.now().date() and self.status != 'completed'
    
    @property
    def days_remaining(self):
        from django.utils import timezone
        delta = self.deadline - timezone.now().date()
        return delta.days if delta.days > 0 else 0


class OrderTask(models.Model):
    """
    Individual tasks within an order for tracking progress
    """
    
    STATUS_CHOICES = [
        ('pending', 'در انتظار'),
        ('in_progress', 'در حال انجام'),
        ('completed', 'تکمیل شده'),
    ]
    
    ASSIGNED_TO_CHOICES = [
        ('doctor', 'عامل'),
        ('employee', 'کارمند'),
        ('manager', 'مدیر'),
        ('student', 'دانشجو'),
    ]
    
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='tasks')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    assigned_to = models.CharField(max_length=20, choices=ASSIGNED_TO_CHOICES)
    assigned_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_tasks'
    )
    
    due_date = models.DateField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        verbose_name = 'وظیفه سفارش'
        verbose_name_plural = 'وظایف سفارشات'
        ordering = ['due_date', '-created_at']
        
    def __str__(self):
        return f"{self.order} - {self.title}"


class OrderRejection(models.Model):
    """
    Track rejection history for orders and tasks
    """
    
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='rejections')
    task = models.ForeignKey(OrderTask, on_delete=models.CASCADE, null=True, blank=True, related_name='rejections')
    
    reason = models.TextField()
    rejected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='rejections_made'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'رد سفارش'
        verbose_name_plural = 'تاریخچه رد سفارشات'
        ordering = ['-created_at']
        
    def __str__(self):
        return f"رد {self.order} - {self.created_at.strftime('%Y/%m/%d')}"