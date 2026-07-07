from rest_framework import serializers
from django.contrib.auth import get_user_model
from orders.models import Order, OrderTask, OrderRejection
from students.models import StudentProfile
from files.models import OrderFile, ProfileDocument
from dashboard.models import Message, MessageAttachment, Notification, ActivityLog
from accounting.models import Transaction, Invoice, PaymentSchedule, AccountingEntry, FinancialReport

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model"""
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'phone', 'active', 'specialization', 'department',
            'passport_number', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'password': {'write_only': True}
        }
    
    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        user.save()
        return user


class StudentProfileSerializer(serializers.ModelSerializer):
    """Serializer for StudentProfile model"""
    
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    completion_percentage = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = StudentProfile
        fields = '__all__'
        read_only_fields = ['user', 'created_at', 'updated_at']


class OrderTaskSerializer(serializers.ModelSerializer):
    """Serializer for OrderTask model"""
    
    assigned_user_name = serializers.CharField(source='assigned_user.get_full_name', read_only=True)
    
    class Meta:
        model = OrderTask
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']


class OrderRejectionSerializer(serializers.ModelSerializer):
    """Serializer for OrderRejection model"""
    
    rejected_by_name = serializers.CharField(source='rejected_by.get_full_name', read_only=True)
    
    class Meta:
        model = OrderRejection
        fields = '__all__'
        read_only_fields = ['created_at']


class OrderSerializer(serializers.ModelSerializer):
    """Serializer for Order model"""
    
    student_name = serializers.CharField(read_only=True)
    assigned_doctor_name = serializers.CharField(read_only=True)
    tasks = OrderTaskSerializer(many=True, read_only=True)
    rejections = OrderRejectionSerializer(many=True, read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    days_remaining = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Order
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'approved_at', 'assigned_at', 'completed_at']


class OrderFileSerializer(serializers.ModelSerializer):
    """Serializer for OrderFile model"""
    
    uploaded_by_name = serializers.CharField(source='uploaded_by.get_full_name', read_only=True)
    file_size_mb = serializers.FloatField(read_only=True)
    download_url = serializers.CharField(read_only=True)
    
    class Meta:
        model = OrderFile
        fields = '__all__'
        read_only_fields = ['uploaded_at', 'file_size', 'file_type']


class ProfileDocumentSerializer(serializers.ModelSerializer):
    """Serializer for ProfileDocument model"""
    
    verified_by_name = serializers.CharField(source='verified_by.get_full_name', read_only=True)
    
    class Meta:
        model = ProfileDocument
        fields = '__all__'
        read_only_fields = ['uploaded_at', 'verified_at']


class MessageAttachmentSerializer(serializers.ModelSerializer):
    """Serializer for MessageAttachment model"""
    
    class Meta:
        model = MessageAttachment
        fields = '__all__'
        read_only_fields = ['uploaded_at']


class MessageSerializer(serializers.ModelSerializer):
    """Serializer for Message model"""
    
    sender_name = serializers.CharField(source='sender.get_full_name', read_only=True)
    recipient_name = serializers.CharField(source='recipient.get_full_name', read_only=True)
    attachments = MessageAttachmentSerializer(many=True, read_only=True)
    
    class Meta:
        model = Message
        fields = '__all__'
        read_only_fields = ['created_at', 'read_at']


class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for Notification model"""
    
    class Meta:
        model = Notification
        fields = '__all__'
        read_only_fields = ['created_at', 'read_at']


class ActivityLogSerializer(serializers.ModelSerializer):
    """Serializer for ActivityLog model"""
    
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    
    class Meta:
        model = ActivityLog
        fields = '__all__'
        read_only_fields = ['created_at']


class TransactionSerializer(serializers.ModelSerializer):
    """Serializer for Transaction model"""
    
    payer_name = serializers.CharField(source='payer.get_full_name', read_only=True)
    recipient_name = serializers.CharField(source='recipient.get_full_name', read_only=True)
    
    class Meta:
        model = Transaction
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'completed_at']


class InvoiceSerializer(serializers.ModelSerializer):
    """Serializer for Invoice model"""
    
    order_details = OrderSerializer(source='order', read_only=True)
    
    class Meta:
        model = Invoice
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'invoice_number']


class PaymentScheduleSerializer(serializers.ModelSerializer):
    """Serializer for PaymentSchedule model"""
    
    order_details = OrderSerializer(source='order', read_only=True)
    
    class Meta:
        model = PaymentSchedule
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']


class AccountingEntrySerializer(serializers.ModelSerializer):
    """Serializer for AccountingEntry model"""
    
    class Meta:
        model = AccountingEntry
        fields = '__all__'
        read_only_fields = ['created_at']


class FinancialReportSerializer(serializers.ModelSerializer):
    """Serializer for FinancialReport model"""
    
    generated_by_name = serializers.CharField(source='generated_by.get_full_name', read_only=True)
    
    class Meta:
        model = FinancialReport
        fields = '__all__'
        read_only_fields = ['created_at']


# Dashboard Statistics Serializers
class DashboardStatsSerializer(serializers.Serializer):
    """Serializer for dashboard statistics"""
    
    total_orders = serializers.IntegerField()
    pending_orders = serializers.IntegerField()
    in_progress_orders = serializers.IntegerField()
    completed_orders = serializers.IntegerField()
    total_students = serializers.IntegerField()
    total_agents = serializers.IntegerField()
    total_revenue = serializers.DecimalField(max_digits=12, decimal_places=2)
    pending_payments = serializers.DecimalField(max_digits=12, decimal_places=2)
