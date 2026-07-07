import os
from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError

def validate_file_type(file):
    """Validate uploaded file type"""
    ext = os.path.splitext(file.name)[1].lower()
    
    allowed_extensions = []
    for file_types in settings.ALLOWED_FILE_TYPES.values():
        allowed_extensions.extend(file_types)
    
    if ext not in allowed_extensions:
        raise ValidationError(f'نوع فایل مجاز نیست. فرمت‌های مجاز: {", ".join(allowed_extensions)}')

def order_file_upload_path(instance, filename):
    """Generate upload path for order files"""
    return f'orders/{instance.order.id}/{filename}'

def profile_file_upload_path(instance, filename):
    """Generate upload path for profile files"""
    return f'profiles/{instance.user.id}/{filename}'

class OrderFile(models.Model):
    """
    Files associated with orders (documents, images, etc.)
    """
    
    FILE_TYPE_CHOICES = [
        ('DOCX', 'Word Document'),
        ('PDF', 'PDF Document'),
        ('IMAGE', 'Image'),
        ('TEXT', 'Text File'),
        ('OTHER', 'Other'),
    ]
    
    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.CASCADE,
        related_name='files'
    )
    
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='uploaded_files'
    )
    
    file = models.FileField(
        upload_to=order_file_upload_path,
        validators=[validate_file_type]
    )
    
    original_name = models.CharField(max_length=255)
    file_type = models.CharField(max_length=10, choices=FILE_TYPE_CHOICES)
    file_size = models.PositiveIntegerField()  # in bytes
    description = models.TextField(blank=True)
    
    # Version control
    version = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)
    replaces = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='replaced_by'
    )
    
    # Timestamps
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'فایل سفارش'
        verbose_name_plural = 'فایل‌های سفارشات'
        ordering = ['-uploaded_at']
        
    def __str__(self):
        return f"{self.original_name} - {self.order}"
    
    def save(self, *args, **kwargs):
        if not self.original_name:
            self.original_name = self.file.name
        
        if self.file:
            self.file_size = self.file.size
            
            # Determine file type based on extension
            ext = os.path.splitext(self.file.name)[1].lower()
            if ext in ['.docx', '.doc']:
                self.file_type = 'DOCX'
            elif ext == '.pdf':
                self.file_type = 'PDF'
            elif ext in ['.jpg', '.jpeg', '.png', '.gif']:
                self.file_type = 'IMAGE'
            elif ext in ['.txt', '.rtf']:
                self.file_type = 'TEXT'
            else:
                self.file_type = 'OTHER'
        
        super().save(*args, **kwargs)
    
    def delete(self, *args, **kwargs):
        """Delete file from filesystem when model is deleted"""
        if self.file:
            if os.path.isfile(self.file.path):
                os.remove(self.file.path)
        super().delete(*args, **kwargs)
    
    @property
    def file_size_mb(self):
        """Return file size in MB"""
        return round(self.file_size / (1024 * 1024), 2)
    
    @property
    def download_url(self):
        """Return secure download URL"""
        return f"/api/files/{self.id}/download/"


class ProfileDocument(models.Model):
    """
    Documents associated with user profiles (passport, certificates, etc.)
    """
    
    DOCUMENT_TYPE_CHOICES = [
        ('passport', 'پاسپورت'),
        ('certificate', 'گواهینامه'),
        ('transcript', 'ریز نمرات'),
        ('photo', 'عکس شخصی'),
        ('other', 'سایر'),
    ]
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile_documents'
    )
    
    document_type = models.CharField(max_length=20, choices=DOCUMENT_TYPE_CHOICES)
    file = models.FileField(
        upload_to=profile_file_upload_path,
        validators=[validate_file_type]
    )
    
    original_name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    
    # Verification
    is_verified = models.BooleanField(default=False)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_documents'
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'سند پروفایل'
        verbose_name_plural = 'اسناد پروفایل'
        ordering = ['-uploaded_at']
        
    def __str__(self):
        return f"{self.get_document_type_display()} - {self.user.get_full_name()}"
    
    def save(self, *args, **kwargs):
        if not self.original_name:
            self.original_name = self.file.name
        super().save(*args, **kwargs)


class FileDownloadLog(models.Model):
    """
    Log file downloads for security and tracking
    """
    
    file = models.ForeignKey(OrderFile, on_delete=models.CASCADE, related_name='download_logs')
    downloaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='file_downloads'
    )
    
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True)
    downloaded_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'لاگ دانلود فایل'
        verbose_name_plural = 'لاگ‌های دانلود فایل'
        ordering = ['-downloaded_at']
        
    def __str__(self):
        return f"{self.file.original_name} - {self.downloaded_by.username} - {self.downloaded_at}"