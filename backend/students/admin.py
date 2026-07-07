from django.contrib import admin
from .models import StudentProfile


@admin.register(StudentProfile)
class StudentProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'university', 'student_id', 'field', 'degree', 'completion_percentage']
    list_filter = ['university', 'degree', 'field']
    search_fields = ['user__first_name', 'user__last_name', 'student_id', 'university']
    readonly_fields = ['created_at', 'updated_at', 'completion_percentage']
    
    fieldsets = (
        ('کاربر', {
            'fields': ('user',)
        }),
        ('اطلاعات تحصیلی', {
            'fields': ('university', 'student_id', 'system_password', 'field', 'degree', 'interest')
        }),
        ('سفارش و وضعیت', {
            'fields': ('order_type', 'committee_status', 'irandoc_status')
        }),
        ('اساتید و نویسندگان', {
            'fields': ('supervisor', 'assigned_writer')
        }),
        ('تحویل و پیگیری', {
            'fields': ('delivery_date', 'admin_status', 'typing_status', 'summary_status', 'peer_review_status')
        }),
        ('مقالات', {
            'fields': ('article1_status', 'article2_status')
        }),
        ('متادیتا', {
            'fields': ('created_at', 'updated_at', 'completion_percentage'),
            'classes': ('collapse',)
        }),
    )
