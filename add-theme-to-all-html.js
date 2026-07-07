/**
 * Script to add theme-olive.css to all HTML files
 * Run with: node add-theme-to-all-html.js
 */

const fs = require('fs');
const path = require('path');

// HTML files to update (excluding test files)
const mainHtmlFiles = [
    'index.html',
    'archive.html',
    'management-chat.html',
    'modals.html'
];

const themeCssLink = '<link href="css/theme-olive.css" rel="stylesheet">';

mainHtmlFiles.forEach(file => {
    try {
        const filePath = path.join(__dirname, file);
        
        if (!fs.existsSync(filePath)) {
            console.log(`⚠️  File not found: ${file}`);
            return;
        }
        
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Check if theme CSS already exists
        if (content.includes('theme-olive.css')) {
            console.log(`✓ ${file} already has theme CSS`);
            return;
        }
        
        // Add theme CSS before </head>
        content = content.replace('</head>', `    ${themeCssLink}\n</head>`);
        
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Added theme CSS to ${file}`);
        
    } catch (error) {
        console.error(`❌ Error processing ${file}:`, error.message);
    }
});

console.log('\n✅ Done! Theme CSS added to all main HTML files.');
