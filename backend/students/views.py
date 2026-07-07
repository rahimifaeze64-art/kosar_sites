from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Count, Avg
from django.utils import timezone
from datetime import datetime, timedelta

from .models import StudentProfile
from .serializers import (
    StudentProfileSerializer, StudentProfileCreateSerializer,
    StudentProfileUpdateSerializer, StudentListSerializer,
    StudentStatisticsSerializer, StudentTimelineSerializer
)
from orders.models import Order
from dashboard.models import ActivityLog, Notification
from django.contrib.auth import get_user_model

User = get_user_model()


class StudentProfileViewSet(viewsets.ModelViewSet):
    """Complete ViewSet for Student Profile management"""
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['user__first_name', 'user__last_name', 'user__email', 'student_id', 'university', 'field']
    ordering_fields = ['created_at', 'user__first_name', 'university', 'delivery_date']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Filter students based on role and query params"""
        user = self.request.user
        queryset = StudentProfile.objects.select_related('user')
        
        # Role-based filtering
        if user.is_manager or user.is_employee:
            pass  # Can see all
        elif user.is_student:
            queryset = queryset.filter(user=user)
        else:
            return StudentProfile.objects.none()
        
        # Additional filters from query params
        university = self.request.query_params.get('university')
        degree = self.request.query_params.get('degree')
        field = self.request.query_params.get('field')
        assigned_writer = self.request.query_params.get('assigned_writer')
        supervisor = self.request.query_params.get('supervisor')
        
        if university:
            queryset = queryset.filter(university__icontains=university)
        if degree:
            queryset = queryset.filter(degree=degree)
        if field:
            queryset = queryset.filter(field__icontains=field)
        if assigned_writer:
            queryset = queryset.filter(assigned_writer__icontains=assigned_writer)
        if supervisor:
            queryset = queryset.filter(supervisor__icontains=supervisor)
        
        return queryset
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action"""
        if self.action == 'create':
            return StudentProfileCreateSerializer
        elif self.action == 'update' or self.action == 'partial_update':
            return StudentProfileUpdateSerializer
        elif self.action == 'list':
            return StudentListSerializer
        return StudentProfileSerializer
    
    def perform_create(self, serializer):
        """Create student profile and log activity"""
        profile = serializer.save()
        
        # Log activity
        ActivityLog.objects.create(
            user=self.request.user,
            action='create_student',
            description=f'دانشجوی جدید ایجاد شد: {profile.user.get_full_name()}',
            ip_address=self.request.META.get('REMOTE_ADDR')
        )
        
        # Send welcome notification to student
        Notification.objects.create(
            user=profile.user,
            notification_type='welcome',
            title='خوش آمدید',
            message='حساب کاربری شما با موفقیت ایجاد شد. لطفاً پروفایل خود را تکمیل کنید.'
        )
    
    def perform_update(self, serializer):
        """Update student profile and log activity"""
        profile = serializer.save()
        
        # Log activity
        ActivityLog.objects.create(
            user=self.request.user,
            action='update_student',
            description=f'پروفایل دانشجو به‌روزرسانی شد: {profile.user.get_full_name()}',
            ip_address=self.request.META.get('REMOTE_ADDR')
        )
    
    def perform_destroy(self, instance):
        """Delete student profile and associated user"""
        user = instance.user
        student_name = user.get_full_name()
        
        # Log activity before deletion
        ActivityLog.objects.create(
            user=self.request.user,
            action='delete_student',
            description=f'دانشجو حذف شد: {student_name}',
            ip_address=self.request.META.get('REMOTE_ADDR')
        )
        
        # Delete profile (user will be deleted via CASCADE)
        instance.delete()
    
    @action(detail=True, methods=['get'])
    def timeline(self, request, pk=None):
        """Get student's educational timeline"""
        profile = self.get_object()
        
        timeline = []
        
        # Build timeline from status fields
        status_fields = [
            ('committee_status', 'لجنه', profile.committee_status),
            ('irandoc_status', 'ایران‌داک', profile.irandoc_status),
            ('admin_status', 'امورداری', profile.admin_status),
            ('typing_status', 'تنضید', profile.typing_status),
            ('summary_status', 'تلخیص', profile.summary_status),
            ('peer_review_status', 'همتند', profile.peer_review_status),
            ('article1_status', 'مقاله 1', profile.article1_status),
            ('article2_status', 'مقاله 2', profile.article2_status),
        ]
        
        for field_name, label, value in status_fields:
            if value:
                timeline.append({
                    'field': field_name,
                    'label': label,
                    'status': value,
                    'completed': value in ['تکمیل شده', 'تایید شده', 'پذیرش شده']
                })
        
        # Calculate overall progress
        total_steps = len(status_fields)
        completed_steps = sum(1 for item in timeline if item['completed'])
        overall_progress = round((completed_steps / total_steps) * 100) if total_steps > 0 else 0
        
        data = {
            'student_id': profile.id,
            'full_name': profile.user.get_full_name(),
            'timeline': timeline,
            'overall_progress': overall_progress
        }
        
        serializer = StudentTimelineSerializer(data)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def orders(self, request, pk=None):
        """Get all orders for a student"""
        profile = self.get_object()
        orders = Order.objects.filter(student=profile.user).order_by('-created_at')
        
        from api.serializers import OrderSerializer
        serializer = OrderSerializer(orders, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        """Update specific status field"""
        profile = self.get_object()
        field_name = request.data.get('field')
        new_status = request.data.get('status')
        
        # Validate field name
        valid_fields = [
            'committee_status', 'irandoc_status', 'admin_status',
            'typing_status', 'summary_status', 'peer_review_status',
            'article1_status', 'article2_status'
        ]
        
        if field_name not in valid_fields:
            return Response(
                {'error': 'فیلد نامعتبر است'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update field
        setattr(profile, field_name, new_status)
        profile.save()
        
        # Log activity
        ActivityLog.objects.create(
            user=request.user,
            action='update_student_status',
            description=f'وضعیت {field_name} برای {profile.user.get_full_name()} به {new_status} تغییر کرد',
            ip_address=request.META.get('REMOTE_ADDR')
        )
        
        # Notify student
        Notification.objects.create(
            user=profile.user,
            notification_type='status_update',
            title='به‌روزرسانی وضعیت',
            message=f'وضعیت {field_name} شما به {new_status} تغییر کرد'
        )
        
        return Response(self.get_serializer(profile).data)
    
    @action(detail=True, methods=['post'])
    def assign_writer(self, request, pk=None):
        """Assign writer to student"""
        profile = self.get_object()
        writer_name = request.data.get('writer_name')
        
        if not writer_name:
            return Response(
                {'error': 'نام نویسنده الزامی است'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        profile.assigned_writer = writer_name
        profile.save()
        
        # Log activity
        ActivityLog.objects.create(
            user=request.user,
            action='assign_writer',
            description=f'{writer_name} به {profile.user.get_full_name()} تخصیص داده شد',
            ip_address=request.META.get('REMOTE_ADDR')
        )
        
        # Notify student
        Notification.objects.create(
            user=profile.user,
            notification_type='writer_assigned',
            title='تخصیص نویسنده',
            message=f'{writer_name} به عنوان نویسنده به شما تخصیص داده شد'
        )
        
        return Response(self.get_serializer(profile).data)
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get student statistics"""
        queryset = self.get_queryset()
        
        # Total students
        total_students = queryset.count()
        
        # Active students (with recent activity)
        thirty_days_ago = timezone.now() - timedelta(days=30)
        active_students = queryset.filter(updated_at__gte=thirty_days_ago).count()
        
        # By degree
        by_degree = {}
        degree_counts = queryset.values('degree').annotate(count=Count('id'))
        for item in degree_counts:
            if item['degree']:
                by_degree[item['degree']] = item['count']
        
        # By university
        by_university = {}
        university_counts = queryset.values('university').annotate(count=Count('id'))
        for item in university_counts:
            if item['university']:
                by_university[item['university']] = item['count']
        
        # Average completion percentage
        profiles = queryset.all()
        if profiles:
            avg_completion = sum(p.completion_percentage for p in profiles) / len(profiles)
        else:
            avg_completion = 0
        
        # Recent registrations (last 7 days)
        seven_days_ago = timezone.now() - timedelta(days=7)
        recent_registrations = queryset.filter(created_at__gte=seven_days_ago).count()
        
        stats = {
            'total_students': total_students,
            'active_students': active_students,
            'by_degree': by_degree,
            'by_university': by_university,
            'avg_completion': round(avg_completion, 2),
            'recent_registrations': recent_registrations
        }
        
        serializer = StudentStatisticsSerializer(stats)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def export(self, request):
        """Export students data as CSV"""
        import csv
        from django.http import HttpResponse
        
        queryset = self.get_queryset()
        
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="students.csv"'
        response.write('\ufeff')  # UTF-8 BOM for Excel
        
        writer = csv.writer(response)
        
        # Header
        writer.writerow([
            'نام و نام خانوادگی', 'ایمیل', 'تلفن', 'دانشگاه', 'شماره دانشجویی',
            'رشته', 'مقطع', 'استاد', 'نویسنده', 'تاریخ تحویل',
            'درصد تکمیل', 'تاریخ ثبت‌نام'
        ])
        
        # Data rows
        for profile in queryset:
            writer.writerow([
                profile.user.get_full_name(),
                profile.user.email,
                profile.user.phone,
                profile.university,
                profile.student_id,
                profile.field,
                profile.get_degree_display() if profile.degree else '',
                profile.supervisor,
                profile.assigned_writer,
                profile.delivery_date.strftime('%Y-%m-%d') if profile.delivery_date else '',
                profile.completion_percentage,
                profile.created_at.strftime('%Y-%m-%d')
            ])
        
        return response
    
    @action(detail=False, methods=['post'])
    def bulk_update(self, request):
        """Bulk update student statuses"""
        student_ids = request.data.get('student_ids', [])
        field_name = request.data.get('field')
        new_status = request.data.get('status')
        
        if not student_ids or not field_name or not new_status:
            return Response(
                {'error': 'پارامترهای الزامی ارسال نشده است'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate field name
        valid_fields = [
            'committee_status', 'irandoc_status', 'admin_status',
            'typing_status', 'summary_status', 'peer_review_status',
            'article1_status', 'article2_status'
        ]
        
        if field_name not in valid_fields:
            return Response(
                {'error': 'فیلد نامعتبر است'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update profiles
        profiles = StudentProfile.objects.filter(id__in=student_ids)
        updated_count = profiles.update(**{field_name: new_status})
        
        # Log activity
        ActivityLog.objects.create(
            user=request.user,
            action='bulk_update_students',
            description=f'{updated_count} دانشجو به‌روزرسانی شد: {field_name} = {new_status}',
            ip_address=request.META.get('REMOTE_ADDR')
        )
        
        return Response({
            'success': True,
            'updated_count': updated_count
        })
    
    @action(detail=False, methods=['get'])
    def filters(self, request):
        """Get available filter options"""
        queryset = self.get_queryset()
        
        universities = queryset.values_list('university', flat=True).distinct()
        fields = queryset.values_list('field', flat=True).distinct()
        writers = queryset.values_list('assigned_writer', flat=True).distinct()
        supervisors = queryset.values_list('supervisor', flat=True).distinct()
        
        return Response({
            'universities': [u for u in universities if u],
            'fields': [f for f in fields if f],
            'writers': [w for w in writers if w],
            'supervisors': [s for s in supervisors if s],
            'degrees': [choice[0] for choice in StudentProfile.DEGREE_CHOICES],
            'statuses': [choice[0] for choice in StudentProfile.STATUS_CHOICES if choice[0]],
            'article_statuses': [choice[0] for choice in StudentProfile.ARTICLE_STATUS_CHOICES if choice[0]]
        })
