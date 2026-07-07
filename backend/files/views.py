from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import FileResponse, Http404
from django.db.models import Q, Sum, Count
from django.utils import timezone
from datetime import timedelta
import os

from .models import OrderFile, ProfileDocument, FileDownloadLog
from orders.models import Order
from dashboard.models import ActivityLog
from django.contrib.auth import get_user_model

User = get_user_model()


class OrderFileViewSet(viewsets.ModelViewSet):
    """Complete ViewSet for OrderFile with download and archive support"""
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['original_name', 'description']
    ordering_fields = ['uploaded_at', 'file_size']
    ordering = ['-uploaded_at']
    
    def get_queryset(self):
        """Filter files based on role and permissions"""
        user = self.request.user
        queryset = OrderFile.objects.select_related('order', 'uploaded_by')
        
        # Role-based filtering
        if user.is_manager or user.is_employee:
            pass  # Can see all files
        elif user.is_agent:
            queryset = queryset.filter(order__assigned_doctor=user)
        elif user.is_student:
            queryset = queryset.filter(order__student=user)
        else:
            return OrderFile.objects.none()
        
        # Filter by order
        order_id = self.request.query_params.get('order_id')
        if order_id:
            queryset = queryset.filter(order_id=order_id)
        
        # Filter by file type
        file_type = self.request.query_params.get('file_type')
        if file_type:
            queryset = queryset.filter(file_type=file_type)
        
        # Filter by active status
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(uploaded_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(uploaded_at__lte=end_date)
        
        return queryset
    
    def get_serializer_class(self):
        from api.serializers import OrderFileSerializer
        return OrderFileSerializer
    
    def perform_create(self, serializer):
        """Upload file and log activity"""
        file_obj = serializer.save(uploaded_by=self.request.user)
        
        # Log activity
        ActivityLog.objects.create(
            user=self.request.user,
            action='upload_file',
            description=f'فایل آپلود شد: {file_obj.original_name}',
            order=file_obj.order,
            ip_address=self.request.META.get('REMOTE_ADDR')
        )
    
    def perform_destroy(self, instance):
        """Delete file and log activity"""
        file_name = instance.original_name
        order = instance.order
        
        # Log activity before deletion
        ActivityLog.objects.create(
            user=self.request.user,
            action='delete_file',
            description=f'فایل حذف شد: {file_name}',
            order=order,
            ip_address=self.request.META.get('REMOTE_ADDR')
        )
        
        instance.delete()
    
    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Download file"""
        file_obj = self.get_object()
        
        # Check if file exists
        if not os.path.exists(file_obj.file.path):
            raise Http404('فایل یافت نشد')
        
        # Log download
        FileDownloadLog.objects.create(
            file=file_obj,
            downloaded_by=request.user,
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', '')
        )
        
        # Log activity
        ActivityLog.objects.create(
            user=request.user,
            action='download_file',
            description=f'فایل دانلود شد: {file_obj.original_name}',
            order=file_obj.order,
            ip_address=request.META.get('REMOTE_ADDR')
        )
        
        # Return file
        response = FileResponse(
            open(file_obj.file.path, 'rb'),
            content_type='application/octet-stream'
        )
        response['Content-Disposition'] = f'attachment; filename="{file_obj.original_name}"'
        return response
    
    @action(detail=True, methods=['post'])
    def upload_version(self, request, pk=None):
        """Upload new version of existing file"""
        old_file = self.get_object()
        new_file = request.FILES.get('file')
        
        if not new_file:
            return Response(
                {'error': 'فایل الزامی است'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create new file version
        new_version = OrderFile.objects.create(
            order=old_file.order,
            uploaded_by=request.user,
            file=new_file,
            original_name=old_file.original_name,
            description=old_file.description,
            version=old_file.version + 1,
            replaces=old_file
        )
        
        # Mark old file as inactive
        old_file.is_active = False
        old_file.save()
        
        # Log activity
        ActivityLog.objects.create(
            user=request.user,
            action='upload_file',
            description=f'نسخه جدید فایل آپلود شد: {new_version.original_name} (v{new_version.version})',
            order=new_version.order,
            ip_address=request.META.get('REMOTE_ADDR')
        )
        
        serializer = self.get_serializer(new_version)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def versions(self, request, pk=None):
        """Get all versions of a file"""
        file_obj = self.get_object()
        
        # Get all versions (files that replace this one or are replaced by this one)
        versions = OrderFile.objects.filter(
            Q(replaces=file_obj) | Q(id=file_obj.id) | Q(replaced_by__id=file_obj.id)
        ).order_by('version')
        
        serializer = self.get_serializer(versions, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def archive(self, request):
        """Get archived files (inactive or older than 90 days)"""
        ninety_days_ago = timezone.now() - timedelta(days=90)
        
        archived_files = self.get_queryset().filter(
            Q(is_active=False) | Q(uploaded_at__lt=ninety_days_ago)
        )
        
        serializer = self.get_serializer(archived_files, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get file statistics"""
        queryset = self.get_queryset()
        
        # Total files and size
        total_files = queryset.count()
        total_size = queryset.aggregate(Sum('file_size'))['file_size__sum'] or 0
        
        # By file type
        by_type = queryset.values('file_type').annotate(count=Count('id'))
        
        # Recent uploads (last 7 days)
        seven_days_ago = timezone.now() - timedelta(days=7)
        recent_uploads = queryset.filter(uploaded_at__gte=seven_days_ago).count()
        
        return Response({
            'total_files': total_files,
            'total_size_mb': round(total_size / (1024 * 1024), 2),
            'by_type': list(by_type),
            'recent_uploads': recent_uploads
        })
    
    @action(detail=True, methods=['get'])
    def download_history(self, request, pk=None):
        """Get download history for a file"""
        file_obj = self.get_object()
        
        logs = FileDownloadLog.objects.filter(file=file_obj).order_by('-downloaded_at')
        
        data = [
            {
                'downloaded_by': log.downloaded_by.get_full_name(),
                'downloaded_at': log.downloaded_at,
                'ip_address': log.ip_address
            }
            for log in logs
        ]
        
        return Response(data)


class ProfileDocumentViewSet(viewsets.ModelViewSet):
    """ViewSet for ProfileDocument model"""
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['original_name', 'description']
    ordering_fields = ['uploaded_at']
    ordering = ['-uploaded_at']
    
    def get_queryset(self):
        """Filter documents based on role"""
        user = self.request.user
        queryset = ProfileDocument.objects.select_related('user', 'verified_by')
        
        if user.is_manager or user.is_employee:
            pass  # Can see all documents
        else:
            queryset = queryset.filter(user=user)
        
        # Filter by document type
        document_type = self.request.query_params.get('document_type')
        if document_type:
            queryset = queryset.filter(document_type=document_type)
        
        # Filter by verification status
        is_verified = self.request.query_params.get('is_verified')
        if is_verified is not None:
            queryset = queryset.filter(is_verified=is_verified.lower() == 'true')
        
        # Filter by user
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        return queryset
    
    def get_serializer_class(self):
        from api.serializers import ProfileDocumentSerializer
        return ProfileDocumentSerializer
    
    def perform_create(self, serializer):
        """Upload document"""
        # If user is not manager/employee, set user to current user
        if not (self.request.user.is_manager or self.request.user.is_employee):
            serializer.save(user=self.request.user)
        else:
            serializer.save()
    
    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        """Verify a document"""
        if not (request.user.is_manager or request.user.is_employee):
            return Response(
                {'error': 'شما مجاز به تایید اسناد نیستید'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        document = self.get_object()
        document.is_verified = True
        document.verified_by = request.user
        document.verified_at = timezone.now()
        document.save()
        
        # Log activity
        ActivityLog.objects.create(
            user=request.user,
            action='verify_document',
            description=f'سند تایید شد: {document.original_name} برای {document.user.get_full_name()}',
            ip_address=request.META.get('REMOTE_ADDR')
        )
        
        return Response(self.get_serializer(document).data)
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a document"""
        if not (request.user.is_manager or request.user.is_employee):
            return Response(
                {'error': 'شما مجاز به رد اسناد نیستید'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        document = self.get_object()
        document.is_verified = False
        document.verified_by = None
        document.verified_at = None
        document.save()
        
        # Log activity
        ActivityLog.objects.create(
            user=request.user,
            action='reject_document',
            description=f'سند رد شد: {document.original_name} برای {document.user.get_full_name()}',
            ip_address=request.META.get('REMOTE_ADDR')
        )
        
        return Res