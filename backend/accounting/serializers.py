from rest_framework import serializers
from .models import Transaction, Invoice, PaymentSchedule, AccountingEntry, FinancialReport
from django.contrib.auth import get_user_model

User = get_user_model()


class TransactionSerializer(serializers.ModelSerializer):
    """Serializer for Transaction model"""
    
    payer_name = serializers.CharField(source='payer.get_full_name', read_only=True)
    recipient_name = serializers.CharField(source='recipient.get_full_name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    order_details = serializers.SerializerMethodField()
    
    class Meta:
        model = Transaction
        fields = [
            'id', 'transaction_type', 'amount', 'currency', 'order', 'order_details',
            'payer', 'payer_name', 'recipient', 'recipient_name',
            'payment_method', 'reference_number', 'description', 'status',
            'created_by', 'created_by_name', 'created_at', 'updated_at', 'completed_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'completed_at', 'created_by']
    
    def get_order_details(self, obj):
        if obj.order:
            return {
                'id': obj.order.id,
                'type': obj.order.type,
                'student_name': obj.order.student.get_full_name() if obj.order.student else None
            }
        return None


class AccountingEntrySerializer(serializers.ModelSerializer):
    """Serializer for AccountingEntry model"""
    
    class Meta:
        model = AccountingEntry
        fields = '__all__'
        read_only_fields = ['id', 'created_at']


class InvoiceSerializer(serializers.ModelSerializer):
    """Serializer for Invoice model"""
    
    order_details = serializers.SerializerMethodField()
    student_name = serializers.SerializerMethodField()
    days_until_due = serializers.SerializerMethodField()
    
    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_number', 'order', 'order_details', 'student_name',
            'subtotal', 'tax', 'discount', 'total', 'status',
            'issue_date', 'due_date', 'paid_date', 'days_until_due',
            'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'invoice_number', 'created_at', 'updated_at']
    
    def get_order_details(self, obj):
        return {
            'id': obj.order.id,
            'type': obj.order.type,
            'total_amount': float(obj.order.total_amount)
        }
    
    def get_student_name(self, obj):
        return obj.order.student.get_full_name() if obj.order.student else None
    
    def get_days_until_due(self, obj):
        from django.utils import timezone
        if obj.status in ['paid', 'cancelled']:
            return None
        today = timezone.now().date()
        delta = (obj.due_date - today).days
        return delta


class PaymentScheduleSerializer(serializers.ModelSerializer):
    """Serializer for PaymentSchedule model"""
    
    order_details = serializers.SerializerMethodField()
    student_name = serializers.SerializerMethodField()
    transaction_details = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    
    class Meta:
        model = PaymentSchedule
        fields = [
            'id', 'order', 'order_details', 'student_name',
            'installment_number', 'amount', 'due_date', 'status',
            'transaction', 'transaction_details', 'paid_date', 'notes',
            'is_overdue', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_order_details(self, obj):
        return {
            'id': obj.order.id,
            'type': obj.order.type
        }
    
    def get_student_name(self, obj):
        return obj.order.student.get_full_name() if obj.order.student else None
    
    def get_transaction_details(self, obj):
        if obj.transaction:
            return {
                'id': obj.transaction.id,
                'amount': float(obj.transaction.amount),
                'status': obj.transaction.status,
                'payment_method': obj.transaction.payment_method
            }
        return None
    
    def get_is_overdue(self, obj):
        from django.utils import timezone
        if obj.status == 'paid':
            return False
        return obj.due_date < timezone.now().date()


class FinancialReportSerializer(serializers.ModelSerializer):
    """Serializer for FinancialReport model"""
    
    generated_by_name = serializers.CharField(source='generated_by.get_full_name', read_only=True)
    report_type_display = serializers.CharField(source='get_report_type_display', read_only=True)
    
    class Meta:
        model = FinancialReport
        fields = [
            'id', 'report_type', 'report_type_display', 'title',
            'start_date', 'end_date', 'data', 'file',
            'generated_by', 'generated_by_name', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'generated_by']


class TransactionCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating transactions"""
    
    class Meta:
        model = Transaction
        fields = [
            'transaction_type', 'amount', 'currency', 'order',
            'payer', 'recipient', 'payment_method', 'reference_number',
            'description', 'status'
        ]
    
    def validate(self, data):
        """Validate transaction data"""
        if data['amount'] <= 0:
            raise serializers.ValidationError({'amount': 'مبلغ باید بیشتر از صفر باشد'})
        
        if data['transaction_type'] in ['payment', 'income'] and not data.get('payer'):
            raise serializers.ValidationError({'payer': 'پرداخت‌کننده الزامی است'})
        
        if data['transaction_type'] == 'expense' and not data.get('recipient'):
            raise serializers.ValidationError({'recipient': 'دریافت‌کننده الزامی است'})
        
        return data


class InvoiceCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating invoices"""
    
    class Meta:
        model = Invoice
        fields = [
            'order', 'subtotal', 'tax', 'discount',
            'issue_date', 'due_date', 'notes'
        ]
    
    def validate(self, data):
        """Validate invoice data"""
        if data['subtotal'] <= 0:
            raise serializers.ValidationError({'subtotal': 'مبلغ باید بیشتر از صفر باشد'})
        
        if data['due_date'] < data['issue_date']:
            raise serializers.ValidationError({'due_date': 'تاریخ سررسید نمی‌تواند قبل از تاریخ صدور باشد'})
        
        return data
