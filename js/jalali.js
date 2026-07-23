/**
 * jalali.js  —  تبدیل تاریخ میلادی ↔ شمسی
 * الگوریتم: jalaali-js (MIT License, Mohsen Emami)
 * بدون وابستگی خارجی — کاملاً آفلاین
 */

(function (root) {
    'use strict';

    // ── الگوریتم اصلی ─────────────────────────────────────────
    function toJalaali(gy, gm, gd) {
        return d2j(g2d(gy, gm, gd));
    }

    function toGregorian(jy, jm, jd) {
        return d2g(j2d(jy, jm, jd));
    }

    function isLeapJalaaliYear(jy) {
        return jalCal(jy).leap === 0;
    }

    function monthLength(jy, jm) {
        if (jm <= 6) return 31;
        if (jm <= 11) return 30;
        return isLeapJalaaliYear(jy) ? 30 : 29;
    }

    function jalCal(jy) {
        var breaks = [-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178];
        var bl = breaks.length, gy = jy + 621, leapJ = -14, jp = breaks[0];
        var jump, leap, n, i, jm, v;
        if (jy < jp || jy >= breaks[bl-1]) throw new Error('Invalid Jalali year ' + jy);
        for (i=1; i<bl; i++) {
            jm = breaks[i]; jump = jm - jp;
            if (jy < jm) break;
            leapJ = leapJ + div(jump, 33)*8 + div(mod(jump, 33), 4);
            jp = jm;
        }
        n = jy - jp;
        leapJ = leapJ + div(n, 33)*8 + div(mod(n, 33)+3, 4);
        if (mod(jump, 33) === 4 && jump - n === 4) leapJ++;
        var leapG = div(gy, 4) - div((div(gy, 100)+1)*3, 4) - 150;
        var march = 20 + leapJ - leapG;
        if (jump - n < 6) n = n - jump + div(jump+4, 33)*33;
        leap = mod(mod(n+1, 33)-1, 4);
        if (leap === -1) leap = 4;
        return { leap: leap, gy: gy, march: march };
    }

    function div(a, b) { return ~~(a / b); }
    function mod(a, b) { return a - ~~(a / b) * b; }

    function g2d(gy, gm, gd) {
        var d = div((gy+div(gm-8,6)+100100)*1461,4) + div(153*mod(gm+9,12)+2,5) + gd - 34840408;
        d = d - div(div(gy+100100+div(gm-8,6),100)*3,4) + 752;
        return d;
    }

    function d2g(jd) {
        var j = 4*jd + 139361631;
        j = j + div(div(4*jd+183187720,146097)*3,4)*4 - 3908;
        var i = div(mod(j,1461),4)*5 + 308;
        var gd = div(mod(i,153),5) + 1;
        var gm = mod(div(i,153),12) + 1;
        var gy = div(j,1461) - 100100 + div(8-gm,6);
        return { gy: gy, gm: gm, gd: gd };
    }

    function j2d(jy, jm, jd) {
        var r = jalCal(jy);
        return g2d(r.gy, 3, r.march) + (jm-1)*30 + div(jm-1,6)*(-1) + (jm > 6 ? 6*(jm-7) : 0) + jd - 1;
    }

    function d2j(jd) {
        var gy = d2g(jd).gy;
        var jy = gy - 621;
        var r = jalCal(jy);
        var jdn = g2d(gy, 3, r.march);
        var j = jd - jdn;
        if (j >= 0) {
            if (j >= 365) {
                jy++;
                r = jalCal(jy);
                jdn = g2d(r.gy, 3, r.march);
                j = jd - jdn;
            }
        } else {
            jy--;
            r = jalCal(jy);
            jdn = g2d(r.gy, 3, r.march);
            j = jd - jdn;
        }
        var jm = div(j*2, 61) + 1;
        var jd2 = j - (div(jm-1, 2)*31 + div(jm, 2)*30) + 1;
        return { jy: jy, jm: jm, jd: jd2 };
    }

    // ── نام ماه‌های شمسی ─────────────────────────────────────
    var MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور',
                  'مهر','آبان','آذر','دی','بهمن','اسفند'];
    var DAYS   = ['یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه','شنبه'];

    function pad2(n) { return n < 10 ? '0' + n : String(n); }

    function toFarsiDigits(s) {
        return String(s).replace(/\d/g, function(d) {
            return '۰۱۲۳۴۵۶۷۸۹'[d];
        });
    }

    // ── Public Helpers ────────────────────────────────────────

    /**
     * تبدیل هر Date یا رشته تاریخ → نمایش شمسی
     * خروجی مثال: "۱۴۰۴/۰۴/۱۵" یا "۱۵ تیر ۱۴۰۴"
     */
    function toJalaliDisplay(input, format) {
        if (!input) return '—';
        var date = (input instanceof Date) ? input : new Date(input);
        if (isNaN(date.getTime())) return String(input);
        var j = toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
        if (format === 'long') {
            return toFarsiDigits(j.jd) + ' ' + MONTHS[j.jm - 1] + ' ' + toFarsiDigits(j.jy);
        }
        if (format === 'month-year') {
            return MONTHS[j.jm - 1] + ' ' + toFarsiDigits(j.jy);
        }
        // پیش‌فرض: YYYY/MM/DD فارسی
        return toFarsiDigits(j.jy + '/' + pad2(j.jm) + '/' + pad2(j.jd));
    }

    /**
     * تبدیل رشته ISO یا Date → رشته YYYY-MM-DD شمسی (برای ذخیره‌سازی)
     */
    function toJalaliISO(input) {
        if (!input) return '';
        var date = (input instanceof Date) ? input : new Date(input);
        if (isNaN(date.getTime())) return String(input);
        var j = toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
        return j.jy + '-' + pad2(j.jm) + '-' + pad2(j.jd);
    }

    /**
     * تبدیل رشته شمسی YYYY-MM-DD → Date میلادی
     */
    function fromJalaliISO(jStr) {
        if (!jStr) return null;
        var parts = String(jStr).split('-');
        if (parts.length !== 3) return null;
        var g = toGregorian(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]));
        return new Date(g.gy, g.gm - 1, g.gd);
    }

    /**
     * تاریخ امروز به فرمت YYYY-MM-DD شمسی (برای value فیلد date)
     */
    function todayJalali() {
        return toJalaliISO(new Date());
    }

    /**
     * نمایش تاریخ و ساعت کامل شمسی
     * مثال: "۱۴۰۴/۰۴/۱۵ — ۱۴:۳۰"
     */
    function toJalaliDateTime(input) {
        if (!input) return '—';
        var date = (input instanceof Date) ? input : new Date(input);
        if (isNaN(date.getTime())) return String(input);
        var j = toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
        var h = pad2(date.getHours());
        var m = pad2(date.getMinutes());
        return toFarsiDigits(j.jy + '/' + pad2(j.jm) + '/' + pad2(j.jd) + ' — ' + h + ':' + m);
    }

    /**
     * اگر رشته ورودی شمسی باشد (مثل "1404-04-15") آن را نمایش می‌دهد،
     * اگر میلادی باشد تبدیل می‌کند.
     */
    function displayDate(input, format) {
        if (!input || input === '—' || input === '-') return '—';
        // بررسی آیا قبلاً شمسی است
        var jalaliPattern = /^1[34]\d{2}[-/]\d{1,2}[-/]\d{1,2}$/;
        if (jalaliPattern.test(String(input))) {
            var parts = String(input).replace(/\//g, '-').split('-');
            var jy = parseInt(parts[0]), jm = parseInt(parts[1]), jd = parseInt(parts[2]);
            if (format === 'long') return toFarsiDigits(jd) + ' ' + MONTHS[jm - 1] + ' ' + toFarsiDigits(jy);
            return toFarsiDigits(jy + '/' + pad2(jm) + '/' + pad2(jd));
        }
        return toJalaliDisplay(input, format);
    }

    // ── Export ────────────────────────────────────────────────
    var Jalali = {
        toJalaali:        toJalaali,
        toGregorian:      toGregorian,
        toJalaliDisplay:  toJalaliDisplay,
        toJalaliISO:      toJalaliISO,
        fromJalaliISO:    fromJalaliISO,
        todayJalali:      todayJalali,
        toJalaliDateTime: toJalaliDateTime,
        displayDate:      displayDate,
        monthName:        function(m) { return MONTHS[m - 1] || ''; },
        MONTHS:           MONTHS,
    };

    // Global
    root.Jalali = Jalali;

    // Shorthand global helper
    root.jDate    = toJalaliDisplay;
    root.jDateISO = toJalaliISO;

    console.log('✅ Jalali.js بارگذاری شد — تبدیل تاریخ شمسی فعال');

})(typeof window !== 'undefined' ? window : this);
