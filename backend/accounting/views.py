from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Sum, Count, Avg
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal

from .models import Transaction, Invoice, PaymentSchedule, AccountingEntry, FinancialReport
from .serializers import (
    TransactionSerializer, InvoiceSerializer, PaymentScheduleSerializer,
    AccountingEntrySerializer, FinancialReportSerializer,
    TransactionCreateSerializer, InvoiceCreateSerializer
)
from orders.models import Order
from django.contrib.auth import get_user_model

User = get_user_model()


class TransactionViewSet(viewsets.ModelViewSet):
    """ViewSet for Transaction model with complete CRUD operations"""
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter transactions based on role and query params"""
        user = self.request.user
        queryset = Transaction.objects.select_related('payer', 'recipient', 'order', 'created_by')
        
        # Filter by role
        if user.is_manager:
            pass  # Can see all
        elif user.is_agent:
            queryset = queryset.filter(Q(payer=user) | Q(recipient=user))
        elif user.is_student:
            queryset = queryset.filter(payer=user)
        else:
            return Transaction.objects.none()
        
        # Additional filters from query params
        transaction_type = self.request.query_params.get('type')
        status_filter = self.request.query_params.get('status')
        order_id = self.request.query_params.get('order_id')
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if transaction_type:
            queryset = queryset.filter(transaction_type=transaction_type)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if order_id:
            queryset = queryset.filter(order_id=order_id)
        if start_date:
            queryset = queryset.filter(created_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__lte=end_date)
        
        return queryset.order_by('-created_at')
    
    def get_serializer_class(self):
        if self.action == 'create':
            return TransactionCreateSerializer
        return TransactionSerializer
    
    def perform_create(self, serializer):
        """Create transaction with automatic accounting entries"""
        transaction = serializer.save(created_by=self.request.user)
        
        # Create double-entry accounting records
        self._create_accounting_entries(transaction)
    
    def _create_accounting_entries(self, transaction):
        """Create double-entry accounting entries for transaction"""
        if transaction.transaction_type == 'income':
            # Debit: Cash/Bank, Credit: Revenue
            AccountingEntry.objects.create(
                transaction=transaction,
                account_name='نقدی/بانک',
                entry_type='debit',
                amount=transaction.amount,
                description=f'دریافت درآمد - {transaction.description}'
            )
            AccountingEntry.objects.create(
                transaction=transaction,
                account_name='درآمد',
                entry_type='credit',
                amount=transaction.amount,
                description=f'درآمد - {transaction.description}'
            )
        
        elif transaction.transaction_type == 'expense':
            # Debit: Expense, Credit: Cash/Bank
            AccountingEntry.objects.create(
                transaction=transaction,
                account_name='هزینه',
                entry_type='debit',
                amount=transaction.amount,
                description=f'هزینه - {transaction.description}'
            )
            AccountingEntry.objects.create(
                transaction=transaction,
                account_name='نقدی/بانک',
                entry_type='credit',
                amount=transaction.amount,
                description=f'پرداخت هزینه - {transaction.description}'
            )
        
        elif transaction.transaction_type == 'payment':
            # Debit: Accounts Receivable, Credit: Cash/Bank
            AccountingEntry.objects.create(
                transaction=transaction,
                account_name='حساب‌های دریافتنی',
                entry_type='debit',
                amount=transaction.amount,
                description=f'پرداخت - {transaction.description}'
            )
            AccountingEntry.objects.create(
                transaction=transaction,
                account_name='نقدی/بانک',
                entry_type='credit',
                amount=transaction.amount,
                description=f'پرداخت نقدی - {transaction.description}'
            )
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark transaction as completed"""
        transaction = self.get_object()
        
        if transaction.status == 'completed':
            return Response(
                {'error': 'تراکنش قبلاً تکمیل شده است'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        transaction.status = 'completed'
        transaction.completed_at = timezone.now()
        transaction.save()
        
        return Response(self.get_serializer(transaction).data)
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel transaction"""
        transaction = self.get_object()
        
        if transaction.status == 'completed':
            return Response(
                {'error': 'نمی‌توان تراکنش تکمیل شده را لغو کرد'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        transaction.status = 'cancelled'
        transaction.save()
        
        return Response(self.get_serializer(transaction).data)
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get transaction summary statistics"""
        queryset = self.get_queryset()
        
        summary = {
            'total_income': queryset.filter(
                transaction_type='income',
                status='completed'
            ).aggregate(Sum('amount'))['amount__sum'] or 0,
            
            'total_expense': queryset.filter(
                transaction_type='expense',
                status='completed'
            ).aggregate(Sum('amount'))['amount__sum'] or 0,
            
            'total_payments': queryset.filter(
                transaction_type='payment',
                status='completed'
            ).aggregate(Sum('amount'))['amount__sum'] or 0,
            
            'pending_amount': queryset.filter(
                status='pending'
            ).aggregate(Sum('amount'))['amount__sum'] or 0,
            
            'transaction_count': queryset.count(),
        }
        
        summary['net_income'] = summary['total_income'] - summary['total_expense']
        
        return Response(summary)


class InvoiceViewSet(viewsets.ModelViewSet):
    """ViewSet for Invoice model"""
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter invoices based on role"""
        user = self.request.user
        queryset = Invoice.objects.select_related('order', 'order__student')
        
        if user.is_manager or user.is_employee:
            pass  # Can see all
        elif user.is_student:
            queryset = queryset.filter(order__student=user)
        else:
            return Invoice.objects.none()
        
        # Additional filters
        status_filter = self.request.query_params.get('status')
        order_id = self.request.query_params.get('order_id')
        
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if order_id:
            queryset = queryset.filter(order_id=order_id)
        
        return queryset.order_by('-created_at')
    
    def get_serializer_class(self):
        if self.action == 'create':
            return InvoiceCreateSerializer
        return InvoiceSerializer
    
    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        """Mark invoice as paid"""
        invoice = self.get_object()
        
        if invoice.status == 'paid':
            return Response(
                {'error': 'فاکتور قبلاً پرداخت شده است'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        invoice.status = 'paid'
        invoice.paid_date = timezone.now().date()
        invoice.save()
        
        # Create transaction record
        Transaction.objects.create(
            transaction_type='income',
            amount=invoice.total,
            currency='USD',
            order=invoice.order,
            payer=invoice.order.student,
            payment_method='bank_transfer',
            description=f'پرداخت فاکتور {invoice.invoice_number}',
            status='completed',
            completed_at=timezone.now(),
            created_by=request.user
        )
        
        return Response(self.get_serializer(invoice).data)
    
    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        """Send invoice to student"""
        invoice = self.get_object()
        
        if invoice.status == 'draft':
            invoice.status = 'sent'
            invoice.save()
        
        return Response(self.get_serializer(invoice).data)
    
    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """Get overdue invoices"""
        today = timezone.now().date()
        overdue_invoices = self.get_queryset().filter(
            due_date__lt=today,
            status__in=['sent', 'overdue']
        )
        
        # Update status to overdue
        overdue_invoices.update(status='overdue')
        
        serializer = self.get_serializer(overdue_invoices, many=True)
        return Response(serializer.data)


class PaymentScheduleViewSet(viewsets.ModelViewSet):
    """ViewSet for PaymentSchedule model"""
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter payment schedules based on role"""
        user = self.request.user
        queryset = PaymentSchedule.objects.select_related('order', 'transaction')
        
        if user.is_manager or user.is_employee:
            pass  # Can see all
        elif user.is_student:
            queryset = queryset.filter(order__student=user)
        else:
            return PaymentSchedule.objects.none()
        
        # Additional filters
        order_id = self.request.query_params.get('order_id')
        status_filter = self.request.query_params.get('status')
        
        if order_id:
            queryset = queryset.filter(order_id=order_id)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        return queryset.order_by('order', 'installment_number')
    
    def get_serializer_class(self):
        return PaymentScheduleSerializer
    
    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        """Mark payment schedule as paid"""
        schedule = self.get_object()
        
        if schedule.status == 'paid':
            return Response(
                {'error': 'این قسط قبلاً پرداخت شده است'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create transaction
        transaction = Transaction.objects.create(
            transaction_type='payment',
            amount=schedule.amount,
            currency='USD',
            order=schedule.order,
            payer=schedule.order.student,
            payment_method=request.data.get('payment_method', 'bank_transfer'),
            reference_number=request.data.get('reference_number', ''),
            description=f'پرداخت قسط {schedule.installment_number} - سفارش {schedule.order.id}',
            status='completed',
            completed_at=timezone.now(),
            created_by=request.user
        )
        
        schedule.status = 'paid'
        schedule.paid_date = timezone.now().date()
        schedule.transaction = transaction
        schedule.save()
        
        return Response(self.get_serializer(schedule).data)
    
    @action(detail=False, methods=['post'])
    def create_schedule(self, request):
        """Create payment schedule for an order"""
        order_id = request.data.get('order_id')
        installments = request.data.get('installments', [])
        
        try:
            order = Order.objects.get(id=order_id)
        except Order.DoesNotExist:
            return Response(
                {'error': 'سفارش یافت نشد'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Delete existing schedules
        PaymentSchedule.objects.filter(order=order).delete()
        
        # Create new schedules
        created_schedules = []
        for idx, installment in enumerate(installments, 1):
            schedule = PaymentSchedule.objects.create(
                order=order,
                installment_number=idx,
                amount=Decimal(str(installment['amount'])),
                due_date=installment['due_date'],
                notes=installment.get('notes', '')
            )
            created_schedules.append(schedule)
        
        serializer = self.get_serializer(created_schedules, many=True)
        return Response(serializer.data)


class FinancialReportViewSet(viewsets.ModelViewSet):
    """ViewSet for FinancialReport model"""
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Only managers can view financial reports"""
        if self.request.user.is_manager:
            return FinancialReport.objects.all().order_by('-created_at')
        return FinancialReport.objects.none()
    
    def get_serializer_class(self):
        return FinancialReportSerializer
    
    @action(detail=False, methods=['post'])
    def generate_income_statement(self, request):
        """Generate income statement report"""
        start_date = request.data.get('start_date')
        end_date = request.data.get('end_date')
        
        if not start_date or not end_date:
            return Response(
                {'error': 'تاریخ شروع و پایان الزامی است'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Calculate income
        income = Transaction.objects.filter(
            transaction_type='income',
            status='completed',
            created_at__gte=start_date,
            created_at__lte=end_date
        ).aggregate(Sum('amount'))['amount__sum'] or 0
        
        # Calculate expenses
        expenses = Transaction.objects.filter(
            transaction_type='expense',
            status='completed',
            created_at__gte=start_date,
            created_at__lte=end_date
        ).aggregate(Sum('amount'))['amount__sum'] or 0
        
        net_income = income - expenses
        
        report_data = {
            'income': float(income),
            'expenses': float(expenses),
            'net_income': float(net_income),
            'income_breakdown': self._get_income_breakdown(start_date, end_date),
            'expense_breakdown': self._get_expense_breakdown(start_date, end_date)
        }
        
        report = FinancialReport.objects.create(
            report_type='income_statement',
            title=f'صورت سود و زیان ({start_date} تا {end_date})',
            start_date=start_date,
            end_date=end_date,
            data=report_data,
            generated_by=request.user
        )
        
        return Response(self.get_serializer(report).data)
    
    @action(detail=False, methods=['post'])
    def generate_cash_flow(self, request):
        """Generate cash flow report"""
        start_date = request.data.get('start_date')
        end_date = request.data.get('end_date')
        
        if not start_date or not end_date:
            return Response(
                {'error': 'تاریخ شروع و پایان الزامی است'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        transactions = Transaction.objects.filter(
            status='completed',
            created_at__gte=start_date,
            created_at__lte=end_date
        ).order_by('created_at')
        
        cash_flow_data = []
        running_balance = 0
        
        for trans in transactions:
            if trans.transaction_type in ['income', 'payment']:
                running_balance += float(trans.amount)
                flow_type = 'inflow'
            else:
                running_balance -= float(trans.amount)
                flow_type = 'outflow'
            
            cash_flow_data.append({
                'date': trans.created_at.isoformat(),
                'type': trans.transaction_type,
                'amount': float(trans.amount),
                'flow_type': flow_type,
                'balance': running_balance,
                'description': trans.description
            })
        
        report_data = {
            'cash_flows': cash_flow_data,
            'starting_balance': 0,
            'ending_balance': running_balance,
            'total_inflow': sum(cf['amount'] for cf in cash_flow_data if cf['flow_type'] == 'inflow'),
            'total_outflow': sum(cf['amount'] for cf in cash_flow_data if cf['flow_type'] == 'outflow')
        }
        
        report = FinancialReport.objects.create(
            report_type='cash_flow',
            title=f'گزارش جریان نقدی ({start_date} تا {end_date})',
            start_date=start_date,
            end_date=end_date,
            data=report_data,
            generated_by=request.user
        )
        
        return Response(self.get_serializer(report).data)
    
    @action(detail=False, methods=['post'])
    def generate_agent_payments(self, request):
        """Generate agent payments report"""
        start_date = request.data.get('start_date')
        end_date = request.data.get('end_date')
        
        agents = User.objects.filter(role='agent')
        agent_data = []
        
        for agent in agents:
            payments = Transaction.objects.filter(
                recipient=agent,
                status='completed',
                created_at__gte=start_date,
                created_at__lte=end_date
            ).aggregate(
                total=Sum('amount'),
                count=Count('id')
            )
            
            agent_data.append({
                'agent_id': agent.id,
                'agent_name': agent.get_full_name(),
                'total_payments': float(payments['total'] or 0),
                'payment_count': payments['count']
            })
        
        report_data = {
            'agents': agent_data,
            'total_paid': sum(a['total_payments'] for a in agent_data)
        }
        
        report = FinancialReport.objects.create(
            report_type='agent_payments',
            title=f'گزارش پرداخت‌های عامل‌ها ({start_date} تا {end_date})',
            start_date=start_date,
            end_date=end_date,
            data=report_data,
            generated_by=request.user
        )
        
        return Response(self.get_serializer(report).data)
    
    def _get_income_breakdown(self, start_date, end_date):
        """Get income breakdown by payment method"""
        breakdown = Transaction.objects.filter(
            transaction_type='income',
            status='completed',
            created_at__gte=start_date,
            created_at__lte=end_date
        ).values('payment_method').annotate(
            total=Sum('amount'),
            count=Count('id')
        )
        
        return [
            {
                'method': item['payment_method'],
                'total': float(item['total']),
                'count': item['count']
            }
            for item in breakdown
        ]
    
    def _get_expense_breakdown(self, start_date, end_date):
        """Get expense breakdown by payment method"""
        breakdown = Transaction.objects.filter(
            transaction_type='expense',
            status='completed',
            created_at__gte=start_date,
            created_at__lte=end_date
        ).values('payment_method').annotate(
            total=Sum('amount'),
            count=Count('id')
        )
        
        return [
            {
                'method': item['payment_method'],
                'total': float(item['total']),
                'count': item['count']
            }
            for item in breakdown
        ]
