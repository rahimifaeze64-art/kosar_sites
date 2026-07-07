// Persian Date Utilities - تبدیل تاریخ میلادی به شمسی
const PersianDate = {
    // Convert Gregorian to Jalali
    gregorianToJalali(gy, gm, gd) {
        const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
        
        if (gy > 1600) {
            let jy = 979;
            gy -= 1600;
        } else {
            let jy = 0;
            gy -= 621;
        }
        
        let gy2 = (gm > 2) ? (gy + 1) : gy;
        let days = (365 * gy) + (parseInt((gy2 + 3) / 4)) - (parseInt((gy2 + 99) / 100)) + 
                   (parseInt((gy2 + 399) / 400)) - 80 + gd + g_d_m[gm - 1];
        let jy = -1595 + (33 * parseInt(days / 12053));
        days %= 12053;
        jy += 4 * parseInt(days / 1461);
        days %= 1461;
        
        if (days > 365) {
            jy += parseInt((days - 1) / 365);
            days = (days - 1) % 365;
        }
        
        let jm, jd;
        if (days < 186) {
            jm = 1 + parseInt(days / 31);
            jd = 1 + (days % 31);
        } else {
            jm = 7 + parseInt((days - 186) / 30);
            jd = 1 + ((days - 186) % 30);
        }
        
        return { year: jy, month: jm, day: jd };
    },
    
    // Convert Jalali to Gregorian
    jalaliToGregorian(jy, jm, jd) {
        if (jy > 979) {
            let gy = 1600;
            jy -= 979;
        } else {
            let gy = 621;
        }
        
        let days = (365 * jy) + ((parseInt(jy / 33)) * 8) + (parseInt(((jy % 33) + 3) / 4)) + 78 + jd;
        
        if (jm < 7) {
            days += (jm - 1) * 31;
        } else {
            days += ((jm - 7) * 30) + 186;
        }
        
        let gy = 400 * parseInt(days / 146097);
        days %= 146097;
        
        let leap = true;
        if (days >= 36525) {
            days--;
            gy += 100 * parseInt(days / 36524);
            days %= 36524;
            if (days >= 365) days++;
            else leap = false;
        }
        
        gy += 4 * parseInt(days / 1461);
        days %= 1461;
        
        if (days >= 366) {
            leap = false;
            days--;
            gy += parseInt(days / 365);
            days %= 365;
        }
        
        const g_d_m = [0, 31, leap ? 60 : 59, leap ? 91 : 90, leap ? 121 : 120, 
                       leap ? 152 : 151, leap ? 182 : 181, leap ? 213 : 212, 
                       leap ? 244 : 243, leap ? 274 : 273, leap ? 305 : 304, 
                       leap ? 335 : 334, leap ? 366 : 365];
        
        let gm, gd;
        for (gm = 0; gm < 13; gm++) {
            let v = g_d_m[gm];
            if (days < v) {
                gd = days - g_d_m[gm - 1] + 1;
                break;
            }
        }
        
        return { year: gy, month: gm, day: gd };
    },
    
    // Format Persian date
    format(date, format = 'YYYY/MM/DD') {
        const d = new Date(date);
        const jalali = this.gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
        
        return format
            .replace('YYYY', jalali.year)
            .replace('MM', String(jalali.month).padStart(2, '0'))
            .replace('DD', String(jalali.day).padStart(2, '0'));
    },
    
    // Get Persian month name
    getMonthName(month) {
        const months = [
            'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
            'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
        ];
        return months[month - 1] || '';
    },
    
    // Get Persian day name
    getDayName(date) {
        const d = new Date(date);
        const days = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];
        return days[d.getDay()];
    },
    
    // Format with month name
    formatWithMonthName(date) {
        const d = new Date(date);
        const jalali = this.gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
        return `${jalali.day} ${this.getMonthName(jalali.month)} ${jalali.year}`;
    },
    
    // Create Persian date picker input
    createDatePicker(inputId, onSelect) {
        const input = document.getElementById(inputId);
        if (!input) return;
        
        // Add click event to show calendar
        input.addEventListener('click', () => {
            this.showCalendar(input, onSelect);
        });
        
        // Make input readonly to prevent manual entry
        input.setAttribute('readonly', 'readonly');
        input.style.cursor = 'pointer';
    },
    
    // Show calendar modal
    showCalendar(input, onSelect) {
        // Get current date or selected date
        let currentDate = new Date();
        if (input.value) {
            const parts = input.value.split('-');
            if (parts.length === 3) {
                const jalali = this.jalaliToGregorian(
                    parseInt(parts[0]), 
                    parseInt(parts[1]), 
                    parseInt(parts[2])
                );
                currentDate = new Date(jalali.year, jalali.month - 1, jalali.day);
            }
        }
        
        const jalali = this.gregorianToJalali(
            currentDate.getFullYear(), 
            currentDate.getMonth() + 1, 
            currentDate.getDate()
        );
        
        // Create calendar HTML
        const calendarHTML = this.generateCalendarHTML(jalali.year, jalali.month, input, onSelect);
        
        // Show modal
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center';
        modal.innerHTML = calendarHTML;
        document.body.appendChild(modal);
        
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    },
    
    // Generate calendar HTML
    generateCalendarHTML(year, month, input, onSelect) {
        const monthName = this.getMonthName(month);
        const daysInMonth = month <= 6 ? 31 : (month <= 11 ? 30 : (this.isLeapYear(year) ? 30 : 29));
        
        // Get first day of month
        const firstDay = this.jalaliToGregorian(year, month, 1);
        const firstDayOfWeek = new Date(firstDay.year, firstDay.month - 1, firstDay.day).getDay();
        
        let calendarDays = '';
        let dayCounter = 1;
        
        // Generate 6 weeks
        for (let week = 0; week < 6; week++) {
            calendarDays += '<div class="grid grid-cols-7 gap-1">';
            for (let day = 0; day < 7; day++) {
                const cellIndex = week * 7 + day;
                if (cellIndex < firstDayOfWeek || dayCounter > daysInMonth) {
                    calendarDays += '<div class="p-2"></div>';
                } else {
                    const currentDay = dayCounter;
                    calendarDays += `
                        <button type="button" 
                                onclick="selectPersianDate(${year}, ${month}, ${currentDay}, '${input.id}', ${onSelect ? 'true' : 'false'})"
                                class="p-2 hover:bg-blue-100 rounded text-center transition-colors ${
                                    currentDay === new Date().getDate() ? 'bg-blue-500 text-white' : ''
                                }">
                            ${currentDay}
                        </button>
                    `;
                    dayCounter++;
                }
            }
            calendarDays += '</div>';
            if (dayCounter > daysInMonth) break;
        }
        
        return `
            <div class="bg-white rounded-lg p-6 max-w-md w-full">
                <div class="flex justify-between items-center mb-4">
                    <button type="button" onclick="changePersianMonth(${year}, ${month}, 1, '${input.id}', ${onSelect ? 'true' : 'false'})"
                            class="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                    <h3 class="text-lg font-bold">${monthName} ${year}</h3>
                    <button type="button" onclick="changePersianMonth(${year}, ${month}, -1, '${input.id}', ${onSelect ? 'true' : 'false'})"
                            class="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                </div>
                
                <!-- Day names -->
                <div class="grid grid-cols-7 gap-1 mb-2">
                    <div class="text-center text-sm font-medium text-gray-600">ش</div>
                    <div class="text-center text-sm font-medium text-gray-600">ی</div>
                    <div class="text-center text-sm font-medium text-gray-600">د</div>
                    <div class="text-center text-sm font-medium text-gray-600">س</div>
                    <div class="text-center text-sm font-medium text-gray-600">چ</div>
                    <div class="text-center text-sm font-medium text-gray-600">پ</div>
                    <div class="text-center text-sm font-medium text-red-600">ج</div>
                </div>
                
                <!-- Calendar days -->
                ${calendarDays}
                
                <div class="mt-4 flex justify-end">
                    <button type="button" onclick="this.closest('.fixed').remove()"
                            class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
                        بستن
                    </button>
                </div>
            </div>
        `;
    },
    
    // Check if year is leap
    isLeapYear(year) {
        const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 
                        1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
        let jp = breaks[0];
        let jump = 0;
        
        for (let i = 1; i < breaks.length; i++) {
            const jm = breaks[i];
            jump = jm - jp;
            if (year < jm) break;
            jp = jm;
        }
        
        let n = year - jp;
        if (jump - n < 6) n = n - jump + (parseInt(jump / 33) * 33);
        
        let leap = ((((n + 1) % 33) - 1) % 4);
        return leap === 0;
    }
};

// Global functions for calendar
window.selectPersianDate = function(year, month, day, inputId, hasCallback) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    // Convert to Gregorian for value
    const gregorian = PersianDate.jalaliToGregorian(year, month, day);
    const gregorianDate = `${gregorian.year}-${String(gregorian.month).padStart(2, '0')}-${String(gregorian.day).padStart(2, '0')}`;
    
    // Set value
    input.value = gregorianDate;
    
    // Set display text (Persian)
    const persianDate = `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
    if (input.dataset.persianDisplay) {
        const displayElement = document.getElementById(input.dataset.persianDisplay);
        if (displayElement) {
            displayElement.textContent = persianDate;
        }
    }
    
    // Trigger change event
    input.dispatchEvent(new Event('change', { bubbles: true }));
    
    // Close modal
    const modal = document.querySelector('.fixed.inset-0.bg-black.bg-opacity-50');
    if (modal) modal.remove();
};

window.changePersianMonth = function(year, month, direction, inputId, hasCallback) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    let newMonth = month - direction;
    let newYear = year;
    
    if (newMonth < 1) {
        newMonth = 12;
        newYear--;
    } else if (newMonth > 12) {
        newMonth = 1;
        newYear++;
    }
    
    // Close current modal
    const modal = document.querySelector('.fixed.inset-0.bg-black.bg-opacity-50');
    if (modal) modal.remove();
    
    // Show new calendar
    setTimeout(() => {
        PersianDate.showCalendar(input, hasCallback);
    }, 100);
};
