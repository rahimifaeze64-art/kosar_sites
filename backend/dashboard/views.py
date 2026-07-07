from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Count
from django.utils import timezone
from datetime import timedelta

from .models import Message, MessageAttachment, Notification, ActivityLog, SystemSettings
from orders.models import Order
from django.contrib.auth import get_user_model

User = get_user_model()


class MessageViewSet(viewsets.ModelViewSet):
    """Complete ViewSet for Message management with archive support"""
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['content', 'sender__first_name', 'sender__last_name']
    ordering_fields = ['created_at']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Get messages for current user with filters"""
        user = self.request.user
        
        # Base queryset - user can see messages they sent or received
        queryset = Message.objects.select_related('sender', 'recipient', 'order').filter(
            Q(sender=user) | Q(recipient=user) | Q(message_type='management')
        )
        
        # Filter by type
        message_type = self.request.query_params.get('type')
        if message_type:
            queryset = queryset.filter(message_type=message_type)
        
        # Filter by read status
        is_read = self.request.query_params.get('is_read')
        if is_read is not None:
            queryset = queryset.filter(is_read=is_read.lower() == 'true')
        
        # Filter by order
        order_id = self.request.query_params.get('order_id')
        if order_id:
            queryset = queryset.filter(order_id=order_id)
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(created_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__lte=end_date)
        
        return queryset
    
    def get_serializer_class(self):
        from api.serializers import MessageSerializer
        return MessageSerializer
    
    def perform_create(self, serializer):
        """Send message and create notification"""
        message = serializer.save(sender=self.request.user)
        
        # Update has_attachment flag if attachments exist
        if message.attachments.exists():
            message.has_attachment = True
            message.save()
        
        # Create notification for recipient
        if message.recipient:
            Notification.objects.create(
                user=message.recipient,
                notification_type='message_received',
                title='پیام جدید',
                message=f'پیام جدید از {message.sender.get_full_name()}',
                related_message=message
            )
        
        # Log activity
        ActivityLog.objects.create(
            user=self.request.user,
            action='send_message',
            description=f'پیام ارسال شد به {message.recipient.get_full_name() if message.recipient else "گروه"}',
            order=message.order,
            ip_address=self.request.META.get('REMOTE_ADDR')
        )
    
    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark message as read"""
        message = self.get_object()
        
        if message.recipient != request.user:
            return Response(
                {'error': 'شما مجاز به خواندن این پیام نیستید'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        message.is_read = True
        message.read_at = timezone.now()
        message.save()
        
        return Response(self.get_serializer(message).data)
    
    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """Mark all messages as read for current user"""
        updated = Message.objects.filter(
            recipient=request.user,
            is_read=False
        ).update(is_read=True, read_at=timezone.now())
        
        return Response({'success': True, 'updated_count': updated})
    
    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Get count of unread messages"""
        count = Message.objects.filter(
            recipient=request.user,
            is_read=False
        ).count()
        
        return Response({'unread_count': count})
    
    @action(detail=False, methods=['get'])
    def conversations(self, request):
        """Get list of conversations (unique users)"""
        user = request.user
        
        # Get all users the current user has exchanged messages with
        sent_to = Message.objects.filter(sender=user).values_list('recipient', flat=True).distinct()
        received_from = Message.objects.filter(recipient=user).values_list('sender', flat=True).distinct()
        
        user_ids = set(list(sent_to) + list(received_from))
        user_ids.discard(None)  # Remove None values
        
        conversations = []
        for user_id in user_ids:
            other_user = User.objects.get(id=user_id)
            
            # Get last message
            last_message = Message.objects.filter(
                Q(sender=user, recipient=other_user) | Q(sender=other_user, recipient=user)
            ).order_by('-created_at').first()
            
            # Count unread messages
            unread_count = Message.objects.filter(
                sender=other_user,
                recipient=user,
                is_read=False
            ).count()
            
            conversations.append({
                'user_id': other_user.id,
                'user_name': other_user.get_full_name(),
                'user_email': other_user.email,
                'last_message': last_message.content if last_message else None,
                'last_message_time': last_message.created_at if last_message else None,
                'unread_count': unread_count
            })
        
        # Sort by last message time
        conversations.sort(key=lambda x: x['last_message_time'] or timezone.now(), reverse=True)
        
        return Response(conversations)
    
    @action(detail=False, methods=['get'])
    def conversation_with(self, request):
        """Get conversation with specific user"""
        other_user_id = request.query_params.get('user_id')
        
        if not other_user_id:
            return Response(
                {'error': 'user_id الزامی است'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            other_user = User.objects.get(id=other_user_id)
        except User.DoesNotExist:
            return Response(
                {'error': 'کاربر یافت نشد'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        messages = Message.objects.filter(
            Q(sender=request.user, recipient=other_user) | 
            Q(sender=other_user, recipient=request.user)
        ).order_by('created_at')
        
        # Mark messages as read
        Message.objects.filter(
            sender=other_user,
            recipient=request.user,
            is_read=False
        ).update(is_read=True, read_at=timezone.now())
        
        serializer = self.get_serializer(messages, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def archive(self, request):
        """Get archived messages (older than 30 days)"""
        thirty_days_ago = timezone.now() - timedelta(days=30)
        
        archived_messages = self.get_queryset().filter(
            created_at__lt=thirty_days_ago
        )
        
        serializer = self.get_serializer(archived_messages, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def send_group_message(self, request):
        """Send message to multiple users"""
        recipient_ids = request.data.get('recipient_ids', [])
        content = request.data.get('content')
        group_name = request.data.get('group_name', 'گروه')
        
        if not recipient_ids or not content:
            return Response(
                {'error': 'recipient_ids و content الزامی هستند'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        messages_created = []
        for recipient_id in recipient_ids:
            try:
                recipient = User.objects.get(id=recipient_id)
                message = Message.objects.create(
                    sender=request.user,
                    recipient=recipient,
                    message_type='group',
                    content=content,
                    group_name=group_name
                )
                messages_created.append(message)
                
                # Create notification
                Notification.objects.create(
                    user=recipient,
                    notification_type='message_received',
                    title='پیام گروهی جدید',
                    message=f'پیام جدید در گروه {group_name}',
                    related_message=message
                )
            except User.DoesNotExist:
                continue
        
        return Response({
            'success': True,
            'messages_sent': len(messages_created)
        })


class NotificationViewSet(viewsets.ModelViewSet):
    """ViewSet for Notification model"""
    permission_classes = [IsAuthenticated]
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Get notifications for current user"""
        queryset = Notification.objects.filter(user=self.request.user)
        
        # Filter by type
        notification_type = self.request.query_params.get('type')
        if notification_type:
            queryset = queryset.filter(notification_type=notification_type)
        
        # Filter by read status
        is_read = self.request.query_params.get('is_read')
        if is_read is not None:
            queryset = queryset.filter(is_read=is_read.lower() == 'true')
        
        return queryset
    
    def get_serializer_class(self):
        from api.serializers import NotificationSerializer
        return NotificationSerializer
    
    @action(detail=False, methods=['get'])
    def unread(self, request):
        """Get unread notifications"""
        notifications = self.get_queryset().filter(is_read=False)
        serializer = self.get_serializer(notifications, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Get count of unread notifications"""
        count = self.get_queryset().filter(is_read=False).count()
        return Response({'unread_count': count})
    
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
        updated = self.get_queryset().filter(is_read=False).update(
            is_read=True,
            read_at=timezone.now()
        )
        return Response({'success': True, 'updated_count': updated})
    
    @action(detail=False, methods=['delete'])
    def clear_all(self, request):
        """Delete all read notifications"""
        deleted = self.get_queryset().filter(is_read=True).delete()
        return Response({
            'success': True,
            'deleted_count': deleted[0]
        })


class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for ActivityLog (read-only)"""
    permission_classes = [IsAuthenticated]
    ordering = ['-created_at']
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['action', 'description', 'user__first_name', 'user__last_name']
    
    def get_queryset(self):
        """Get activity logs based on role"""
        user = self.request.user
        
        if user.is_manager:
            queryset = ActivityLog.objects.all()
        elif user.is_employee:
            queryset = ActivityLog.objects.filter(
                Q(user=user) | Q(action__in=['create_order', 'update_order'])
            )
        else:
            queryset = ActivityLog.objects.filter(user=user)
        
        # Filter by action
        action = self.request.query_params.get('action')
        if action:
            queryset = queryset.filter(action=action)
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(created_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__lte=end_date)
        
        return queryset.select_related('user', 'order')
    
    def get_serializer_class(self):
        from api.serializers import ActivityLogSerializer
        return ActivityLogSerializer
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get activity statistics"""
        queryset = self.get_queryset()
        
        # Count by action
        by_action = queryset.values('action').annotate(count=Count('id'))
        
        # Recent activity (last 24 hours)
        yesterday = timezone.now() - timedelta(hours=24)
        recent_count = queryset.filter(created_at__gte=yesterday).count()
        
        return Response({
            'total_activities': queryset.count(),
            'recent_activities': recent_count,
            'by_action': list(by_action)
        })
