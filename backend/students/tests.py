from django.test import TestCase
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from .models import StudentProfile

User = get_user_model()


class StudentProfileAPITestCase(APITestCase):
    """Test cases for Student Profile API"""
    
    def setUp(self):
        """Set up test data"""
        # Create manager user
        self.manager = User.objects.create_user(
            username='manager',
            password='testpass123',
            email='manager@test.com',
            first_name='Manager',
            last_name='User',
            role='manager'
        )
        
        # Create student user
        self.student_user = User.objects.create_user(
            username='student1',
            password='testpass123',
            email='student1@test.com',
            first_name='Student',
            last_name='One',
            role='student'
        )
        
        # Create student profile
        self.student_profile = StudentProfile.objects.create(
            user=self.student_user,
            university='دانشگاه تهران',
            student_id='98123456',
            field='مهندسی کامپیوتر',
            degree='ارشد'
        )
        
        self.client = APIClient()
    
    def test_list_students_as_manager(self):
        """Test listing students as manager"""
        self.client.force_authenticate(user=self.manager)
        response = self.client.get('/api/student-profiles/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
    
    def test_list_students_as_student(self):
        """Test listing students as student (should only see own profile)"""
        self.client.force_authenticate(user=self.student_user)
        response = self.client.get('/api/student-profiles/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['student_id'], '98123456')
    
    def test_create_student(self):
        """Test creating a new student"""
        self.client.force_authenticate(user=self.manager)
        
        data = {
            'username': 'student2',
            'password': 'testpass123',
            'email': 'student2@test.com',
            'first_name': 'Student',
            'last_name': 'Two',
            'university': 'دانشگاه شریف',
            'student_id': '98654321',
            'field': 'فیزیک',
            'degree': 'عاملا'
        }
        
        response = self.client.post('/api/student-profiles/', data)
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(StudentProfile.objects.count(), 2)
    
    def test_update_student_profile(self):
        """Test updating student profile"""
        self.client.force_authenticate(user=self.manager)
        
        data = {
            'university': 'دانشگاه صنعتی شریف',
            'supervisor': 'عامل احمدی'
        }
        
        response = self.client.patch(
            f'/api/student-profiles/{self.student_profile.id}/',
            data
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.student_profile.refresh_from_db()
        self.assertEqual(self.student_profile.university, 'دانشگاه صنعتی شریف')
        self.assertEqual(self.student_profile.supervisor, 'عامل احمدی')
    
    def test_update_status(self):
        """Test updating specific status field"""
        self.client.force_authenticate(user=self.manager)
        
        data = {
            'field': 'committee_status',
            'status': 'تکمیل شده'
        }
        
        response = self.client.post(
            f'/api/student-profiles/{self.student_profile.id}/update_status/',
            data
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.student_profile.refresh_from_db()
        self.assertEqual(self.student_profile.committee_status, 'تکمیل شده')
    
    def test_assign_writer(self):
        """Test assigning writer to student"""
        self.client.force_authenticate(user=self.manager)
        
        data = {
            'writer_name': 'علی محمدی'
        }
        
        response = self.client.post(
            f'/api/student-profiles/{self.student_profile.id}/assign_writer/',
            data
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.student_profile.refresh_from_db()
        self.assertEqual(self.student_profile.assigned_writer, 'علی محمدی')
    
    def test_get_timeline(self):
        """Test getting student timeline"""
        self.client.force_authenticate(user=self.manager)
        
        # Set some statuses
        self.student_profile.committee_status = 'تکمیل شده'
        self.student_profile.irandoc_status = 'در حال انجام'
        self.student_profile.save()
        
        response = self.client.get(
            f'/api/student-profiles/{self.student_profile.id}/timeline/'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('timeline', response.data)
        self.assertIn('overall_progress', response.data)
    
    def test_get_statistics(self):
        """Test getting student statistics"""
        self.client.force_authenticate(user=self.manager)
        
        response = self.client.get('/api/student-profiles/statistics/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('total_students', response.data)
        self.assertIn('by_degree', response.data)
        self.assertIn('avg_completion', response.data)
    
    def test_completion_percentage(self):
        """Test completion percentage calculation"""
        # Empty profile
        self.assertGreater(self.student_profile.completion_percentage, 0)
        
        # Fill more fields
        self.student_profile.supervisor = 'عامل احمدی'
        self.student_profile.interest = 'هوش مصنوعی'
        self.student_profile.committee_status = 'تکمیل شده'
        self.student_profile.save()
        
        self.assertGreater(self.student_profile.completion_percentage, 20)
