// Force Update Students to 20
// این اسکریپت localStorage را با 20 دانشجوی جدید به‌روز می‌کند

function forceUpdateStudentsTo20() {
    console.log('🔄 Force updating students to 20...');
    
    try {
        // Get current users from localStorage
        let users = [];
        const storedUsers = localStorage.getItem(CONFIG.STORAGE_KEYS.USERS);
        
        if (storedUsers) {
            users = JSON.parse(storedUsers);
            console.log(`📊 Found ${users.length} users in localStorage`);
            
            // Remove all old students
            const oldStudentCount = users.filter(u => u.role === 'student').length;
            users = users.filter(u => u.role !== 'student');
            console.log(`🗑️ Removed ${oldStudentCount} old students`);
        } else {
            console.log('📝 localStorage is empty, creating new data...');
        }
        
        // Get all default users (includes 20 students)
        const allDefaultUsers = DataModule.getDefaultUsers();
        const newStudents = allDefaultUsers.filter(u => u.role === 'student');
        
        console.log(`✅ Adding ${newStudents.length} new students`);
        
        // Merge non-student users with new students
        users = users.concat(newStudents);
        
        // Save to localStorage
        localStorage.setItem(CONFIG.STORAGE_KEYS.USERS, JSON.stringify(users));
        
        console.log(`✅ Success! Total users: ${users.length}`);
        console.log(`📊 Students: ${newStudents.length}`);
        
        // Now initialize students data with workflows
        console.log('🔄 Initializing students with educational steps...');
        
        // Get existing students data
        const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
        
        // Define specific progress for each student (manually set)
        const studentProgress = [
            { id: 'std001', eduSteps: 1, defSteps: 0 },   // قاسم - محضر و اصالت
            { id: 'std002', eduSteps: 3, defSteps: 1 },   // حسن - تعدیل + لوح
            { id: 'std003', eduSteps: 5, defSteps: 0 },   // علی - ایرانداک رساله
            { id: 'std004', eduSteps: 7, defSteps: 2 },   // زینب - حاتمی + نسخ
            { id: 'std005', eduSteps: 10, defSteps: 3 },  // محمد جواد - ترجمه به اسماعیلی + ثبت عنوان
            { id: 'std006', eduSteps: 12, defSteps: 4 },  // زینب حسین - ارسال کد به تهران + بارگزاری
            { id: 'std007', eduSteps: 2, defSteps: 0 },   // احمد - تنزیل نمره
            { id: 'std008', eduSteps: 15, defSteps: 5 },  // مریم - تصدیق + استاد
            { id: 'std009', eduSteps: 17, defSteps: 7 },  // حسین علی - استلال + مدیر گروه
            { id: 'std010', eduSteps: 4, defSteps: 0 },   // سارا - ایرانداک خطه
            { id: 'std011', eduSteps: 8, defSteps: 2 },   // عمر - بارگزاری لغت + نسخ
            { id: 'std012', eduSteps: 18, defSteps: 8 },  // نور الهدی - تجلید + معاون
            { id: 'std013', eduSteps: 6, defSteps: 1 },   // یوسف - مدرک لغت + پوستر
            { id: 'std014', eduSteps: 11, defSteps: 3 },  // هدی - دادگر + ثبت عنوان
            { id: 'std015', eduSteps: 20, defSteps: 9 },  // کریم - قطعی + زمان پور
            { id: 'std016', eduSteps: 9, defSteps: 2 },   // رقیه - آزفا + نسخ
            { id: 'std017', eduSteps: 13, defSteps: 4 },  // طارق - وثیقه + بارگزاری
            { id: 'std018', eduSteps: 16, defSteps: 6 },  // سمیه - تنضید + احمدلو
            { id: 'std019', eduSteps: 14, defSteps: 5 },  // بلال - تصدیق + استاد
            { id: 'std020', eduSteps: 19, defSteps: 8 }   // لیلی - ختم تجلید + معاون
        ];
        
        // Initialize each student with specific progress
        newStudents.forEach((student, index) => {
            const progress = studentProgress.find(p => p.id === student.id) || { eduSteps: 0, defSteps: 0 };
            
            const educationalSteps = EmployeeModule.getDefaultEducationalSteps();
            const defenseSteps = EmployeeModule.getDefaultDefenseSteps2();
            
            // Mark completed steps for educational
            for (let i = 0; i < progress.eduSteps && i < educationalSteps.length; i++) {
                educationalSteps[i].completed = true;
                educationalSteps[i].date = new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            }
            
            // Mark completed steps for defense
            for (let i = 0; i < progress.defSteps && i < defenseSteps.length; i++) {
                defenseSteps[i].completed = true;
                defenseSteps[i].date = new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            }
            
            studentsData[student.id] = {
                ...student,
                educationalSteps: educationalSteps,
                defenseSteps: defenseSteps,
                graduationWorkflow: EmployeeModule.getDefaultGraduationSteps(),
                defenseWorkflow: [],
                createdAt: student.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            const eduCurrent = educationalSteps.find(s => !s.completed);
            const defCurrent = defenseSteps.find(s => !s.completed);
            console.log(`✅ ${index + 1}. ${student.name}: تحصیلی=${eduCurrent ? eduCurrent.name : 'تکمیل'}, دفاع=${defCurrent ? defCurrent.name : 'تکمیل'}`);
        });
        
        // Save students data
        localStorage.setItem('students_data', JSON.stringify(studentsData));
        console.log(`✅ Saved ${newStudents.length} students with educational steps`);
        
        // Show success message
        if (typeof ModalsModule !== 'undefined') {
            ModalsModule.showSuccessModal(
                'به‌روزرسانی موفق',
                `${newStudents.length} دانشجو با موفقیت به سیستم اضافه شدند. صفحه به‌روز می‌شود...`
            );
        }
        
        // Refresh page after 2 seconds
        setTimeout(() => {
            location.reload();
        }, 2000);
        
        return true;
    } catch (error) {
        console.error('❌ Error updating students:', error);
        
        if (typeof ModalsModule !== 'undefined') {
            ModalsModule.showErrorModal(
                'خطا در به‌روزرسانی',
                `خطا: ${error.message}`
            );
        }
        
        return false;
    }
}

// Expose function globally
window.forceUpdateStudentsTo20 = forceUpdateStudentsTo20;
