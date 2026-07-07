// Initialize Students Data in localStorage
// این اسکریپت همه دانشجویان را با مراحل تحصیلی و دفاع پیش‌فرض مقداردهی می‌کند

function initializeStudentsData() {
    console.log('🔄 Initializing students data...');
    
    // First, ensure all users are saved to localStorage
    let users = DataModule.getUsers();
    if (!localStorage.getItem(CONFIG.STORAGE_KEYS.USERS)) {
        console.log('📝 Saving default users to localStorage...');
        DataModule.saveUsers(users);
    }
    
    // Get all students from DataModule
    const students = users.filter(u => u.role === 'student');
    
    if (!students || students.length === 0) {
        console.warn('⚠️ No students found in DataModule');
        return;
    }
    
    console.log(`📊 Found ${students.length} students`);
    
    // Get existing students data from localStorage
    const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
    
    // Initialize each student with default steps if not already initialized
    students.forEach((student, index) => {
        if (!studentsData[student.id]) {
            // Create new student data with default steps
            studentsData[student.id] = {
                ...student,
                educationalSteps: EmployeeModule.getDefaultEducationalSteps(),
                defenseSteps: EmployeeModule.getDefaultDefenseSteps2(),
                graduationWorkflow: EmployeeModule.getDefaultGraduationSteps(),
                defenseWorkflow: [],
                createdAt: student.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            console.log(`✅ Initialized student ${index + 1}: ${student.name}`);
        } else {
            // Update existing student data if missing steps
            let updated = false;
            
            if (!studentsData[student.id].educationalSteps) {
                studentsData[student.id].educationalSteps = EmployeeModule.getDefaultEducationalSteps();
                updated = true;
            }
            
            if (!studentsData[student.id].defenseSteps) {
                studentsData[student.id].defenseSteps = EmployeeModule.getDefaultDefenseSteps2();
                updated = true;
            }
            
            if (!studentsData[student.id].graduationWorkflow) {
                studentsData[student.id].graduationWorkflow = EmployeeModule.getDefaultGraduationSteps();
                updated = true;
            }
            
            if (updated) {
                studentsData[student.id].updatedAt = new Date().toISOString();
                console.log(`🔄 Updated student ${index + 1}: ${student.name}`);
            } else {
                console.log(`✓ Student ${index + 1} already initialized: ${student.name}`);
            }
        }
    });
    
    // Save to localStorage
    localStorage.setItem('students_data', JSON.stringify(studentsData));
    
    console.log(`✅ Successfully initialized ${students.length} students`);
    console.log('📊 Students data saved to localStorage');
    
    return studentsData;
}

// Auto-initialize on page load if needed
document.addEventListener('DOMContentLoaded', function() {
    // Small delay to ensure all modules are loaded
    setTimeout(() => {
        try {
            // Ensure users are in localStorage
            if (!localStorage.getItem(CONFIG.STORAGE_KEYS.USERS)) {
                console.log('🚀 Initializing users in localStorage...');
                const users = DataModule.getDefaultUsers();
                DataModule.saveUsers(users);
            }
            
            // Check if we need to initialize students data
            const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
            const students = DataModule.getUsers().filter(u => u.role === 'student');
            
            console.log(`📊 Found ${students.length} students in DataModule`);
            console.log(`📊 Found ${Object.keys(studentsData).length} students in localStorage`);
            
            // Initialize if no data exists or if number of students doesn't match
            if (Object.keys(studentsData).length !== students.length) {
                console.log('🚀 Auto-initializing students data...');
                initializeStudentsData();
            } else {
                console.log('✓ Students data already initialized');
            }
        } catch (error) {
            console.error('❌ Error during initialization:', error);
        }
    }, 500);
});

// Expose function globally for manual initialization
window.initializeStudentsData = initializeStudentsData;
