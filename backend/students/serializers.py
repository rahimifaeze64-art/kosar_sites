from rest_framework import serializers
from .models import StudentProfile
from django.contrib.auth import get_user_model

User = get_user_model()


class StudentProfileSerializer(serializers.ModelSerializer):
    """Complete serializer for StudentProfile with all fields"""
    
    # User information
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    full_name = serializers.CharField(source='user.get_full_name', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    phone = serializers.CharField(source='user.phone', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    
    # Computed fields
    completion_percentage = serializers.IntegerField(read_only=True)
    
    # Display values for choices
    degree_display = serializers.CharField(source='get_degree_display', read_only=True)
    committee_status_display = serializers.CharField(source='get_committee_status_display', read_only=True)
    irandoc_status_display = serializers.CharField(source='get_irandoc_status_display', read_only=True)
    admin_status_display = serializers.CharField(source='get_admin_status_display', read_only=True)
    typing_status_display = serializers.CharField(source='get_typing_status_display', read_only=True)
    summary_status_display = serializers.CharField(source='get_summary_status_display', read_only=True)
    peer_review_status_display = serializers.CharField(source='get_peer_review_status_display', read_only=True)
    article1_status_display = serializers.CharField(source='get_article1_status_display', read_only=True)
    article2_status_display = serializers.CharField(source='get_article2_status_display', read_only=True)
    
    class Meta:
        model = StudentProfile
        fields = [
            'id', 'user', 'user_id', 'full_name', 'email', 'phone', 'username',
            'university', 'student_id', 'system_password', 'field', 'degree', 'degree_display',
            'interest', 'order_type', 
            'committee_status', 'committee_status_display',
            'irandoc_status', 'irandoc_status_display',
            'supervisor', 'assigned_writer', 'delivery_date',
            'admin_status', 'admin_status_display',
            'typing_status', 'typing_status_display',
            'summary_status', 'summary_status_display',
            'peer_review_status', 'peer_review_status_display',
            'article1_status', 'article1_status_display',
            'article2_status', 'article2_status_display',
            'completion_percentage', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']


class StudentProfileCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating student profiles"""
    
    # User fields for creation
    username = serializers.CharField(write_only=True)
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    email = serializers.EmailField(write_only=True)
    first_name = serializers.CharField(write_only=True)
    last_name = serializers.CharField(write_only=True)
    phone = serializers.CharField(write_only=True, required=False, allow_blank=True)
    
    class Meta:
        model = StudentProfile
        fields = [
            'username', 'password', 'email', 'first_name', 'last_name', 'phone',
            'university', 'student_id', 'system_password', 'field', 'degree',
            'interest', 'order_type', 'supervisor', 'assigned_writer', 'delivery_date'
        ]
    
    def validate_username(self, value):
        """Check if username already exists"""
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('این نام کاربری قبلاً استفاده شده است')
        return value
    
    def validate_email(self, value):
        """Check if email already exists"""
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError('این ایمیل قبلاً استفاده شده است')
        return value
    
    def validate_student_id(self, value):
        """Check if student ID already exists"""
        if value and StudentProfile.objects.filter(student_id=value).exists():
            raise serializers.ValidationError('این شماره دانشجویی قبلاً استفاده شده است')
        return value
    
    def create(self, validated_data):
        """Create user and student profile together"""
        # Extract user data
        user_data = {
            'username': validated_data.pop('username'),
            'email': validated_data.pop('email'),
            'first_name': validated_data.pop('first_name'),
            'last_name': validated_data.pop('last_name'),
            'phone': validated_data.pop('phone', ''),
            'role': 'student',
            'active': True
        }
        password = validated_data.pop('password')
        
        # Create user
        user = User.objects.create(**user_data)
        user.set_password(password)
        user.save()
        
        # Create student profile
        profile = StudentProfile.objects.create(user=user, **validated_data)
        
        return profile


class StudentProfileUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating student profiles"""
    
    class Meta:
        model = StudentProfile
        fields = [
            'university', 'student_id', 'system_password', 'field', 'degree',
            'interest', 'order_type', 
            'committee_status', 'irandoc_status',
            'supervisor', 'assigned_writer', 'delivery_date',
            'admin_status', 'typing_status', 'summary_status', 
            'peer_review_status', 'article1_status', 'article2_status'
        ]
    
    def validate_student_id(self, value):
        """Check if student ID already exists (excluding current instance)"""
        if value:
            existing = StudentProfile.objects.filter(student_id=value).exclude(id=self.instance.id)
            if existing.exists():
                raise serializers.ValidationError('این شماره دانشجویی قبلاً استفاده شده است')
        return value


class StudentListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for student lists"""
    
    full_name = serializers.CharField(source='user.get_full_name', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    completion_percentage = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = StudentProfile
        fields = [
            'id', 'full_name', 'email', 'university', 'student_id', 
            'field', 'degree', 'supervisor', 'assigned_writer',
            'completion_percentage', 'created_at'
        ]


class StudentStatisticsSerializer(serializers.Serializer):
    """Serializer for student statistics"""
    
    total_students = serializers.IntegerField()
    active_students = serializers.IntegerField()
    by_degree = serializers.DictField()
    by_university = serializers.DictField()
    avg_completion = serializers.FloatField()
    recent_registrations = serializers.IntegerField()


class StudentTimelineSerializer(serializers.Serializer):
    """Serializer for student timeline/progress"""
    
    student_id = serializers.IntegerField()
    full_name = serializers.CharField()
    timeline = serializers.ListField()
    overall_progress = serializers.IntegerField()
