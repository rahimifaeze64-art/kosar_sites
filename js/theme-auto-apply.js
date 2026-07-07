/**
 * Auto-apply theme from localStorage
 * این اسکریپت تم ذخیره شده را از localStorage می‌خواند و اعمال می‌کند
 */

(function() {
    'use strict';
    
    // خواندن تم از localStorage
    const savedTheme = localStorage.getItem('app-theme');
    
    // اگر تم olive ذخیره شده باشد، اعمال کن
    if (savedTheme === 'olive') {
        document.documentElement.setAttribute('data-theme', 'olive');
        document.body.setAttribute('data-theme', 'olive');
        
        // اعمال استایل‌های inline برای بارگذاری سریع‌تر
        document.body.style.background = '#F2F2F2';
        
        console.log('✅ Olive theme auto-applied from localStorage');
        
        // تابع برای تغییر inline styles
        function applyOliveThemeToInlineStyles() {
            // تغییر تمام المنت‌هایی که inline style دارند
            const darkBackgrounds = document.querySelectorAll('[style*="background: #1e293b"], [style*="background:#1e293b"], [style*="background-color: #1e293b"]');
            darkBackgrounds.forEach(el => {
                el.style.background = '#FFFFFF';
                el.style.backgroundColor = '#FFFFFF';
            });
            
            // تغییر border های تیره
            const darkBorders = document.querySelectorAll('[style*="border: 1px solid #475569"], [style*="border-color: #475569"]');
            darkBorders.forEach(el => {
                el.style.borderColor = '#E0E0E0';
            });
            
            // تغییر رنگ متن‌های سفید
            const whiteTexts = document.querySelectorAll('[style*="color: white"], [style*="color:#fff"]');
            whiteTexts.forEach(el => {
                if (!el.closest('button')) { // دکمه‌ها رو نگه دار
                    el.style.color = '#333';
                }
            });
            
            console.log('✅ Inline styles updated for olive theme');
        }
        
        // اعمال بعد از لود صفحه
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', applyOliveThemeToInlineStyles);
        } else {
            applyOliveThemeToInlineStyles();
        }
        
        // اعمال مجدد بعد از تغییرات DOM
        const observer = new MutationObserver((mutations) => {
            let shouldUpdate = false;
            mutations.forEach(mutation => {
                if (mutation.addedNodes.length > 0) {
                    shouldUpdate = true;
                }
            });
            if (shouldUpdate) {
                setTimeout(applyOliveThemeToInlineStyles, 100);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    // اگر تم دیگری ذخیره شده باشد
    else if (savedTheme) {
        console.log(`ℹ️ Theme "${savedTheme}" loaded from localStorage`);
    }
    
    // اگر هیچ تمی ذخیره نشده، تم پیش‌فرض (blue) اعمال می‌شود
    else {
        console.log('ℹ️ No saved theme, using default (blue)');
    }
})();
