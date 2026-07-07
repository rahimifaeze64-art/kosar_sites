from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from accounting import views as accounting_views
from students import views as students_views
from dashboard import views as dashboard_views
from files import views as files_views

router = DefaultRouter()

# Register ViewSets
router.register(r'users', views.UserViewSet, basename='user')
router.register(r'student-profiles', students_views.StudentProfileViewSet, basename='studentprofile')
router.register(r'orders', views.OrderViewSet, basename='order')
router.register(r'order-tasks', views.OrderTaskViewSet, basename='ordertask')

# File Management
router.register(r'order-files', files_views.OrderFileViewSet, basename='orderfile')
router.register(r'profile-documents', files_views.ProfileDocumentViewSet, basename='profiledocument')

# Dashboard & Communication
router.register(r'messages', dashboard_views.MessageViewSet, basename='message')
router.register(r'notifications', dashboard_views.NotificationViewSet, basename='notification')
router.register(r'activity-logs', dashboard_views.ActivityLogViewSet, basename='activitylog')

# Accounting ViewSets
router.register(r'transactions', accounting_views.TransactionViewSet, basename='transaction')
router.register(r'invoices', accounting_views.InvoiceViewSet, basename='invoice')
router.register(r'payment-schedules', accounting_views.PaymentScheduleViewSet, basename='paymentschedule')
router.register(r'financial-reports', accounting_views.FinancialReportViewSet, basename='financialreport')

urlpatterns = [
    # Authentication
    path('auth/login/', views.login_view, name='login'),
    path('auth/logout/', views.logout_view, name='logout'),
    path('auth/current-user/', views.current_user_view, name='current-user'),
    
    # Dashboard
    path('dashboard/stats/', views.dashboard_stats, name='dashboard-stats'),
    path('dashboard/recent-orders/', views.recent_orders, name='recent-orders'),
    
    # Router URLs
    path('', include(router.urls)),
]
