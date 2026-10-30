// ============================================================
// js/storage-health.js
// محافظ حافظهٔ مرورگر (localStorage)
//  • جلوگیری از QuotaExceededError (پر شدن ۵ مگابایتی localStorage)
//  • نگه‌داری sessionVersion در کوکی به‌عنوان پشتیبان
// ============================================================
(function () {
    'use strict';

    var COOKIE_NAME = 'sv';

    function isQuotaError(e) {
        return !!e && (
            e.name === 'QuotaExceededError' ||
            e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
            e.code === 22 ||
            e.code === 1014 ||
            /quota/i.test(e.message || '')
        );
    }

    function eachKey(cb) {
        var keys = [];
        try {
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (k) keys.push(k);
            }
        } catch (e) { return; }
        for (var j = 0; j < keys.length; j++) cb(keys[j]);
    }

    // ── مرحلهٔ ۱: حذف کلیدهای قطعاً دورریز ─────────────────────
    //   • نشست‌های سوپابیس (هر دو پروژه: قدیم و جدید)
    //   • فایل‌های پیوست base64 که فقط کش هستند (order_file_*)
    function prune() {
        var removed = 0;
        eachKey(function (k) {
            var drop = false;
            if (k.indexOf('sb-') === 0 && k.indexOf('-auth-token') !== -1) drop = true;
            if (k === 'supabase.auth.token') drop = true;
            if (/^order_file_/i.test(k)) drop = true;
            if (drop) {
                try { localStorage.removeItem(k); removed++; } catch (e) {}
            }
        });
        return removed;
    }

    // ── مرحلهٔ ۲ (آخرین راه‌حل): حذف بزرگ‌ترین مقادیر غیرضروری ─
    var KEEP = {
        currentUser: 1,
        edu_system_current_user: 1,
        sessionVersion: 1
    };
    function pruneLarge(minBytes) {
        minBytes = minBytes || 200 * 1024;
        var removed = 0;
        var big = [];
        eachKey(function (k) {
            if (KEEP[k]) return;
            var v = null;
            try { v = localStorage.getItem(k); } catch (e) { return; }
            if (v && v.length >= minBytes) big.push({ key: k, len: v.length });
        });
        big.sort(function (a, b) { return b.len - a.len; });
        for (var i = 0; i < big.length; i++) {
            try { localStorage.removeItem(big[i].key); removed++; } catch (e) {}
        }
        return removed;
    }

    // ── setItem مقاوم در برابر QuotaExceededError ─────────────
    function safeSet(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            if (!isQuotaError(e)) return false;
            prune();
            try {
                localStorage.setItem(key, value);
                return true;
            } catch (e2) {
                if (!isQuotaError(e2)) return false;
                pruneLarge();
                try {
                    localStorage.setItem(key, value);
                    return true;
                } catch (e3) {
                    return false;
                }
            }
        }
    }

    // ── sessionVersion: localStorage + کوکی پشتیبان ───────────
    function setSessionVersion(v) {
        v = v || '';
        safeSet('sessionVersion', v);
        try {
            document.cookie = COOKIE_NAME + '=' + encodeURIComponent(v) +
                '; path=/; max-age=31536000; SameSite=Lax';
        } catch (e) {}
    }

    function getSessionVersion() {
        try {
            var v = localStorage.getItem('sessionVersion');
            if (v !== null) return v;
        } catch (e) {}
        try {
            var m = document.cookie.match(/(?:^|;\s*)sv=([^;]*)/);
            if (m) return decodeURIComponent(m[1]);
        } catch (e) {}
        return null;
    }

    function clearSessionVersion() {
        try { localStorage.removeItem('sessionVersion'); } catch (e) {}
        try {
            document.cookie = COOKIE_NAME + '=; path=/; max-age=0; SameSite=Lax';
        } catch (e) {}
    }

    window.StorageHealth = {
        isQuotaError: isQuotaError,
        prune: prune,
        pruneLarge: pruneLarge,
        safeSet: safeSet,
        setSessionVersion: setSessionVersion,
        getSessionVersion: getSessionVersion,
        clearSessionVersion: clearSessionVersion
    };

    // ── خودترمیمیِ سراسری: هر setItem در کل اپ ─────────────────
    // اگر جایی از برنامه به‌خاطر پر بودن حافظه خطا بدهد، اول
    // کش‌های دورریز پاک می‌شوند و نوشتن دوباره تلاش می‌شود.
    try {
        var _origSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
            try {
                return _origSetItem.call(this, key, value);
            } catch (e) {
                if (this === window.localStorage && isQuotaError(e)) {
                    prune();
                    try {
                        return _origSetItem.call(this, key, value);
                    } catch (e2) {
                        pruneLarge();
                        return _origSetItem.call(this, key, value);
                    }
                }
                throw e;
            }
        };
    } catch (e) {}
})();
