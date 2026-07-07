const fs = require('fs');
const path = require('path');

// CDN URLs
const replacements = [
    {
        old: 'assets/libs/tailwindcss.js',
        new: 'https://cdn.tailwindcss.com'
    },
    {
        old: 'assets/libs/fontawesome/css/all.min.css',
        new: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
    },
    {
        old: 'assets/fonts/vazirmatn/vazirmatn.css',
        new: 'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css'
    },
    {
        old: 'assets/libs/alpine.min.js',
        new: 'https://cdn.jsdelivr.net/npm/alpinejs@3.13.3/dist/cdn.min.js'
    }
];

// Function to update file
function updateFile(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;
        
        replacements.forEach(({ old, new: newUrl }) => {
            const regex = new RegExp(old.replace(/\//g, '\\/'), 'g');
            if (content.includes(old)) {
                content = content.replace(regex, newUrl);
                modified = true;
            }
        });
        
        if (modified) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✓ Updated: ${filePath}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error(`✗ Error updating ${filePath}:`, error.message);
        return false;
    }
}

// Function to find all HTML files
function findHtmlFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            // Skip node_modules, .git, backend, etc.
            if (!['node_modules', '.git', 'backend', '.vercel', '.vscode', '.kiro'].includes(file)) {
                findHtmlFiles(filePath, fileList);
            }
        } else if (file.endsWith('.html')) {
            fileList.push(filePath);
        }
    });
    
    return fileList;
}

// Main execution
console.log('🔄 Starting CDN migration...\n');

const htmlFiles = findHtmlFiles('.');
let updatedCount = 0;

htmlFiles.forEach(file => {
    if (updateFile(file)) {
        updatedCount++;
    }
});

console.log(`\n✅ Migration complete! Updated ${updatedCount} out of ${htmlFiles.length} HTML files.`);
