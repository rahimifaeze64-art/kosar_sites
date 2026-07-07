// Randomize Student Progress
// این اسکریپت هر دانشجو را در یک مرحله رندوم قرار می‌دهد

function randomizeStudentProgress() {
    console.log('🎲 Randomizing student progress...');
    
    try {
        // Get students from localStorage
        const storedUsers = localStorage.getItem(CONFIG.STORAGE_KEYS.USERS);
        if (!storedUsers) {
            console.error('❌ No users in localStorage');
            return false;
        }
        
        const users = JSON.parse(storedUsers);
        const students = users.filter(u => u.role === 'student');
        
        console.log(`📊 Found ${students.length} students`);
        
        // Get or create students_data
        const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
        
        // Randomize each student
        students.forEach((student, index) => {
            // Get default steps
            const educationalSteps = EmployeeModule.getDefaultEducationalSteps();
            const defenseSteps = EmployeeModule.getDefaultDefenseSteps2();
            
            // Random progress for educational steps (0% to 90%)
            const educationalProgress = Math.floor(Math.random() * 20); // 0-19 steps completed
            for (let i = 0; i < educationalProgress && i < educationalSteps.length; i++) {
                educationalSteps[i].completed = true;
                educationalSteps[i].date = getRandomPastDate();
            }
            
            // Random progress for defense steps (0% to 80%)
            const defenseProgress = Math.floor(Math.random() * 9); // 0-8 steps completed
            for (let i = 0; i < defenseProgress && i < defenseSteps.length; i++) {
                defenseSteps[i].completed = true;
                defenseSteps[i].date = getRandomPastDate();
            }
            
            // Update student data
            studentsData[student.id] = {
                ...student,
                educationalSteps: educationalSteps,
                defenseSteps: defenseSteps,
                graduationWorkflow: EmployeeModule.getDefaultGraduationSteps(),
                defenseWorkflow: [],
                createdAt: student.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            // Log progress
            const eduCurrentStep = educationalSteps.find(s => !s.completed);
            const defCurrentStep = defenseSteps.find(s => !s.completed);
            
            console.log(`${index + 1}. ${student.name}:`);
            console.log(`   📚 مراحل تحصیلی: ${educationalProgress}/${educationalSteps.length} - فعلی: ${eduCurrentStep ? eduCurrentStep.name : 'تکمیل شده'}`);
            console.log(`   🛡️ گردش دفاع: ${defenseProgress}/${defenseSteps.length} - فعلی: ${defCurrentStep ? defCurrentStep.name : 'تکمیل شده'}`);
        });
        
        // Save to localStorage
        localStorage.setItem('students_data', JSON.stringify(studentsData));
        
        console.log('✅ Student progress randomized successfully!');
        console.log('💡 Refresh the page to see changes');
        
        return true;
        
    } catch (error) {
        console.error('❌ Error randomizing student progress:', error);
        return false;
    }
}

// Helper function to get random past date
function getRandomPastDate() {
    const now = new Date();
    const daysAgo = Math.floor(Math.random() * 180); // 0-180 days ago
    const date = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
    return date.toISOString().split('T')[0];
}

// Function to set specific progress for a student
function setStudentProgress(studentId, educationalStepIndex, defenseStepIndex) {
    try {
        const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
        const student = studentsData[studentId];
        
        if (!student) {
            console.error(`❌ Student ${studentId} not found`);
            return false;
        }
        
        // Complete educational steps up to index
        if (student.educationalSteps) {
            for (let i = 0; i < educationalStepIndex && i < student.educationalSteps.length; i++) {
                student.educationalSteps[i].completed = true;
                student.educationalSteps[i].date = getRandomPastDate();
            }
        }
        
        // Complete defense steps up to index
        if (student.defenseSteps) {
            for (let i = 0; i < defenseStepIndex && i < student.defenseSteps.length; i++) {
                student.defenseSteps[i].completed = true;
                student.defenseSteps[i].date = getRandomPastDate();
            }
        }
        
        student.updatedAt = new Date().toISOString();
        
        // Save
        studentsData[studentId] = student;
        localStorage.setItem('students_data', JSON.stringify(studentsData));
        
        console.log(`✅ Updated ${student.name}`);
        return true;
        
    } catch (error) {
        console.error('❌ Error setting student progress:', error);
        return false;
    }
}

// Function to create diverse progress patterns
function createDiverseProgress() {
    console.log('🎨 Creating diverse progress patterns...');
    
    try {
        const storedUsers = localStorage.getItem(CONFIG.STORAGE_KEYS.USERS);
        if (!storedUsers) {
            console.error('❌ No users in localStorage');
            return false;
        }
        
        const users = JSON.parse(storedUsers);
        const students = users.filter(u => u.role === 'student');
        
        // Define diverse patterns
        const patterns = [
            { edu: 0, def: 0 },   // Just started
            { edu: 2, def: 0 },   // Early educational
            { edu: 5, def: 0 },   // Mid educational
            { edu: 7, def: 2 },   // Educational + some defense
            { edu: 10, def: 3 },  // Half way both
            { edu: 12, def: 5 },  // More than half
            { edu: 15, def: 6 },  // Advanced
            { edu: 17, def: 7 },  // Near completion
            { edu: 19, def: 8 },  // Almost done
            { edu: 22, def: 10 }, // Completed
        ];
        
        const studentsData = JSON.parse(localStorage.getItem('students_data') || '{}');
        
        students.forEach((student, index) => {
            // Pick a pattern (cycle through patterns)
            const pattern = patterns[index % patterns.length];
            
            const educationalSteps = EmployeeModule.getDefaultEducationalSteps();
            const defenseSteps = EmployeeModule.getDefaultDefenseSteps2();
            
            // Apply pattern
            for (let i = 0; i < pattern.edu && i < educationalSteps.length; i++) {
                educationalSteps[i].completed = true;
                educationalSteps[i].date = getRandomPastDate();
            }
            
            for (let i = 0; i < pattern.def && i < defenseSteps.length; i++) {
                defenseSteps[i].completed = true;
                defenseSteps[i].date = getRandomPastDate();
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
            
            console.log(`${index + 1}. ${student.name}:`);
            console.log(`   📚 ${pattern.edu}/${educationalSteps.length} - ${eduCurrent ? eduCurrent.name : '✅ تکمیل'}`);
            console.log(`   🛡️ ${pattern.def}/${defenseSteps.length} - ${defCurrent ? defCurrent.name : '✅ تکمیل'}`);
        });
        
        localStorage.setItem('students_data', JSON.stringify(studentsData));
        
        console.log('✅ Diverse progress patterns created!');
        console.log('💡 Refresh the page to see changes');
        
        return true;
        
    } catch (error) {
        console.error('❌ Error creating diverse progress:', error);
        return false;
    }
}

// Expose functions globally
window.randomizeStudentProgress = randomizeStudentProgress;
window.setStudentProgress = setStudentProgress;
window.createDiverseProgress = createDiverseProgress;
