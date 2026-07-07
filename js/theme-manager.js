// Theme Manager - مدیریت تم‌های رنگی نرم‌افزار

const ThemeManager = {
    // تم‌های موجود
    themes: {
        blue: {
            name: 'آبی ',
            icon: '🔵',
            colors: {
                primary: '#1e40af',
                secondary: '#3b82f6',
                accent: '#60a5fa',
                gradient: 'from-blue-900 via-indigo-900 to-blue-800',
                sidebar: 'from-blue-600 via-blue-700 to-blue-800',
                button: 'bg-blue-600 hover:bg-blue-700',
                text: 'text-blue-200',
                border: 'border-blue-500'
            }
        },
        green: {
            name: 'سبز ',
            icon: '🟢',
            colors: {
                primary: '#15803d',
                secondary: '#22c55e',
                accent: '#4ade80',
                gradient: 'from-green-900 via-emerald-900 to-green-800',
                sidebar: 'from-green-600 via-green-700 to-green-800',
                button: 'bg-green-600 hover:bg-green-700',
                text: 'text-green-200',
                border: 'border-green-500'
            }
        },
        orange: {
            name: 'نارنجی ',
            icon: '🟠',
            colors: {
                primary: '#c2410c',
                secondary: '#f97316',
                accent: '#fb923c',
                gradient: 'from-orange-900 via-red-900 to-orange-800',
                sidebar: 'from-orange-600 via-orange-700 to-orange-800',
                button: 'bg-orange-600 hover:bg-orange-700',
                text: 'text-orange-200',
                border: 'border-orange-500'
            }
        },
        yellow: {
            name: 'زرد ',
            icon: '🟡',
            colors: {
                primary: '#cec022ff',
                secondary: '#ccf755ff',
                accent: '#f4fc84ff',
                gradient: 'from-yellow-900 via-violet-900 to-yellow-800',
                sidebar: 'from-yellow-600 via-yellow-700 to-yellow-800',
                button: 'bg-yellow-600 hover:bg-yellow-700',
                text: 'text-yellow-200',
                border: 'border-yellow-500'
            }
        },
        teal: {
            name: 'فیروزه‌ای ',
            icon: '🟢🔵',
            colors: {
                primary: '#0f766e',
                secondary: '#14b8a6',
                accent: '#2dd4bf',
                gradient: 'from-teal-900 via-cyan-900 to-teal-800',
                sidebar: 'from-teal-600 via-teal-700 to-teal-800',
                button: 'bg-teal-600 hover:bg-teal-700',
                text: 'text-teal-200',
                border: 'border-teal-500'
            }
        },
        olive: {
            name: 'سبز زیتونی ',
            icon: '🫒',
            colors: {
                primary: '#8FBF3F',
                primaryLight: '#A7CF5A',
                primaryHover: '#9AC24B',
                background: '#F2F2F2',
                surface: '#FFFFFF',
                border: '#E0E0E0',
                textSecondary: '#9E9E9E',
                selectedBg: '#EAF4D3',
                gradient: 'from-gray-100 via-gray-50 to-gray-100',
                sidebar: 'from-white via-gray-50 to-white',
                button: 'bg-[#8FBF3F] hover:bg-[#9AC24B]',
                text: 'text-gray-700',
                border: 'border-[#E0E0E0]'
            }
        }
    },

    // تم فعلی
    currentTheme: 'blue',

    // بارگذاری تم از localStorage
    init() {
        const savedTheme = localStorage.getItem('app-theme');
        if (savedTheme && this.themes[savedTheme]) {
            this.currentTheme = savedTheme;
        }
        this.applyTheme(this.currentTheme);
        debugLogger('Theme Manager initialized', 'success', { theme: this.currentTheme });
    },

    // اعمال تم
    applyTheme(themeName) {
        if (!this.themes[themeName]) {
            debugLogger('Invalid theme name', 'error', { themeName });
            return;
        }

        const theme = this.themes[themeName];
        const body = document.body;
        const sidebar = document.querySelector('aside');

        // حذف کلاس‌های تم قبلی
        this.removeAllThemeClasses(body);
        if (sidebar) {
            this.removeAllThemeClasses(sidebar);
        }

        // حذف data-theme قبلی
        body.removeAttribute('data-theme');

        // برای تم olive از data-theme استفاده می‌کنیم
        if (themeName === 'olive') {
            body.setAttribute('data-theme', 'olive');
            body.style.background = theme.colors.background;
            if (sidebar) {
                sidebar.style.background = 'linear-gradient(to bottom, #FFFFFF, #F9F9F9, #FFFFFF)';
                sidebar.style.borderLeft = '1px solid #E0E0E0';
            }
        } else {
            // اعمال کلاس‌های تم جدید برای تم‌های دیگر
            this.applyGradientClasses(body, theme.colors.gradient);
            if (sidebar) {
                this.applyGradientClasses(sidebar, theme.colors.sidebar);
            }

            // اعمال رنگ‌های دکمه‌ها
            this.applyButtonTheme(theme.colors.button);

            // اعمال رنگ‌های متن
            this.applyTextTheme(theme.colors.text);

            // اعمال رنگ‌های border
            this.applyBorderTheme(theme.colors.border);
        }

        // ذخیره تم
        this.currentTheme = themeName;
        localStorage.setItem('app-theme', themeName);

        // اعمال متا تگ برای PWA
        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) {
            metaTheme.setAttribute('content', theme.colors.primary);
        }

        debugLogger('Theme applied successfully', 'success', { theme: themeName });

        // نمایش نوتیفیکیشن غیرفعال شده
        // this.showThemeNotification(theme.name);
    },

    // حذف تمام کلاس‌های تم
    removeAllThemeClasses(element) {
        const gradientClasses = [
            'from-blue-900', 'via-indigo-900', 'to-blue-800',
            'from-blue-600', 'via-blue-700', 'to-blue-800',
            'from-green-900', 'via-emerald-900', 'to-green-800',
            'from-green-600', 'via-green-700', 'to-green-800',
            'from-orange-900', 'via-red-900', 'to-orange-800',
            'from-orange-600', 'via-orange-700', 'to-orange-800',
            'from-yellow-900', 'via-violet-900', 'to-yellow-800',
            'from-yellow-600', 'via-yellow-700', 'to-yellow-800',
            'from-teal-900', 'via-cyan-900', 'to-teal-800',
            'from-teal-600', 'via-teal-700', 'to-teal-800',
            'from-gray-100', 'via-gray-50', 'to-gray-100',
            'from-white', 'via-gray-50', 'to-white'
        ];

        gradientClasses.forEach(cls => element.classList.remove(cls));
    },

    // اعمال کلاس‌های گرادیانت
    applyGradientClasses(element, gradientString) {
        const classes = gradientString.split(' ');
        classes.forEach(cls => element.classList.add(cls));
    },

    // اعمال تم دکمه‌ها
    applyButtonTheme(buttonClasses) {
        const buttons = document.querySelectorAll('.theme-button');
        buttons.forEach(button => {
            // حذف کلاس‌های قبلی
            button.className = button.className.replace(/bg-\w+-\d+/g, '').replace(/hover:bg-\w+-\d+/g, '');
            
            // اضافه کردن کلاس‌های جدید
            const classes = buttonClasses.split(' ');
            classes.forEach(cls => button.classList.add(cls));
        });
    },

    // اعمال تم متن
    applyTextTheme(textClass) {
        const texts = document.querySelectorAll('.theme-text');
        texts.forEach(text => {
            text.className = text.className.replace(/text-\w+-\d+/g, '');
            text.classList.add(textClass);
        });
    },

    // اعمال تم border
    applyBorderTheme(borderClass) {
        const borders = document.querySelectorAll('.theme-border');
        borders.forEach(border => {
            border.className = border.className.replace(/border-\w+-\d+/g, '');
            border.classList.add(borderClass);
        });
    },

    // نمایش نوتیفیکیشن تغییر تم
    showThemeNotification(themeName) {
        const notification = document.createElement('div');
        notification.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-white text-gray-800 px-6 py-3 rounded-lg shadow-2xl z-50 flex items-center space-x-3 space-x-reverse animate-bounce';
        notification.innerHTML = `
            <i class="fas fa-palette text-2xl"></i>
            <span class="font-bold">تم "${themeName}" اعمال شد</span>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.5s ease-out';
            setTimeout(() => notification.remove(), 500);
        }, 2000);
    },

    // دریافت لیست تم‌ها برای نمایش در تنظیمات
    getThemesList() {
        return Object.keys(this.themes).map(key => ({
            id: key,
            name: this.themes[key].name,
            icon: this.themes[key].icon,
            colors: this.themes[key].colors
        }));
    },

    // دریافت تم فعلی
    getCurrentTheme() {
        return this.currentTheme;
    }
};

// اضافه کردن استایل برای انیمیشن fadeOut
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        from { opacity: 1; transform: translate(-50%, 0); }
        to { opacity: 0; transform: translate(-50%, -20px); }
    }
`;
document.head.appendChild(style);

// بارگذاری خودکار تم هنگام لود صفحه
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        ThemeManager.init();
    });
}
