from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.contrib.auth import authenticate, login, logout, get_user_model
from django.db.models import Q, Sum, Count
from django.utils import timezone
from datetime import datetime, timedelta

from orders.models import Order, OrderTask, OrderRejection
from students.models import StudentProfile
from files.models import OrderFile, ProfileDocument
from dashboard.models import Message, MessageAttachment, Notification, ActivityLog
from accounting.models import Transaction, Invoice, PaymentSchedule, AccountingEntry, FinancialReport

from .serializers import (
    UserSerializer, StudentProfileSerializer, OrderSerializer, OrderTaskSerializer,
    OrderRejectionSerializer, OrderFileSerializer, ProfileDocumentSerializer,
    MessageSerializer, MessageAttachmentSerializer, NotificationSerializer,
    ActivityLogSerializer, TransactionSerializer, InvoiceSerializer,
    PaymentScheduleSerializer, AccountingEntrySerializer, FinancialReportSerializer,
    DashboardStatsSerializer
)

User = get_user_model()


# Authentication Views
@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """User login"""
    username = request.data.get('username')
    password = request.data.get('password')
    
    user = authenticate(request, username=username, password=password)
    
    if user is not None:
        login(request, user)
        
        # Log activity
        ActivityLog.objects.create(
            user=user,
            action='login',
            description=f'{user.get_full_name()} وارد سیستم شد',
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', '')
        )
        
        return Response({
            'success': True,
            'user': UserSerializer(user).data
        })
    else:
        return Response({
            'success': False,
            'error': 'نام کاربری یا رمز عبور اشتباه است'
        }, status=status.HTTP_401_UNAUTHORIZED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """User logout"""
    user = request.user
    
    # Log activity
    ActivityLog.objects.create(
        user=user,
        action='logout',
        description=f'{user.get_full_name()} از سیستم خارج شد',
        ip_address=request.META.get('REMOTE_ADDR'),
        user_agent=request.META.get('HTTP_USER_AGENT', '')
    )
    
    logout(request)
    return Response({'success': True})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user_view(request):
    """Get current authenticated user"""
    return Response(UserSerializer(request.user).data)


# User ViewSet
class UserViewSet(viewsets.ModelViewSet):
    """ViewSet for User model"""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter users based on role"""
        user = self.request.user
        
        if user.is_manager:
            return User.objects.all()
        elif user.is_employee:
            return User.objects.filter(Q(role='student') | Q(role='agent'))
        else:
            return User.objects.filter(id=user.id)
    
    @action(detail=False, methods=['get'])
    def by_role(self, request):
        """Get users by role"""
        role = request.query_params.get('role')
        users = self.get_queryset().filter(role=role)
        serializer = self.get_serializer(users, many=True)
        return Response(serializer.data)


# Order ViewSet
class OrderViewSet(viewsets.ModelViewSet):
    """ViewSet for Order model"""
    queryset = Order.objects.all()
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter orders based on role"""
        user = self.request.user
        
        if user.is_manager:
            return Order.objects.all()
        elif user.is_employee:
            return Order.objects.filter(
                Q(status='pending') | Q(status='in_progress')
            )
        elif user.is_agent:
            return Order.objects.filter(assigned_doctor=user)
        elif user.is_student:
            return Order.objects.filter(student=user)
        else:
            return Order.objects.none()
    
    def perform_create(self, serializer):
        """Create order and log activity"""
        order = serializer.save()
        
        ActivityLog.objects.create(
            user=self.request.user,
            action='create_order',
            description=f'سفارش جدید ایجاد شد: {order.type}',
            order=order,
            ip_address=self.request.META.get('REMOTE_ADDR')
        )
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve an order"""
        order = self.get_object()
        
        if not (request.user.is_manager or request.user.is_employee):
            return Response(
                {'error': 'شما مجوز تایید سفارش را ندارید'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        order.status = 'approved'
        order.approved_at = timezone.now()
        order.save()
        
        # Create notification
        Notification.objects.create(
            user=order.student,
            notification_type='order_approved',
            title='تایید سفارش',
            message=f'سفارش شما ({order.type}) تایید شد',
            order=order
        )
        
        # Log activity
        ActivityLog.objects.create(
            user=request.user,
            action='approve_order',
            description=f'سفارش تایید شد: {order.id}',
            order=order,
            ip_address=request.META.get('REMOTE_ADDR')
        )
        
        return Response(self.get_serializer(order).data)
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject an order"""
        order = self.get_object()
        reason = request.data.get('reason', '')
        
        if not (request.user.is_manager or request.user.is_employee):
            return Response(
                {'error': 'شما مجوز رد سفارش را ندارید'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        order.status = 'rejected'
        order.save()
        
        # Create rejection record
        OrderRejection.objects.create(
            order=order,
            reason=reason,
            rejected_by=request.user
        )
        
        # Create notification
        Notification.objects.create(
            user=order.student,
            notification_type='order_rejected',
            title='رد سفارش',
            message=f'سفارش شما ({order.type}) رد شد. دلیل: {reason}',
            order=order
        )
        
        # Log activity
        ActivityLog.objects.create(
            user=request.user,
            action='reject_order',
            description=f'سفارش رد شد: {order.id}',
            order=order,
            ip_address=request.META.get('REMOTE_ADDR')
        )
        
        return Response(self.get_serializer(order).data)
    
    @action(detail=True, methods=['post'])
    def assign(self, request, pk=None):
        """Assign order to an agent"""
        order = self.get_object()
        agent_id = request.data.get('agent_id')
        
        if not (request.user.is_manager or request.user.is_employee):
            return Response(
                {'error': 'شما مجوز تخصیص سفارش را ندارید'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            agent = User.objects.get(id=agent_id, role='agent')
        except User.DoesNotExist:
            return Response(
                {'error': 'عامل یافت نشد'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        order.assigned_doctor = agent
        order.assigned_at = timezone.now()
        order.status = 'in_progress'
        order.save()
        
        # Create notification for agent
        Notification.objects.create(
            user=agent,
            notification_type='order_assigned',
            title='تخصیص سفارش جدید',
            message=f'سفارش جدید به شما تخصیص داده شد: {order.type}',
            order=order
        )
        
        # Log activity
        ActivityLog.objects.create(
            user=request.user,
            action='assign_order',
            description=f'سفارش به {agent.get_full_name()} تخصیص داده شد',
            order=order,
            ip_address=request.META.get('REMOTE_ADDR')
        )
        
        return Response(self.get_serializer(order).data)


# Order Task ViewSet
class OrderTaskViewSet(viewsets.ModelViewSet):
    """ViewSet for OrderTask model"""
    queryset = OrderTask.objects.all()
    serializer_class = OrderTaskSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter tasks based on role"""
        user = self.request.user
        order_id = self.request.query_params.get('order_id')
        
        queryset = OrderTask.objects.all()
        
        if order_id:
            queryset = queryset.filter(order_id=order_id)
        
        if user.is_agent:
            queryset = queryset.filter(assigned_user=user)
        elif user.is_student:
            queryset = queryset.filter(order__student=user)
        
        return queryset


# File ViewSets
class OrderFileViewSet(viewsets.ModelViewSet):
    """ViewSet for OrderFile model"""
    queryset = OrderFile.objects.all()
    serializer_class = OrderFileSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter files based on role"""
        user = self.request.user
        order_id = self.request.query_params.get('order_id')
        
        queryset = OrderFile.objects.all()
        
        if order_id:
            queryset = queryset.filter(order_id=order_id)
        
        if user.is_student:
            queryset = queryset.filter(order__student=user)
        elif user.is_agent:
            queryset = queryset.filter(order__assigned_doctor=user)
        
        return queryset
    
    def perform_create(self, serializer):
        """Upload file and log activity"""
        file_obj = serializer.save(uploaded_by=self.request.user)
        
        ActivityLog.objects.create(
            user=self.request.user,
            action='upload_file',
            description=f'فایل آپلود شد: {file_obj.original_name}',
            order=file_obj.order,
            ip_address=self.request.META.get('REMOTE_ADDR')
        )


class ProfileDocumentViewSet(viewsets.ModelViewSet):
    """ViewSet for ProfileDocument model"""
    queryset = ProfileDocument.objects.all()
    serializer_class = ProfileDocumentSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter documents based on role"""
        user = self.request.user
        
        if user.is_manager or user.is_employee:
            return ProfileDocument.objects.all()
        else:
            return ProfileDocument.objects.filter(user=user)


# Message ViewSet
class MessageViewSet(viewsets.ModelViewSet):
    """ViewSet for Message model"""
    queryset = Message.objects.all()
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Get messages for current user"""
        user = self.request.user
        message_type = self.request.query_params.get('type')
        
        queryset = Message.objects.filter(
            Q(sender=user) | Q(recipient=user) | Q(message_type='management')
        )
        
        if message_type:
            queryset = queryset.filter(message_type=message_type)
        
        return queryset
    
    def perform_create(self, serializer):
        """Send message and create notification"""
        message = serializer.save(sender=self.request.user)
        
        # Create notification for recipient
        if message.recipient:
            Notification.objects.create(
                user=message.recipient,
                notification_type='message_received',
                title='پیام جدید',
                message=f'پیام جدید از {message.sender.get_full_name()}',
                related_message=message
            )
    
    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark message as read"""
        message = self.get_object()
        message.is_read = True
        message.read_at = timezone.now()
        message.save()
        return Response(self.get_serializer(message).data)


# Notification ViewSet
class NotificationViewSet(viewsets.ModelViewSet):
    """ViewSet for Notification model"""
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Get notifications for current user"""
        return Notification.objects.filter(user=self.request.user)
    
    @action(detail=False, methods=['get'])
    def unread(self, request):
        """Get unread notifications"""
        notifications = self.get_queryset().filter(is_read=False)
        serializer = self.get_serializer(notifications, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark notification as read"""
        notification = self.get_object()
        notification.is_read = True
        notification.read_at = timezone.now()
        notification.save()
        return Response(self.get_serializer(notification).data)
    
    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """Mark all notifications as read"""
        self.get_queryset().filter(is_read=False).update(
            is_read=True,
            read_at=timezone.now()
        )
        return Response({'success': True})


# Dashboard Statistics
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    """Get dashboard statistics"""
    user = request.user
    
    # Base statistics
    stats = {
        'total_orders': 0,
        'pending_orders': 0,
        'in_progress_orders': 0,
        'completed_orders': 0,
        'total_students': 0,
        'total_agents': 0,
        'total_revenue': 0,
        'pending_payments': 0,
    }
    
    if user.is_manager:
        stats['total_orders'] = Order.objects.count()
        stats['pending_orders'] = Order.objects.filter(status='pending').count()
        stats['in_progress_orders'] = Order.objects.filter(status='in_progress').count()
        stats['completed_orders'] = Order.objects.filter(status='completed').count()
        stats['total_students'] = User.objects.filter(role='student').count()
        stats['total_agents'] = User.objects.filter(role='agent').count()
        
        # Financial stats
        total_revenue = Transaction.objects.filter(
            transaction_type='income',
            status='completed'
        ).aggregate(Sum('amount'))['amount__sum'] or 0
        stats['total_revenue'] = total_revenue
        
        pending_payments = Order.objects.filter(
            status__in=['approved', 'in_progress']
        ).aggregate(Sum('total_amount'))['total_amount__sum'] or 0
        stats['pending_payments'] = pending_payments
        
    elif user.is_employee:
        stats['pending_orders'] = Order.objects.filter(status='pending').count()
        stats['in_progress_orders'] = Order.objects.filter(status='in_progress').count()
        
    elif user.is_agent:
        stats['total_orders'] = Order.objects.filter(assigned_doctor=user).count()
        stats['in_progress_orders'] = Order.objects.filter(
            assigned_doctor=user,
            status='in_progress'
        ).count()
        stats['completed_orders'] = Order.objects.filter(
            assigned_doctor=user,
            status='completed'
        ).count()
        
    elif user.is_student:
        stats['total_orders'] = Order.objects.filter(student=user).count()
        stats['pending_orders'] = Order.objects.filter(student=user, status='pending').count()
        stats['in_progress_orders'] = Order.objects.filter(student=user, status='in_progress').count()
        stats['completed_orders'] = Order.objects.filter(student=user, status='completed').count()
    
    serializer = DashboardStatsSerializer(stats)
    return Response(serializer.data)


# Recent Orders API
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def recent_orders(request):
    """Get recent orders for dashboard"""
    user = request.user
    limit = int(request.query_params.get('limit', 10))
    
    # Filter based on role
    if user.is_manager:
        orders = Order.objects.all()
    elif user.is_employee:
        orders = Order.objects.filter(
            Q(status='pending') | Q(status='in_progress')
        )
    elif user.is_agent:
        orders = Order.objects.filter(assigned_doctor=user)
    elif user.is_student:
        orders = Order.objects.filter(student=user)
    else:
        return Response([])
    
    # Get recent orders
    orders = orders.select_related(
        'student', 'assigned_doctor'
    ).order_by('-created_at')[:limit]
    
    serializer = OrderSerializer(orders, many=True)
    return Response(serializer.data)
