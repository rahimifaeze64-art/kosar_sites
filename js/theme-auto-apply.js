/**
 * Auto-apply Olive theme - تم ثابت زیتونی
 */

(function() {
    'use strict';
    
    // اعمال ثابت تم olive
    localStorage.setItem('app-theme', 'olive');
    document.documentElement.setAttribute('data-theme', 'olive');
    document.body.setAttribute('data-theme', 'olive');
    document.body.style.background = '#F2F2F2';
    
    console.log('✅ Olive theme applied (fixed)');
    
    function applyOliveThemeToInlineStyles() {
        const darkBackgrounds = document.querySelectorAll('[style*="background: #1e293b"], [style*="background:#1e293b"], [style*="background-color: #1e293b"]');
        darkBackgrounds.forEach(el => {
            el.style.background = '#FFFFFF';
            el.style.backgroundColor = '#FFFFFF';
        });
        
        const darkBorders = document.querySelectorAll('[style*="border: 1px solid #475569"], [style*="border-color: #475569"]');
        darkBorders.forEach(el => {
            el.style.borderColor = '#E0E0E0';
        });
        
        console.log('✅ Inline styles updated for olive theme');
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyOliveThemeToInlineStyles);
    } else {
        applyOliveThemeToInlineStyles();
    }
    
    const observer = new MutationObserver((mutations) => {
        let shouldUpdate = false;
        mutations.forEach(mutation => {
            if (mutation.addedNodes.length > 0) shouldUpdate = true;
        });
        if (shouldUpdate) setTimeout(applyOliveThemeToInlineStyles, 100);
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
})();
