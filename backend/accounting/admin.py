from django.contrib import admin
from .models import Transaction, Invoice, PaymentSchedule, AccountingEntry, FinancialReport

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ['id', 'transaction_type', 'amount', 'currency', 'status', 'created_at']
    list_filter = ['transaction_type', 'status', 'payment_method', 'created_at']
    search_fields = ['reference_number', 'description']
    date_hierarchy = 'created_at'

@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ['invoice_number', 'order', 'total', 'status', 'issue_date', 'due_date']
    list_filter = ['status', 'issue_date']
    search_fields = ['invoice_number', 'order__id']
    date_hierarchy = 'issue_date'

@admin.register(PaymentSchedule)
class PaymentScheduleAdmin(admin.ModelAdmin):
    list_display = ['order', 'installment_number', 'amount', 'due_date', 'status']
    list_filter = ['status', 'due_date']
    search_fields = ['order__id']

@admin.register(AccountingEntry)
class AccountingEntryAdmin(admin.ModelAdmin):
    list_display = ['transaction', 'account_name', 'entry_type', 'amount', 'created_at']
    list_filter = ['entry_type', 'created_at']
    search_fields = ['account_name', 'description']

@admin.register(FinancialReport)
class FinancialReportAdmin(admin.ModelAdmin):
    list_display = ['title', 'report_type', 'start_date', 'end_date', 'generated_by', 'created_at']
    list_filter = ['report_type', 'created_at']
    search_fields = ['title']
    date_hierarchy = 'created_at'
