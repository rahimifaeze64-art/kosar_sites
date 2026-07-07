from django.db import models
from django.conf import settings

class Message(models.Model):
    """
    Messages between users (chat system)
    Supports both direct messages and group chats
    """
    
    MESSAGE_TYPE_CHOICES = [
        ('direct', 'پیام مستقیم'),
        ('group', 'پیام گروهی'),
        ('management', 'گفتگو مدیریت'),
    ]
    
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_messages'
    )
    
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='received_messages',
        null=True,
        blank=True
    )
    
    message_type = models.CharField(max_length=20, choices=MESSAGE_TYPE_CHOICES, default='direct')
    content = models.TextField()
    
    # For group messages
    group_name = models.CharField(max_length=100, blank=True, help_text='نام گروه برای پیام‌های گروهی')
    
    # Related order (optional)
    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='messages'
    )
    
    # Status
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    
    # Attachments
    has_attachment = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'پیام'
        verbose_name_plural = 'پیام‌ها'
        ordering = ['-created_at']
        
    def __str__(self):
        return f"{self.sender.get_full_name()} -> {self.recipient.get_full_name() if self.recipient else 'گروه'}"


class MessageAttachment(models.Model):
    """
    File attachments for messages
    """
    
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField(upload_to='message_attachments/')
    original_name = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField()
    
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'پیوست پیام'
        verbose_name_plural = 'پیوست‌های پیام'
        
    def __str__(self):
        return f"{self.original_name} - {self.message}"


class Notification(models.Model):
    """
    System notifications for users
    """
    
    NOTIFICATION_TYPE_CHOICES = [
        ('order_created', 'سفارش جدید'),
        ('order_approved', 'تایید سفارش'),
        ('order_rejected', 'رد سفارش'),
        ('order_assigned', 'تخصیص سفارش'),
        ('task_assigned', 'تخصیص وظیفه'),
        ('task_completed', 'تکمیل وظیفه'),
        ('message_received', 'پیام جدید'),
        ('payment_received', 'دریافت پرداخت'),
        ('deadline_approaching', 'نزدیک شدن به ددلاین'),
        ('system', 'اعلان سیستم'),
    ]
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    
    notification_type = models.CharField(max_length=30, choices=NOTIFICATION_TYPE_CHOICES)
    title = models.CharField(max_length=200)
    message = models.TextField()
    
    # Related objects
    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications'
    )
    
    related_message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications'
    )
    
    # Status
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'اعلان'
        verbose_name_plural = 'اعلان‌ها'
        ordering = ['-created_at']
        
    def __str__(self):
        return f"{self.title} - {self.user.get_full_name()}"


class ActivityLog(models.Model):
    """
    Log all user activities for audit trail
    """
    
    ACTION_CHOICES = [
        ('login', 'ورود'),
        ('logout', 'خروج'),
        ('create_order', 'ایجاد سفارش'),
        ('update_order', 'بروزرسانی سفارش'),
        ('approve_order', 'تایید سفارش'),
        ('reject_order', 'رد سفارش'),
        ('assign_order', 'تخصیص سفارش'),
        ('upload_file', 'آپلود فایل'),
        ('download_file', 'دانلود فایل'),
        ('send_message', 'ارسال پیام'),
        ('update_profile', 'بروزرسانی پروفایل'),
        ('create_user', 'ایجاد کاربر'),
        ('update_user', 'بروزرسانی کاربر'),
        ('delete_user', 'حذف کاربر'),
    ]
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='activity_logs'
    )
    
    action = models.CharField(max_length=30, choices=ACTION_CHOICES)
    description = models.TextField()
    
    # Related objects
    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='activity_logs'
    )
    
    # Request metadata
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'لاگ فعالیت'
        verbose_name_plural = 'لاگ‌های فعالیت'
        ordering = ['-created_at']
        
    def __str__(self):
        return f"{self.user.get_full_name()} - {self.get_action_display()}"


class SystemSettings(models.Model):
    """
    System-wide settings and configurations
    """
    
    key = models.CharField(max_length=100, unique=True)
    value = models.TextField()
    description = models.TextField(blank=True)
    
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'تنظیمات سیستم'
        verbose_name_plural = 'تنظیمات سیستم'
        
    def __str__(self):
        return self.key
