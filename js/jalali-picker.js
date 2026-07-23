/**
 * jalali-picker.js
 * date picker شمسی سبک — بدون dependency
 * استفاده: JalaliPicker.init() بعد از لود DOM
 */

(function(root) {
    'use strict';

    var J = root.Jalali;
    if (!J) { console.error('jalali-picker: Jalali.js باید قبل از این فایل لود شود'); return; }

    var MONTHS = J.MONTHS;
    var activeInput = null;
    var pickerEl = null;
    var currentJY, currentJM;

    // ── ساخت picker DOM ─────────────────────────────────────
    function createPicker() {
        if (document.getElementById('__jalali-picker')) return;
        var el = document.createElement('div');
        el.id = '__jalali-picker';
        el.dir = 'rtl';
        el.style.cssText = [
            'position:fixed','z-index:99999','background:#1e3a5f',
            'border:1px solid #3b82f6','border-radius:12px','padding:12px',
            'box-shadow:0 8px 32px rgba(0,0,0,0.5)','min-width:280px',
            'font-family:Vazirmatn,sans-serif','display:none','color:#fff'
        ].join(';');
        document.body.appendChild(el);
        pickerEl = el;

        document.addEventListener('click', function(e) {
            if (!pickerEl) return;
            if (!pickerEl.contains(e.target) && e.target !== activeInput) {
                pickerEl.style.display = 'none';
                activeInput = null;
            }
        });
    }

    // ── رندر تقویم ──────────────────────────────────────────
    function renderCalendar(jy, jm) {
        currentJY = jy; currentJM = jm;
        var g = J.toGregorian(jy, jm, 1);
        var firstDay = new Date(g.gy, g.gm - 1, g.gd).getDay(); // 0=Sun
        // تبدیل به شنبه-اول (IR)
        var startOffset = (firstDay + 1) % 7;
        var daysInMonth = J.monthLength ? J.monthLength(jy, jm) : (jm <= 6 ? 31 : jm <= 11 ? 30 : 29);

        // هدر ناوبری
        var prevM = jm === 1 ? 12 : jm - 1;
        var prevY = jm === 1 ? jy - 1 : jy;
        var nextM = jm === 12 ? 1 : jm + 1;
        var nextY = jm === 12 ? jy + 1 : jy;

        var today = J.toJalaali(new Date().getFullYear(), new Date().getMonth()+1, new Date().getDate());

        // مقدار انتخاب‌شده فعلی
        var selD = 0;
        if (activeInput && activeInput.dataset.jalaliValue) {
            var parts = activeInput.dataset.jalaliValue.split('-');
            if (parts.length === 3 && parseInt(parts[0]) === jy && parseInt(parts[1]) === jm) {
                selD = parseInt(parts[2]);
            }
        }

        var html = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
        html += '<button onclick="JalaliPicker._nav(' + prevY + ',' + prevM + ')" style="background:none;border:none;color:#93c5fd;font-size:18px;cursor:pointer;padding:4px 8px">&#8250;</button>';
        html += '<div style="text-align:center">';
        html += '<select onchange="JalaliPicker._goMonth(this.value)" style="background:#1e3a5f;color:#fff;border:1px solid #3b82f6;border-radius:6px;padding:2px 6px;margin-left:4px">';
        for (var mi = 1; mi <= 12; mi++) {
            html += '<option value="' + mi + '"' + (mi === jm ? ' selected' : '') + '>' + MONTHS[mi-1] + '</option>';
        }
        html += '</select>';
        html += '<select onchange="JalaliPicker._goYear(this.value)" style="background:#1e3a5f;color:#fff;border:1px solid #3b82f6;border-radius:6px;padding:2px 6px">';
        for (var yi = jy - 5; yi <= jy + 5; yi++) {
            html += '<option value="' + yi + '"' + (yi === jy ? ' selected' : '') + '>' + toFa(yi) + '</option>';
        }
        html += '</select></div>';
        html += '<button onclick="JalaliPicker._nav(' + nextY + ',' + nextM + ')" style="background:none;border:none;color:#93c5fd;font-size:18px;cursor:pointer;padding:4px 8px">&#8249;</button>';
        html += '</div>';

        // روزهای هفته
        var dayNames = ['ش','ی','د','س','چ','پ','ج'];
        html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px">';
        for (var d = 0; d < 7; d++) {
            html += '<div style="text-align:center;font-size:11px;color:#93c5fd;padding:4px 0">' + dayNames[d] + '</div>';
        }
        html += '</div>';

        // روزها
        html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">';
        // خانه‌های خالی اول
        for (var e = 0; e < startOffset; e++) {
            html += '<div></div>';
        }
        for (var day = 1; day <= daysInMonth; day++) {
            var isToday = (today.jy === jy && today.jm === jm && today.jd === day);
            var isSel = selD === day;
            var isFri = ((startOffset + day - 1) % 7) === 6;
            var bg = isSel ? '#3b82f6' : isToday ? '#1d4ed8' : 'transparent';
            var col = isFri ? '#f87171' : '#fff';
            var border = isToday && !isSel ? '1px solid #60a5fa' : '1px solid transparent';
            html += '<button onclick="JalaliPicker._pick(' + jy + ',' + jm + ',' + day + ')"';
            html += ' style="background:' + bg + ';color:' + col + ';border:' + border + ';border-radius:6px;padding:6px 0;font-size:13px;cursor:pointer;text-align:center;font-family:Vazirmatn,sans-serif">';
            html += toFa(day);
            html += '</button>';
        }
        html += '</div>';

        // دکمه امروز
        html += '<div style="margin-top:8px;text-align:center">';
        html += '<button onclick="JalaliPicker._today()" style="background:#1d4ed8;color:#fff;border:none;border-radius:8px;padding:6px 20px;cursor:pointer;font-size:12px;font-family:Vazirmatn,sans-serif">امروز</button>';
        html += '<button onclick="JalaliPicker._clear()" style="background:#374151;color:#9ca3af;border:none;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:12px;margin-right:6px;font-family:Vazirmatn,sans-serif">پاک</button>';
        html += '</div>';

        pickerEl.innerHTML = html;
        pickerEl.style.display = 'block';
    }

    function toFa(n) {
        return String(n).replace(/\d/g, function(d) { return '۰۱۲۳۴۵۶۷۸۹'[d]; });
    }

    function pad2(n) { return n < 10 ? '0' + n : String(n); }

    // ── position picker ─────────────────────────────────────
    function positionPicker(input) {
        var rect = input.getBoundingClientRect();
        var top = rect.bottom + window.scrollY + 4;
        var left = rect.left + window.scrollX;
        // مطمئن شو از صفحه خارج نشه
        if (left + 290 > window.innerWidth) left = window.innerWidth - 295;
        pickerEl.style.top = top + 'px';
        pickerEl.style.left = left + 'px';
    }

    // ── Public API ───────────────────────────────────────────
    var JalaliPicker = {

        init: function() {
            createPicker();
            // تبدیل همه input[data-jalali] به picker
            document.querySelectorAll('input[data-jalali]').forEach(function(input) {
                JalaliPicker._attach(input);
            });
        },

        // اتصال به یک input خاص
        _attach: function(input) {
            // مخفی کردن input اصلی
            input.style.display = 'none';

            // ساخت display input
            var display = document.createElement('input');
            display.type = 'text';
            display.readOnly = true;
            display.placeholder = 'انتخاب تاریخ';
            display.className = input.className;
            display.style.cssText = 'cursor:pointer;' + (input.style.cssText || '');
            display.title = 'تقویم شمسی';

            // نمایش مقدار اولیه
            if (input.value) {
                var j = J.toJalaali(
                    parseInt(input.value.split('-')[0]),
                    parseInt(input.value.split('-')[1]),
                    parseInt(input.value.split('-')[2])
                );
                var jStr = j.jy + '-' + pad2(j.jm) + '-' + pad2(j.jd);
                input.dataset.jalaliValue = jStr;
                display.value = J.toJalaliDisplay(new Date(input.value));
            }

            input.parentNode.insertBefore(display, input.nextSibling);

            display.addEventListener('click', function(e) {
                e.stopPropagation();
                activeInput = input;

                var t = J.toJalaali(new Date().getFullYear(), new Date().getMonth()+1, new Date().getDate());
                if (input.dataset.jalaliValue) {
                    var p = input.dataset.jalaliValue.split('-');
                    if (p.length === 3) { t = { jy: parseInt(p[0]), jm: parseInt(p[1]), jd: parseInt(p[2]) }; }
                }
                positionPicker(display);
                renderCalendar(t.jy, t.jm);
            });
        },

        _nav: function(y, m) {
            renderCalendar(y, m);
        },

        _goMonth: function(m) {
            renderCalendar(currentJY, parseInt(m));
        },

        _goYear: function(y) {
            renderCalendar(parseInt(y), currentJM);
        },

        _pick: function(jy, jm, jd) {
            if (!activeInput) return;
            var jStr = jy + '-' + pad2(jm) + '-' + pad2(jd);
            activeInput.dataset.jalaliValue = jStr;

            // تبدیل به میلادی برای value اصلی input
            var g = J.toGregorian(jy, jm, jd);
            activeInput.value = g.gy + '-' + pad2(g.gm) + '-' + pad2(g.gd);

            // آپدیت display input
            var disp = activeInput.nextElementSibling;
            if (disp && disp.readOnly) {
                disp.value = toFa(jd) + ' ' + J.MONTHS[jm-1] + ' ' + toFa(jy);
            }

            // fire change event
            activeInput.dispatchEvent(new Event('change', { bubbles: true }));

            pickerEl.style.display = 'none';
            activeInput = null;
        },

        _today: function() {
            var t = new Date();
            var j = J.toJalaali(t.getFullYear(), t.getMonth()+1, t.getDate());
            JalaliPicker._pick(j.jy, j.jm, j.jd);
        },

        _clear: function() {
            if (!activeInput) return;
            activeInput.value = '';
            activeInput.dataset.jalaliValue = '';
            var disp = activeInput.nextElementSibling;
            if (disp && disp.readOnly) disp.value = '';
            pickerEl.style.display = 'none';
            activeInput = null;
        },

        // اتصال دستی به input با id
        attachById: function(id) {
            var el = document.getElementById(id);
            if (el) JalaliPicker._attach(el);
        }
    };

    root.JalaliPicker = JalaliPicker;
    console.log('✅ JalaliPicker بارگذاری شد');

})(typeof window !== 'undefined' ? window : this);
