from django.contrib import admin
from .models import OrderFile, ProfileDocument, FileDownloadLog


@admin.register(OrderFile)
class OrderFileAdmin(admin.ModelAdmin):
    list_display = ['id', 'original_name', 'order', 'uploaded_by', 'file_type', 'file_size_mb', 'uploaded_at']
    list_filter = ['file_type', 'uploaded_at', 'is_active']
    search_fields = ['original_name', 'order__id', 'uploaded_by__username']
    date_hierarchy = 'uploaded_at'
    readonly_fields = ['uploaded_at', 'file_size', 'file_type', 'file_size_mb']


@admin.register(ProfileDocument)
class ProfileDocumentAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'document_type', 'original_name', 'is_verified', 'uploaded_at']
    list_filter = ['document_type', 'is_verified', 'uploaded_at']
    search_fields = ['user__username', 'original_name']
    date_hierarchy = 'uploaded_at'
    readonly_fields = ['uploaded_at']


@admin.register(FileDownloadLog)
class FileDownloadLogAdmin(admin.ModelAdmin):
    list_display = ['id', 'file', 'downloaded_by', 'ip_address', 'downloaded_at']
    list_filter = ['downloaded_at']
    search_fields = ['file__original_name', 'downloaded_by__username', 'ip_address']
    date_hierarchy = 'downloaded_at'
    readonly_fields = ['downloaded_at']
