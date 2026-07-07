from django.contrib.auth.models import AbstractUser
from django.db import models

class CustomUser(AbstractUser):
    """
    Custom User model extending Django's AbstractUser
    Supports different user roles for the educational management system
    """
    
    ROLE_CHOICES = [
        ('manager', 'مدیر'),
        ('employee', 'کارمند'),
        ('agent', 'عامل'),
        ('student', 'دانشجو'),
    ]
    
    # Basic fields
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student')
    phone = models.CharField(max_length=20, blank=True, null=True)
    active = models.BooleanField(default=True)
    
    # Role-specific fields
    # Agent fields (doctor/translator)
    specialization = models.CharField(max_length=100, blank=True, null=True, help_text='نوع تخصص: نوشتن رساله، ترجمه، تلخیص و غیره')
    
    # employee fields  
    department = models.CharField(max_length=100, blank=True, null=True)
    
    # Student fields
    passport_number = models.CharField(max_length=50, blank=True, null=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'کاربر'
        verbose_name_plural = 'کاربران'
        ordering = ['-created_at']
        
    def __str__(self):
        return f"{self.get_full_name()} ({self.get_role_display()})"
    
    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.username
    
    @property
    def is_manager(self):
        return self.role == 'manager'
    
    @property
    def is_employee(self):
        return self.role == 'employee'
    
    @property
    def is_agent(self):
        return self.role == 'agent'
    
    @property
    def is_student(self):
        return self.role == 'student'