from django.contrib import admin
from .models import Order, OrderTask, OrderRejection


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['id', 'student', 'type', 'status', 'progress', 'total_amount', 'created_at']
    list_filter = ['status', 'type', 'degree', 'created_at']
    search_fields = ['student__first_name', 'student__last_name', 'university', 'field']
    date_hierarchy = 'created_at'
    readonly_fields = ['created_at', 'updated_at', 'approved_at', 'assigned_at', 'completed_at']
    
    fieldsets = (
        ('اطلاعات پایه', {
            'fields': ('student', 'university', 'field', 'degree', 'type')
        }),
        ('وضعیت', {
            'fields': ('status', 'stage', 'progress')
        }),
        ('تخصیص', {
            'fields': ('assigned_doctor', 'assigned_at')
        }),
        ('زمان‌بندی', {
            'fields': ('deadline', 'estimated_days')
        }),
        ('مالی', {
            'fields': ('total_amount', 'doctor_share', 'manager_share', 'payment_status', 'paid_amount')
        }),
        ('اطلاعات اضافی', {
            'fields': ('description', 'passport_number')
        }),
        ('تاریخچه', {
            'fields': ('created_at', 'updated_at', 'approved_at', 'completed_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(OrderTask)
class OrderTaskAdmin(admin.ModelAdmin):
    list_display = ['id', 'order', 'title', 'status', 'assigned_to', 'assigned_user', 'due_date']
    list_filter = ['status', 'assigned_to', 'created_at']
    search_fields = ['title', 'description', 'order__id']
    date_hierarchy = 'created_at'


@admin.register(OrderRejection)
class OrderRejectionAdmin(admin.ModelAdmin):
    list_display = ['id', 'order', 'rejected_by', 'created_at']
    list_filter = ['created_at']
    search_fields = ['order__id', 'reason']
    date_hierarchy = 'created_at'
    readonly_fields = ['created_at']
