const fs = require('fs');
const path = require('path');

// تعریف جایگزینی‌ها
const replacements = [
    {
        from: 'https://cdn.tailwindcss.com',
        to: 'assets/libs/tailwindcss.js'
    },
    {
        from: 'https://cdn.jsdelivr.net/npm/alpinejs@3.13.3/dist/cdn.min.js',
        to: 'assets/libs/alpine.min.js'
    },
    {
        from: 'https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js',
        to: 'assets/libs/alpine.min.js'
    },
    {
        from: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
        to: 'assets/libs/fontawesome/css/all.min.css'
    },
    {
        from: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
        to: 'assets/libs/fontawesome/css/all.min.css'
    },
    {
        from: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
        to: 'assets/libs/fontawesome/css/all.min.css'
    },
    {
        from: 'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css',
        to: 'assets/fonts/vazirmatn/vazirmatn.css'
    },
    {
        from: 'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js',
        to: 'assets/libs/tesseract.min.js'
    },
    {
        from: 'https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.4/moment.min.js',
        to: 'assets/libs/moment.min.js'
    },
    {
        from: 'https://cdnjs.cloudflare.com/ajax/libs/moment-jalaali/0.10.0/moment-jalaali.min.js',
        to: 'assets/libs/moment.min.js'
    }
];

// پیدا کردن تمام فایل‌های HTML
function findHtmlFiles(dir) {
    let results = [];
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            // Skip node_modules, .git, backend
            if (!['node_modules', '.git', 'backend', 'flutter_app'].includes(file)) {
                results = results.concat(findHtmlFiles(filePath));
            }
        } else if (file.endsWith('.html')) {
            results.push(filePath);
        }
    }
    
    return results;
}

// اصلاح یک فایل
function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    for (const replacement of replacements) {
        if (content.includes(replacement.from)) {
            content = content.replace(new RegExp(replacement.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement.to);
            modified = true;
        }
    }
    
    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ اصلاح شد: ${filePath}`);
        return true;
    }
    
    return false;
}

// اجرای اصلی
console.log('🔍 جستجوی فایل‌های HTML...\n');
const htmlFiles = findHtmlFiles('.');
console.log(`📁 ${htmlFiles.length} فایل HTML پیدا شد\n`);

let fixedCount = 0;
for (const file of htmlFiles) {
    if (fixFile(file)) {
        fixedCount++;
    }
}

console.log(`\n✅ تمام! ${fixedCount} فایل اصلاح شد.`);
