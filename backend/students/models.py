from django.db import models
from django.conf import settings

class StudentProfile(models.Model):
    """
    Student Profile with 18 fields as specified in requirements
    Contains all academic and progress information for students
    """
    
    DEGREE_CHOICES = [
        ('ارشد', 'کارشناسی ارشد'),
        ('عاملا', 'عاملا'),
    ]
    
    STATUS_CHOICES = [
        ('', 'انتخاب کنید'),
        ('در انتظار', 'در انتظار'),
        ('در حال انجام', 'در حال انجام'),
        ('تکمیل شده', 'تکمیل شده'),
        ('تایید شده', 'تایید شده'),
        ('نیاز به اصلاح', 'نیاز به اصلاح'),
        ('رد شده', 'رد شده'),
    ]
    
    ARTICLE_STATUS_CHOICES = [
        ('', 'انتخاب کنید'),
        ('شروع نشده', 'شروع نشده'),
        ('در حال نوشتن', 'در حال نوشتن'),
        ('ارسال شده', 'ارسال شده'),
        ('پذیرش شده', 'پذیرش شده'),
    ]
    
    # Relationship to User
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE,
        related_name='student_profile'
    )
    
    # 1. نام و نام خانوادگی (inherited from User model)
    
    # 2. دانشگاه
    university = models.CharField(max_length=100, blank=True)
    
    # 3. شماره دانشجویی  
    student_id = models.CharField(max_length=50, blank=True)
    
    # 4. رمز سامانه
    system_password = models.CharField(max_length=100, blank=True)
    
    # 5. رشته
    field = models.CharField(max_length=100, blank=True)
    degree = models.CharField(max_length=20, choices=DEGREE_CHOICES, blank=True)
    
    # 6. علاقه
    interest = models.TextField(blank=True)
    
    # 7. سفارش
    order_type = models.CharField(max_length=50, blank=True)
    
    # 8. لجنه
    committee_status = models.CharField(max_length=50, choices=STATUS_CHOICES, blank=True)
    
    # 9. ایران‌داک
    irandoc_status = models.CharField(max_length=50, choices=STATUS_CHOICES, blank=True)
    
    # 10. استاد
    supervisor = models.CharField(max_length=100, blank=True)
    
    # 11. نویسنده
    assigned_writer = models.CharField(max_length=100, blank=True)
    
    # 12. تحویل
    delivery_date = models.DateField(null=True, blank=True)
    
    # 13. امورداری
    admin_status = models.CharField(max_length=50, choices=STATUS_CHOICES, blank=True)
    
    # 14. تنضید
    typing_status = models.CharField(max_length=50, choices=STATUS_CHOICES, blank=True)
    
    # 15. تلخیص
    summary_status = models.CharField(max_length=50, choices=STATUS_CHOICES, blank=True)
    
    # 16. همتند (peer review)
    peer_review_status = models.CharField(max_length=50, choices=STATUS_CHOICES, blank=True)
    
    # 17. مقاله 1
    article1_status = models.CharField(max_length=50, choices=ARTICLE_STATUS_CHOICES, blank=True)
    
    # 18. مقاله 2
    article2_status = models.CharField(max_length=50, choices=ARTICLE_STATUS_CHOICES, blank=True)
    
    # Additional metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'پروفایل دانشجو'
        verbose_name_plural = 'پروفایل‌های دانشجویان'
        
    def __str__(self):
        return f"پروفایل {self.user.get_full_name()}"
    
    @property
    def completion_percentage(self):
        """Calculate profile completion percentage"""
        total_fields = 18
        completed_fields = 0
        
        # Check each field for completion
        fields_to_check = [
            self.university, self.student_id, self.field, self.interest,
            self.order_type, self.committee_status, self.irandoc_status,
            self.supervisor, self.assigned_writer, self.admin_status,
            self.typing_status, self.summary_status, self.peer_review_status,
            self.article1_status, self.article2_status
        ]
        
        for field in fields_to_check:
            if field and field.strip():
                completed_fields += 1
                
        if self.delivery_date:
            completed_fields += 1
            
        # Name is always available from User model
        completed_fields += 1
        
        # Degree if selected
        if self.degree:
            completed_fields += 1
            
        return round((completed_fields / total_fields) * 100)
    
    def get_required_fields(self):
        """Return list of required fields for validation"""
        return [
            'university', 'student_id', 'field', 'degree'
        ]
    
    def get_optional_fields(self):
        """Return list of optional fields"""
        return [
            'system_password', 'interest', 'order_type', 'committee_status',
            'irandoc_status', 'supervisor', 'assigned_writer', 'delivery_date',
            'admin_status', 'typing_status', 'summary_status', 'peer_review_status',
            'article1_status', 'article2_status'
        ]