from django.db import models
from django.conf import settings
from decimal import Decimal

class Transaction(models.Model):
    """
    Financial transactions for accounting system
    """
    
    TRANSACTION_TYPE_CHOICES = [
        ('income', 'درآمد'),
        ('expense', 'هزینه'),
        ('payment', 'پرداخت'),
        ('refund', 'بازگشت وجه'),
    ]
    
    PAYMENT_METHOD_CHOICES = [
        ('cash', 'نقدی'),
        ('bank_transfer', 'انتقال بانکی'),
        ('card', 'کارت'),
        ('online', 'آنلاین'),
        ('other', 'سایر'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'در انتظار'),
        ('completed', 'تکمیل شده'),
        ('cancelled', 'لغو شده'),
        ('failed', 'ناموفق'),
    ]
    
    # Basic Information
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPE_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default='USD')
    
    # Related entities
    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.CASCADE,
        related_name='transactions',
        null=True,
        blank=True
    )
    
    payer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='payments_made',
        null=True,
        blank=True
    )
    
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='payments_received',
        null=True,
        blank=True
    )
    
    # Payment details
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES)
    reference_number = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Metadata
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='transactions_created'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        verbose_name = 'تراکنش'
        verbose_name_plural = 'تراکنش‌ها'
        ordering = ['-created_at']
        
    def __str__(self):
        return f"{self.get_transaction_type_display()} - {self.amount} {self.currency}"


class Invoice(models.Model):
    """
    Invoices for orders
    """
    
    STATUS_CHOICES = [
        ('draft', 'پیش‌نویس'),
        ('sent', 'ارسال شده'),
        ('paid', 'پرداخت شده'),
        ('overdue', 'معوقه'),
        ('cancelled', 'لغو شده'),
    ]
    
    # Invoice details
    invoice_number = models.CharField(max_length=50, unique=True)
    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.CASCADE,
        related_name='invoices'
    )
    
    # Financial details
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2)
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    
    # Dates
    issue_date = models.DateField()
    due_date = models.DateField()
    paid_date = models.DateField(null=True, blank=True)
    
    # Notes
    notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'فاکتور'
        verbose_name_plural = 'فاکتورها'
        ordering = ['-created_at']
        
    def __str__(self):
        return f"فاکتور {self.invoice_number} - {self.order}"
    
    def save(self, *args, **kwargs):
        if not self.invoice_number:
            # Generate invoice number
            last_invoice = Invoice.objects.order_by('-id').first()
            if last_invoice:
                last_number = int(last_invoice.invoice_number.split('-')[1])
                self.invoice_number = f"INV-{last_number + 1:06d}"
            else:
                self.invoice_number = "INV-000001"
        
        # Calculate total
        self.total = self.subtotal + self.tax - self.discount
        
        super().save(*args, **kwargs)


class PaymentSchedule(models.Model):
    """
    Payment schedules for orders (installments)
    """
    
    STATUS_CHOICES = [
        ('pending', 'در انتظار'),
        ('paid', 'پرداخت شده'),
        ('overdue', 'معوقه'),
        ('cancelled', 'لغو شده'),
    ]
    
    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.CASCADE,
        related_name='payment_schedules'
    )
    
    installment_number = models.PositiveIntegerField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    due_date = models.DateField()
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Related transaction
    transaction = models.ForeignKey(
        Transaction,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payment_schedules'
    )
    
    paid_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'برنامه پرداخت'
        verbose_name_plural = 'برنامه‌های پرداخت'
        ordering = ['order', 'installment_number']
        unique_together = ['order', 'installment_number']
        
    def __str__(self):
        return f"{self.order} - قسط {self.installment_number}"


class AccountingEntry(models.Model):
    """
    Double-entry accounting system
    """
    
    ENTRY_TYPE_CHOICES = [
        ('debit', 'بدهکار'),
        ('credit', 'بستانکار'),
    ]
    
    transaction = models.ForeignKey(
        Transaction,
        on_delete=models.CASCADE,
        related_name='accounting_entries'
    )
    
    account_name = models.CharField(max_length=100)
    entry_type = models.CharField(max_length=10, choices=ENTRY_TYPE_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    
    description = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'ثبت حسابداری'
        verbose_name_plural = 'ثبت‌های حسابداری'
        ordering = ['-created_at']
        
    def __str__(self):
        return f"{self.account_name} - {self.get_entry_type_display()} - {self.amount}"


class FinancialReport(models.Model):
    """
    Generated financial reports
    """
    
    REPORT_TYPE_CHOICES = [
        ('income_statement', 'صورت سود و زیان'),
        ('balance_sheet', 'ترازنامه'),
        ('cash_flow', 'جریان نقدی'),
        ('agent_payments', 'پرداخت‌های عامل‌ها'),
        ('student_payments', 'پرداخت‌های دانشجویان'),
    ]
    
    report_type = models.CharField(max_length=30, choices=REPORT_TYPE_CHOICES)
    title = models.CharField(max_length=200)
    
    # Date range
    start_date = models.DateField()
    end_date = models.DateField()
    
    # Report data (stored as JSON)
    data = models.JSONField()
    
    # File export
    file = models.FileField(upload_to='financial_reports/', null=True, blank=True)
    
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'گزارش مالی'
        verbose_name_plural = 'گزارش‌های مالی'
        ordering = ['-created_at']
        
    def __str__(self):
        return f"{self.title} ({self.start_date} - {self.end_date})"
