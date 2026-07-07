"""
URL configuration for Educational Management System (Kosar Software)
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

# Admin site customization
admin.site.site_header = 'سیستم مدیریت تحصیلی کوثر'
admin.site.site_title = 'پنل مدیریت کوثر'
admin.site.index_title = 'خوش آمدید به پنل مدیریت'

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
