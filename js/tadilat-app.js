/* ============================================================
   js/tadilat-app.js — منطق مینی‌اپ «ارسال تعدیلات» (نسخهٔ ۲)

   چهار باکس:
     ۱) اسم — نوشتاری یا صوتی (🎤)
     ۲) تعدیلات — عکس/PDF/Word/هر فرمت صوتی، چندتایی
     ۳) توضیحات
     ۴) وضعیت — دریافت شد ← شروع شد ← در حال انجام ← آماده تحویل
        + زمان تحویل + فایل‌های آمادهٔ دانلود

   چرا Supabase SDK استفاده نشده؟
     • بدون وابستگی به CDN (داخل webview تلگرام مهم است)
     • آپلود با XMLHttpRequest تا «نوار پیشرفت واقعی» داشته باشیم
   ============================================================ */

(function () {
  'use strict';

  var APP_V = window.TADILAT_APP_V || '2.0.0';

  var BUCKET = 'student-documents';
  var PREFIX = 'tadilat';
  var MAX_FILE_BYTES = 50 * 1024 * 1024;
  var LS_IDENTITY = 'tadilat_app_identity_v2';
  var SS_STUDENTS = 'tadilat_app_students_v2';

  // ══════════════════════════════════════════════════════════
  // ابزارهای عمومی
  // ══════════════════════════════════════════════════════════
  function $(id) { return document.getElementById(id); }
  function show(el) { if (el) el.classList.remove('hidden'); }
  function hide(el) { if (el) el.classList.add('hidden'); }
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fa(v) {
    return String(v == null ? '' : v).replace(/[0-9]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[d]; });
  }
  function bytes(n) {
    n = Number(n) || 0;
    if (n < 1024) return fa(n) + ' بایت';
    if (n < 1048576) return fa((n / 1024).toFixed(1)) + ' کیلوبایت';
    return fa((n / 1048576).toFixed(1)) + ' مگابایت';
  }
  function uuid() {
    try {
      if (window.crypto && window.crypto.randomUUID) {
        return window.crypto.randomUUID().replace(/-/g, '');
      }
    } catch (e) { /* نادیده */ }
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function mmss(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return fa(m + ':' + ('0' + s).slice(-2));
  }

  // ── نام امن Storage (فقط ASCII) ────────────────────────────
  var TR = {
    'آ': 'a', 'أ': 'a', 'إ': 'a', 'ا': 'a', 'ب': 'b', 'پ': 'p', 'ت': 't', 'ث': 's',
    'ج': 'j', 'چ': 'ch', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'z', 'ر': 'r', 'ز': 'z',
    'ژ': 'zh', 'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'z', 'ط': 't', 'ظ': 'z', 'ع': 'a',
    'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ک': 'k', 'گ': 'g', 'ل': 'l', 'م': 'm',
    'ن': 'n', 'و': 'v', 'ؤ': 'v', 'ه': 'h', 'ة': 'h', 'ي': 'y', 'ی': 'y', 'ئ': 'y',
    'ء': '', '\u200c': '_', '\u200e': '', '\u200f': ''
  };
  function safeKey(value, fallback) {
    var out = '', text = String(value == null ? '' : value);
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (Object.prototype.hasOwnProperty.call(TR, ch)) out += TR[ch];
      else if (/[A-Za-z0-9._-]/.test(ch)) out += ch;
      else if (/\s/.test(ch)) out += '_';
    }
    out = out.replace(/_{2,}/g, '_').replace(/^_+|_+$/g, '');
    return out || (fallback || 'file');
  }

  // ── نرمال‌سازی نام فارسی ───────────────────────────────────
  function normName(v) {
    if (!v) return '';
    var t = String(v).trim()
      .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
      .replace(/[\u200b-\u200f\u202a-\u202e]/g, ' ');
    var map = { 'ي': 'ی', 'ك': 'ک', 'ۀ': 'ه', 'ة': 'ه', 'أ': 'ا', 'إ': 'ا',
                'آ': 'ا', 'ٱ': 'ا', 'ؤ': 'و', 'ئ': 'ی' };
    t = t.replace(/[يكۀةأإآٱؤئ]/g, function (c) { return map[c]; });
    return t.replace(/\s+/g, ' ').trim();
  }
  function normKey(v) { return normName(v).replace(/\s/g, ''); }
  function toEnDigits(v) {
    return String(v == null ? '' : v)
      .replace(/[۰-۹]/g, function (d) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); })
      .replace(/[٠-٩]/g, function (d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); });
  }

  // ── تاریخ شمسی ─────────────────────────────────────────────
  var MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
                'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  function jalaliParts(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    var gy = d.getFullYear(), gm = d.getMonth() + 1, gd = d.getDate();
    var gdm = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    var jy = (gy <= 1600) ? 0 : 979;
    gy -= (gy <= 1600) ? 621 : 1600;
    var gy2 = (gm > 2) ? (gy + 1) : gy;
    var days = (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100)
      + Math.floor((gy2 + 399) / 400) - 80 + gd + gdm[gm - 1];
    jy += 33 * Math.floor(days / 12053);
    days %= 12053;
    jy += 4 * Math.floor(days / 1461);
    days %= 1461;
    if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
    var jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
    var jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
    return { jy: jy, jm: jm, jd: jd, hh: d.getHours(), mi: d.getMinutes() };
  }
  function jalaliDate(iso) {
    var p = jalaliParts(iso);
    if (!p) return '—';
    return fa(p.jd) + ' ' + MONTHS[p.jm - 1] + ' ' + fa(p.jy);
  }
  function jalaliDateTime(iso) {
    var p = jalaliParts(iso);
    if (!p) return '—';
    return jalaliDate(iso) + ' — ساعت ' + fa(('0' + p.hh).slice(-2) + ':' + ('0' + p.mi).slice(-2));
  }

  // ══════════════════════════════════════════════════════════
  // تلگرام
  // ══════════════════════════════════════════════════════════
  var TG = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;

  function tgUser() {
    try {
      if (TG && TG.initDataUnsafe && TG.initDataUnsafe.user) return TG.initDataUnsafe.user;
    } catch (e) { /* بیرون از تلگرام */ }
    return null;
  }
  var haptic = {
    ok:  function () { try { TG && TG.HapticFeedback && TG.HapticFeedback.notificationOccurred('success'); } catch (e) {} },
    err: function () { try { TG && TG.HapticFeedback && TG.HapticFeedback.notificationOccurred('error'); } catch (e) {} },
    tap: function () { try { TG && TG.HapticFeedback && TG.HapticFeedback.impactOccurred('light'); } catch (e) {} }
  };

  // ══════════════════════════════════════════════════════════
  // Supabase — REST + Storage
  // ══════════════════════════════════════════════════════════
  function sbUrl() {
    return (typeof SUPABASE_URL !== 'undefined' && SUPABASE_URL)
      ? SUPABASE_URL.replace(/\/+$/, '') : '';
  }
  function sbKey() {
    return (typeof SUPABASE_ANON_KEY !== 'undefined' && SUPABASE_ANON_KEY) || '';
  }
  function sbReady() { return !!(sbUrl() && sbKey()); }
  function sbHeaders(extra) {
    var h = { apikey: sbKey(), Authorization: 'Bearer ' + sbKey() };
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  }

  function sbRest(method, path, body, prefer) {
    var headers = sbHeaders({ 'Content-Type': 'application/json' });
    if (prefer) headers.Prefer = prefer;
    return fetch(sbUrl() + '/rest/v1/' + path, {
      method: method, headers: headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
        if (!res.ok) {
          var msg = (data && (data.message || data.error || data.hint)) || ('HTTP ' + res.status);
          var err = new Error(msg);
          err.status = res.status;
          err.code = data && data.code;
          throw err;
        }
        return data;
      });
    });
  }

  function storageObjectUrl(path) {
    return sbUrl() + '/storage/v1/object/' + BUCKET + '/' +
      path.split('/').map(encodeURIComponent).join('/');
  }

  /** آپلود با نوار پیشرفت واقعی */
  function sbUpload(path, blob, contentType, onProgress) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', storageObjectUrl(path), true);
      xhr.setRequestHeader('apikey', sbKey());
      xhr.setRequestHeader('Authorization', 'Bearer ' + sbKey());
      xhr.setRequestHeader('x-upsert', 'true');
      xhr.setRequestHeader('Content-Type', contentType || 'application/octet-stream');
      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = function (e) {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
      }
      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
          if (onProgress) onProgress(100);
          resolve(true);
        } else {
          var msg = 'HTTP ' + xhr.status;
          try {
            var j = JSON.parse(xhr.responseText);
            msg = j.message || j.error || msg;
          } catch (e) { /* متن ساده */ }
          reject(new Error(msg));
        }
      };
      xhr.onerror = function () { reject(new Error('خطای شبکه در آپلود')); };
      xhr.send(blob);
    });
  }

  /** لینک موقت دانلود (باکت خصوصی است) */
  function sbSignedUrl(path, seconds) {
    return fetch(sbUrl() + '/storage/v1/object/sign/' + BUCKET + '/' +
      path.split('/').map(encodeURIComponent).join('/'), {
      method: 'POST',
      headers: sbHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ expiresIn: seconds || 3600 })
    }).then(function (r) { return r.json(); })
      .then(function (j) {
        return (j && j.signedURL) ? (sbUrl() + '/storage/v1' + j.signedURL) : null;
      })
      .catch(function () { return null; });
  }

  // ══════════════════════════════════════════════════════════
  // فهرست دانشجویان + تطبیق
  // ══════════════════════════════════════════════════════════
  var studentsCache = null;

  function loadStudents() {
    if (studentsCache) return Promise.resolve(studentsCache);
    try {
      var raw = sessionStorage.getItem(SS_STUDENTS);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && p.rows && (Date.now() - p.at) < 30 * 60 * 1000) {
          studentsCache = p.rows;
          return Promise.resolve(studentsCache);
        }
      }
    } catch (e) { /* نادیده */ }
    return sbRest('GET', 'profiles?select=id,name,student_id&role=eq.student&limit=5000')
      .then(function (rows) {
        studentsCache = (rows || []).map(function (r) {
          return { id: r.id, name: r.name || '', key: normKey(r.name),
                   student_id: String(r.student_id || '').trim() };
        });
        try {
          sessionStorage.setItem(SS_STUDENTS, JSON.stringify({ at: Date.now(), rows: studentsCache }));
        } catch (e) { /* حافظه پر */ }
        return studentsCache;
      });
  }

  function matchStudent(rawText) {
    return loadStudents().then(function (rows) {
      var text = String(rawText || '');
      var digits = toEnDigits(text);
      var m = digits.match(/\d{6,}/);
      var studentNo = m ? m[0] : null;

      if (studentNo) {
        for (var i = 0; i < rows.length; i++) {
          if (rows[i].student_id && rows[i].student_id === studentNo) {
            return { student_id: rows[i].id, name: rows[i].name, student_no: studentNo };
          }
        }
      }
      // شناسه‌های غیرعددی مثل GRAD-N018
      var compact = digits.replace(/[\s\u200b-\u200f]+/g, '').toUpperCase();
      if (compact.length >= 5) {
        var best = null;
        for (var j = 0; j < rows.length; j++) {
          var sid = String(rows[j].student_id || '');
          if (sid.length < 5) continue;
          var key = sid.replace(/\s+/g, '').toUpperCase();
          if (compact.indexOf(key) !== -1 && (!best || key.length > best.key.length)) {
            best = { key: key, row: rows[j] };
          }
        }
        if (best) return { student_id: best.row.id, name: best.row.name, student_no: best.row.student_id };
      }

      var nameKey = normKey(digits.replace(/\d+/g, ' '));
      if (!nameKey || nameKey.length < 4) return { student_id: null, name: null, student_no: studentNo };

      var exact = rows.filter(function (r) { return r.key === nameKey; });
      if (exact.length === 1) {
        return { student_id: exact[0].id, name: exact[0].name, student_no: studentNo };
      }
      var partial = [];
      rows.forEach(function (r) {
        if (!r.key || r.key.length < 4) return;
        if (nameKey.indexOf(r.key) !== -1 || r.key.indexOf(nameKey) !== -1) {
          var ratio = Math.min(r.key.length, nameKey.length) / Math.max(r.key.length, nameKey.length);
          if (ratio >= 0.6) partial.push({ ratio: ratio, row: r });
        }
      });
      if (partial.length) {
        partial.sort(function (a, b) { return b.ratio - a.ratio; });
        if (partial.length === 1 || partial[1].ratio < partial[0].ratio) {
          return { student_id: partial[0].row.id, name: partial[0].row.name, student_no: studentNo };
        }
      }
      return { student_id: null, name: null, student_no: studentNo };
    });
  }

  // ══════════════════════════════════════════════════════════
  // مسیریابی خودکار: دانشجو → نویسندهٔ مربوطه
  //
  // زنجیره (بر اساس ساختار واقعی همین دیتابیس):
  //   ۱) دانشجو با نام/شمارهٔ دانشجویی در profiles پیدا می‌شود
  //   ۲) سفارش‌های او در orders با تطبیق «نام» یا student_id پیدا می‌شود
  //      (در این دیتابیس orders.student_id خالی است و فقط student_name پر است)
  //   ۳) assigned_agent_id همان سفارش = نویسندهٔ مربوطه
  //   ۴) اگر سفارشی نبود → بدون نویسنده می‌ماند و در «استخر عمومی» می‌افتد
  // ══════════════════════════════════════════════════════════
  var ordersCache = null;
  var agentsCache = null;

  function loadOrders() {
    if (ordersCache) return Promise.resolve(ordersCache);
    try {
      var raw = sessionStorage.getItem('tadilat_orders_v1');
      if (raw) {
        var p = JSON.parse(raw);
        if (p && p.rows && (Date.now() - p.at) < 10 * 60 * 1000) {
          ordersCache = p.rows;
          return Promise.resolve(ordersCache);
        }
      }
    } catch (e) { /* نادیده */ }

    return sbRest('GET', 'orders?select=id,student_id,student_name,assigned_agent_id,created_at' +
      '&assigned_agent_id=not.is.null&order=created_at.desc&limit=1000')
      .then(function (rows) {
        ordersCache = (rows || []).map(function (o) {
          return {
            id: o.id,
            student_id: o.student_id || null,
            name_key: normKey(o.student_name),
            agent_id: o.assigned_agent_id || null,
            created_at: o.created_at || ''
          };
        });
        try {
          sessionStorage.setItem('tadilat_orders_v1',
            JSON.stringify({ at: Date.now(), rows: ordersCache }));
        } catch (e) { /* حافظه پر */ }
        return ordersCache;
      })
      .catch(function (e) {
        console.warn('orders load failed', e);
        ordersCache = [];
        return ordersCache;
      });
  }

  function loadAgents() {
    if (agentsCache) return Promise.resolve(agentsCache);
    return sbRest('GET', 'profiles?select=id,name&role=eq.agent&limit=200')
      .then(function (rows) {
        agentsCache = {};
        (rows || []).forEach(function (a) { agentsCache[a.id] = a.name || a.id; });
        return agentsCache;
      })
      .catch(function () { agentsCache = {}; return agentsCache; });
  }

  /**
   * نویسندهٔ مربوط به این دانشجو را پیدا می‌کند.
   * خروجی: {agent_id, agent_name, order_id} یا null
   */
  function resolveWriter(studentId, studentName) {
    var key = normKey(studentName);
    return Promise.all([loadOrders(), loadAgents()]).then(function (res) {
      var orders = res[0], agents = res[1];
      var hits = orders.filter(function (o) {
        if (!o.agent_id) return false;
        // دقیق‌ترین راه: شناسهٔ دانشجو روی خود سفارش
        if (studentId && o.student_id && o.student_id === studentId) return true;
        if (!key || key.length < 4 || !o.name_key || o.name_key.length < 4) return false;
        // تطبیق نام (املاهای عربی/فارسی و نیم‌فاصله یکسان‌سازی شده‌اند)
        if (o.name_key === key) return true;
        if (o.name_key.indexOf(key) !== -1 || key.indexOf(o.name_key) !== -1) {
          var ratio = Math.min(o.name_key.length, key.length) / Math.max(o.name_key.length, key.length);
          return ratio >= 0.75;
        }
        return false;
      });
      if (!hits.length) return null;
      // تازه‌ترین سفارش تعیین‌کننده است
      hits.sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); });
      var top = hits[0];
      return {
        agent_id: top.agent_id,
        agent_name: agents[top.agent_id] || top.agent_id,
        order_id: top.id
      };
    });
  }

  // ══════════════════════════════════════════════════════════
  // وضعیت
  // ══════════════════════════════════════════════════════════
  var state = {
    identity: null,
    queue: [],
    busy: false,
    voiceBlob: null,
    voiceUrl: null,
    voiceText: '',
    voiceNameSource: null,
    recording: false,
    tab: 'send',
    hasRequest: false,
    writer: null,         // {agent_id, agent_name, order_id} — نویسندهٔ مربوطه
    matched: null,        // {id, name, student_no} — دانشجوی تشخیص/انتخاب‌شده
    voiceHeard: '',       // متنی که از ویس فهمیدیم
    voiceDone: false      // آیا ویس اسم ضبط شده است
  };

  // ── تب‌ها: ارسال / وضعیت / راهنما ─────────────────────────
  function setTab(name) {
    state.tab = name;
    ['send', 'status', 'help'].forEach(function (t) {
      var view = $('view-' + t);
      if (view) { if (t === name) show(view); else hide(view); }
      var tab = $('tab-' + t);
      if (tab) tab.classList.toggle('tab-active', t === name);
    });
    updateSubmitBar();
    if (name === 'status') loadStatus();
    // در برخی webviewها scrollTo نیست — نباید کل تب را خراب کند
    try {
      if (typeof window.scrollTo === 'function') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (e) { /* نادیده */ }
  }

  function updateSubmitBar() {
    var bar = $('submit-bar');
    if (!bar) return;
    var onSend = state.tab === 'send' && !!state.identity;
    // داخل تب ارسال، فرم فایل باید باز باشد
    if (onSend) show(bar); else hide(bar);
  }

  var toastTimer = null;
  function toast(message, kind) {
    var el = $('global-error');
    if (!el) return;
    el.className = 'banner ' + (kind === 'ok' ? 'banner-warn' : 'banner-error');
    el.innerHTML = '<span>' + esc(message) + '</span>';
    show(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { hide(el); }, kind === 'ok' ? 5000 : 9000);
  }
  function blocker(text) {
    var b = $('blocker');
    if (text === false) { hide(b); return; }
    $('blocker-text').textContent = text || 'در حال ارسال…';
    show(b);
  }

  // ══════════════════════════════════════════════════════════
  // باکس ۱ — نام (نوشتاری + صوتی)
  // ══════════════════════════════════════════════════════════
  var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  var mediaRecorder = null, mediaStream = null, chunks = [], recTimer = null, recSeconds = 0, speech = null;

  function speakSupported() { return !!SpeechRec; }

  function startRecording() {
    if (state.recording) return;
    state.recording = true;
    chunks = [];
    recSeconds = 0;
    state.voiceText = '';
    state.voiceNameSource = null;

    var micBtn = $('btn-mic');
    micBtn.classList.add('recording');
    micBtn.innerHTML = '<i class="fas fa-stop"></i>';

    show($('voice-box'));
    $('voice-box').classList.remove('idle');
    hide($('btn-voice-clear'));
    show($('btn-voice-stop'));
    hide($('voice-audio'));
    $('voice-title').textContent = 'در حال ضبط…';
    $('voice-timer').textContent = mmss(0);
    $('voice-text').textContent = speakSupported() ? '🎧 گوش می‌دهم…' : '';
    $('voice-text').className = 'voice-text';

    // ── ۱. ضبط صدا (همیشه؛ خروجی برای پیوست شدن به درخواست) ──
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(function (stream) {
          mediaStream = stream;
          var types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus',
                       'audio/mp4', ''];
          var mime = '';
          for (var i = 0; i < types.length; i++) {
            if (!types[i] || (window.MediaRecorder && MediaRecorder.isTypeSupported(types[i]))) {
              mime = types[i]; break;
            }
          }
          try {
            mediaRecorder = mime ? new MediaRecorder(stream, { mimeType: mime })
                                 : new MediaRecorder(stream);
          } catch (e) {
            mediaRecorder = new MediaRecorder(stream);
          }
          mediaRecorder.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
          mediaRecorder.onstop = finishRecording;
          mediaRecorder.start();
        })
        .catch(function (e) {
          console.warn('mic error', e);
          $('voice-text').textContent =
            '⚠️ دسترسی به میکروفن نشد. اگر می‌توانی، اجازهٔ میکروفن را بده یا نامت را تایپ کن.';
          $('voice-text').className = 'voice-text bad';
        });
    } else {
      $('voice-text').textContent = '⚠️ این دستگاه ضبط صدا را پشتیبانی نمی‌کند؛ نامت را تایپ کن.';
      $('voice-text').className = 'voice-text bad';
    }

    // ── ۲. تشخیص گفتار (اختیاری؛ فقط برای پر کردن خودکار کادر نام) ──
    if (SpeechRec) {
      try {
        speech = new SpeechRec();
        speech.lang = 'fa-IR';
        speech.continuous = true;
        speech.interimResults = true;
        speech.onresult = function (ev) {
          var text = '';
          for (var i = 0; i < ev.results.length; i++) text += ev.results[i][0].transcript;
          text = normName(text);
          if (text) {
            state.voiceText = text;
            state.voiceHeard = text;
            state.voiceNameSource = 'voice_stt';
            $('in-name').value = text;
            $('voice-text').textContent = '🗣 ' + text;
            $('voice-text').className = 'voice-text ok';
            // همین حالا با نزدیک‌ترین نام در profiles تطبیق بده
            matchHeardName(text);
          }
        };
        speech.onerror = function (ev) {
          console.warn('speech error', ev.error);
          if (!state.voiceText) {
            $('voice-text').textContent =
              '🎤 ویس ضبط شد. تشخیص خودکار روی این دستگاه کار نکرد — نامت را از فهرست انتخاب کن.';
            $('voice-text').className = 'voice-text bad';
            showPicker('تشخیص خودکار ممکن نشد؛ اسمت را از فهرست انتخاب کن');
          }
        };
        speech.onend = function () { speech = null; };
        speech.start();
      } catch (e) {
        console.warn('speech start failed', e);
        speech = null;
      }
    } else {
      $('voice-text').textContent =
        '🎤 ویس ضبط شد (این مرورگر تشخیص گفتار ندارد) — اسمت را از فهرست انتخاب کن.';
      $('voice-text').className = 'voice-text';
    }

    recTimer = setInterval(function () {
      recSeconds++;
      $('voice-timer').textContent = mmss(recSeconds);
      if (recSeconds >= 30) stopRecording();
    }, 1000);
  }

  function stopRecording() {
    if (!state.recording) return;
    state.recording = false;
    clearInterval(recTimer);
    $('btn-mic').classList.remove('recording');
    $('btn-mic').innerHTML = '<i class="fas fa-microphone"></i>';
    $('voice-title').textContent = 'ضبط تمام شد';
    $('voice-box').classList.add('idle');

    if (speech) { try { speech.stop(); } catch (e) {} speech = null; }
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.stop(); } catch (e) { finishRecording(); }
    } else {
      finishRecording();
    }
  }

  function finishRecording() {
    if (mediaStream) {
      try { mediaStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      mediaStream = null;
    }
    if (chunks.length) {
      state.voiceBlob = new Blob(chunks, { type: chunks[0].type || 'audio/webm' });
      if (state.voiceUrl) URL.revokeObjectURL(state.voiceUrl);
      state.voiceUrl = URL.createObjectURL(state.voiceBlob);
      var audio = $('voice-audio');
      audio.src = state.voiceUrl;
      show(audio);
      show($('btn-voice-clear'));
    }
    if (!state.voiceText && !state.voiceNameSource) {
      state.voiceNameSource = state.voiceBlob ? 'voice' : null;
    }
    state.voiceDone = !!state.voiceBlob || !!state.voiceText;
    $('btn-voice-stop').classList.add('hidden');
    if (!state.voiceText && state.voiceBlob) {
      $('voice-text').textContent = '🎤 ویس اسمت ضبط شد و همراه درخواست ذخیره می‌شود.';
      $('voice-text').className = 'voice-text';
    }
    // اگر تشخیص گفتار در دسترس نبود، فهرست انتخاب را باز کن
    if (!state.voiceHeard && !SpeechRec && state.voiceBlob) {
      showPicker('این مرورگر تشخیص خودکار ندارد؛ اسمت را از فهرست انتخاب کن');
    }
  }

  // ══════════════════════════════════════════════════════════
  // تطبیق نام شنیده‌شده با نزدیک‌ترین دانشجو در profiles
  // ══════════════════════════════════════════════════════════
  function showResolved(student, heard) {
    state.matched = {
      id: student.id,
      name: student.name,
      student_no: student.student_no || null
    };
    var box = $('name-resolved');
    box.className = 'match-box match-ok';
    $('name-resolved-text').innerHTML =
      (heard ? '🗣 شنیدم: «' + esc(heard) + '»<br>' : '') +
      '✅ اسم تو: <b>' + esc(student.name) + '</b>' +
      (student.student_no ? ' <span class="hint">(' + esc(student.student_no) + ')</span>' : '');
    show(box);
    hide($('name-picker'));
    $('in-name').value = student.name;
    $('in-no').value = student.student_no || $('in-no').value;
    haptic.ok();
  }

  /** نزدیک‌ترین نام را در فهرست دانشجوها پیدا می‌کند */
  function matchHeardName(heard) {
    return loadStudents().then(function (rows) {
      var key = normKey(heard);
      if (!key || key.length < 3) { showPicker('اسمت را از فهرست انتخاب کن'); return null; }
      var exact = rows.filter(function (r) { return r.key === key; });
      if (exact.length === 1) {
        showResolved({ id: exact[0].id, name: exact[0].name, student_no: exact[0].student_id }, heard);
        return exact[0];
      }
      var best = null;
      rows.forEach(function (r) {
        if (!r.key || r.key.length < 3) return;
        var ratio = 0, i;
        if (r.key === key) ratio = 1;
        else if (r.key.indexOf(key) !== -1 || key.indexOf(r.key) !== -1) {
          ratio = Math.min(r.key.length, key.length) / Math.max(r.key.length, key.length) * 0.95;
        } else {
          // شباهت حرف‌به‌حرف (برای خطای تشخیص گفتار)
          i = lcs(r.key, key);
          ratio = (2 * i) / (r.key.length + key.length);
        }
        if (!best || ratio > best.ratio) best = { ratio: ratio, row: r };
      });
      if (best && best.ratio >= 0.62) {
        showResolved({ id: best.row.id, name: best.row.name, student_no: best.row.student_id }, heard);
        return best.row;
      }
      // مطمئن نبود → فهرست پیشنهادی را نشان بده
      showPicker('مطمئن نشدم؛ اسمت را از فهرست انتخاب کن', heard);
      return null;
    });
  }

  /** طول بلندترین زیررشتهٔ مشترک */
  function lcs(a, b) {
    var m = a.length, n = b.length;
    if (!m || !n) return 0;
    var prev = new Array(n + 1).fill(0), cur = new Array(n + 1).fill(0), i, j;
    for (i = 1; i <= m; i++) {
      for (j = 1; j <= n; j++) {
        cur[j] = (a[i - 1] === b[j - 1]) ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
      }
      var t = prev; prev = cur; cur = t;
    }
    return prev[n];
  }

  // ── فهرست انتخاب دستی ────────────────────────────────────
  function showPicker(hint, seed) {
    var box = $('name-picker');
    if (!box) return;
    if (hint) $('picker-hint-text').textContent = hint;
    show(box);
    hide($('name-resolved'));
    state.matched = null;
    renderNameList(seed || $('name-search').value || '');
  }

  function renderNameList(query) {
    var list = $('name-list');
    if (!list) return;
    var q = normKey(query || '');
    loadStudents().then(function (rows) {
      var items = rows;
      if (q) {
        items = rows.filter(function (r) {
          return r.key.indexOf(q) !== -1 ||
                 String(r.student_id || '').indexOf(q) !== -1;
        });
      }
      if (!items.length) {
        list.innerHTML = '<p class="name-empty">دانشجویی با این نام پیدا نشد — می‌توانی خودت بنویسی</p>';
        return;
      }
      list.innerHTML = items.slice(0, 60).map(function (r) {
        return '<button class="name-item" type="button" data-pick="' + esc(r.id) + '">' +
          '<span>' + esc(r.name) + '</span>' +
          '<span class="ni-no">' + esc(r.student_id || '') + '</span></button>';
      }).join('') +
      (items.length > 60
        ? '<p class="name-empty">و ' + fa(items.length - 60) + ' مورد دیگر — دقیق‌تر جستجو کن</p>'
        : '');
    });
  }

  function pickStudent(id) {
    loadStudents().then(function (rows) {
      var hit = rows.filter(function (r) { return r.id === id; })[0];
      if (hit) showResolved({ id: hit.id, name: hit.name, student_no: hit.student_id }, '');
    });
  }

  function clearResolved() {
    state.matched = null;
    hide($('name-resolved'));
    showPicker('اسمت را از فهرست انتخاب کن یا خودت بنویس');
  }

  function clearVoice() {
    if (state.voiceUrl) URL.revokeObjectURL(state.voiceUrl);
    state.voiceBlob = null;
    state.voiceUrl = null;
    state.voiceText = '';
    state.voiceNameSource = null;
    state.voiceHeard = '';
    state.voiceDone = false;
    hide($('voice-box'));
    hide($('btn-voice-clear'));
    hide($('name-resolved'));
    hide($('name-picker'));
    $('voice-audio').src = '';
    $('voice-text').textContent = '';
    $('voice-title').textContent = 'در حال ضبط…';
  }

  // ══════════════════════════════════════════════════════════
  // هویت
  // ══════════════════════════════════════════════════════════
  function loadIdentity() {
    try {
      var raw = localStorage.getItem(LS_IDENTITY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* نادیده */ }
    return null;
  }
  function saveIdentity(obj) {
    try { localStorage.setItem(LS_IDENTITY, JSON.stringify(obj)); } catch (e) { /* نادیده */ }
  }

  function showNameCard() {
    setTab('send');
    show($('card-name'));
    hide($('card-files'));
    hide($('card-note'));
    hide($('card-done'));
    hide($('identity-result'));
    hide($('name-resolved'));
    hide($('name-picker'));
    updateSubmitBar();
    var u = tgUser();
    var input = $('in-name');
    if (!input.value && u) input.value = [u.first_name, u.last_name].filter(Boolean).join(' ');
  }

  function renderWhoChip() {
    var id = state.identity || {};
    var linked = !!id.student_id;
    $('who-chip').innerHTML =
      '<span>👤</span><b>' + esc(id.name || '—') + '</b>' +
      (linked ? '<span style="color:#13774f">• متصل به پروفایل</span>'
              : '<span style="color:#8a5600">• در انتظار اتصال کارشناس</span>') +
      (state.writer
        ? '<span>✍️ ' + esc(state.writer.agent_name) + '</span>'
        : '') +
      '<button class="link-btn" data-edit-id="1" type="button">ویرایش</button>';
  }

  function doIdentity() {
    var typed = normName($('in-name').value);
    var no = toEnDigits($('in-no').value).trim();

    // ۱) گفتن اسم الزامی است
    if (!state.voiceDone) {
      toast('🎤 اول روی دکمهٔ میکروفن بزن و اسمت را بگو.');
      try { $('btn-mic').scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
      return;
    }

    // ۲) نام باید مشخص باشد: تطبیق خودکار، انتخاب از فهرست، یا نوشتن
    var chosen = state.matched;
    var name = chosen ? chosen.name : typed;
    if (!name || name.length < 3) {
      showPicker('اسمت را از فهرست انتخاب کن یا خودت بنویس');
      toast('اسمت را انتخاب کن یا بنویس 🙂');
      return;
    }
    if (no && no.replace(/[^0-9A-Za-z]/g, '').length < 4) {
      toast('شمارهٔ دانشجویی معتبر نیست.');
      $('in-no').focus();
      return;
    }

    state.busy = true;
    var btn = $('btn-identity');
    btn.disabled = true;

    // اگر از فهرست انتخاب شده، همان را قطعی می‌گیریم؛ وگرنه دوباره تطبیق می‌زنیم
    var lookup = chosen
      ? Promise.resolve({ student_id: chosen.id, name: chosen.name,
                          student_no: chosen.student_no })
      : matchStudent(name + ' ' + no);

    lookup
      .then(function (res) {
        state.identity = {
          name: name,
          student_no: res.student_no || no || null,
          student_id: res.student_id || null,
          matched_name: res.name || null
        };
        saveIdentity(state.identity);

        var box = $('identity-result');
        if (res.student_id) {
          box.className = 'match-box match-ok';
          box.innerHTML = '✅ <b>' + esc(res.name) + '</b> — پروفایلت پیدا شد؛ تعدیلات به خودت وصل می‌شود.';
        } else {
          box.className = 'match-box match-warn';
          box.innerHTML = '🤔 پروفایلت را پیدا نکردم. اشکالی ندارد — کارشناس‌ها وصلش می‌کنند.' +
            '<br><small>برای اتصال دقیق‌تر، شمارهٔ دانشجویی را بنویس و دوباره ثبت کن.</small>';
        }
        show(box);
        haptic.ok();
        $('hero-title').textContent = 'خوش آمدی، ' + (name.split(' ')[0] || '') + '! 🌟';
        renderHeroPill();
        // مسیریابی: نویسندهٔ مربوط به این دانشجو
        if (state.identity.student_id) {
          resolveWriter(state.identity.student_id, name).then(function (w) {
            state.writer = w;
            renderWhoChip();
            if (w) {
              box.innerHTML += '<br>✍️ نویسندهٔ شما: <b>' + esc(w.agent_name) + '</b>';
            } else {
              box.innerHTML += '<br>📥 کارشناسان آن را به نویسندهٔ مربوطه می‌سپارند.';
            }
          });
        }
        setTimeout(revealForm, 800);
      })
      .catch(function (e) {
        haptic.err();
        toast('بررسی مشخصات ناموفق بود: ' + (e.message || e));
      })
      .then(function () { state.busy = false; btn.disabled = false; });
  }

  function revealForm() {
    hide($('card-name'));
    show($('card-files'));
    show($('card-note'));
    renderWhoChip();
    renderQueue();
    updateSubmitBar();
    loadStatus();
  }

  function renderHeroPill() {
    var u = tgUser();
    var pill = $('hero-pill');
    var avatar = $('hero-avatar');
    var name = (state.identity && state.identity.name) || '';
    if (avatar) {
      // حرف اول نام روی دایرهٔ گرادیانی — مثل طرح مرجع
      avatar.textContent = name ? name.trim().charAt(0) : (u && u.first_name ? u.first_name.charAt(0) : '؟');
    }
    if (!pill) return;
    // کوتاه و خوانا نگه داشته می‌شود تا در سرصفحه بریده نشود
    var bits = [];
    if (u && u.username) bits.push('@' + u.username);
    if (state.identity && state.identity.student_id) bits.push('متصل به پروفایل');
    else if (state.identity && state.identity.student_no) bits.push('شمارهٔ ' + fa(state.identity.student_no));
    pill.textContent = bits.length ? bits.join(' · ') : 'تعدیلاتت رو بفرست';
  }

  function editIdentity() {
    $('in-name').value = state.identity ? state.identity.name : '';
    $('in-no').value = state.identity ? (state.identity.student_no || '') : '';
    state.identity = null;
    try { localStorage.removeItem(LS_IDENTITY); } catch (e) {}
    clearVoice();
    showNameCard();
  }

  // ══════════════════════════════════════════════════════════
  // باکس ۲ — فایل‌ها
  // ══════════════════════════════════════════════════════════
  var ICONS = { image: '🖼', pdf: '📕', word: '📘', sheet: '📗', audio: '🎵', video: '🎬', zip: '🗜', other: '📄' };

  function kindOf(file) {
    var t = (file.type || '').toLowerCase(), n = (file.name || '').toLowerCase();
    if (t.indexOf('image/') === 0) return 'image';
    if (t.indexOf('audio/') === 0) return 'audio';
    if (t.indexOf('video/') === 0) return 'video';
    if (t === 'application/pdf' || /\.pdf$/.test(n)) return 'pdf';
    if (/word|officedocument\.wordprocessing/.test(t) || /\.docx?$/.test(n)) return 'word';
    if (/excel|spreadsheet/.test(t) || /\.xlsx?$/.test(n)) return 'sheet';
    if (/zip|rar|compressed/.test(t) || /\.(zip|rar|7z)$/.test(n)) return 'zip';
    return 'other';
  }
  function kindLabel(kind) {
    return ({ image: 'عکس', pdf: 'PDF', word: 'Word', sheet: 'Excel', audio: 'صدا', video: 'ویدیو', zip: 'فشرده', other: 'فایل' })[kind] || 'فایل';
  }
  function dbKind(kind) {
    if (kind === 'image') return 'photo';
    if (kind === 'audio') return 'audio';
    if (kind === 'video') return 'video';
    return 'document';
  }

  function addFiles(list) {
    var added = 0, rejected = 0;
    Array.prototype.forEach.call(list || [], function (file) {
      if (!file.size || file.size > MAX_FILE_BYTES) { rejected++; return; }
      state.queue.push({
        uid: uuid(), file: file,
        url: (file.type || '').indexOf('image/') === 0 ? URL.createObjectURL(file) : null,
        progress: 0, status: 'pending', error: null
      });
      added++;
    });
    if (rejected) toast('🚫 ' + fa(rejected) + ' فایل رد شد (خالی یا بزرگ‌تر از ' + fa(MAX_FILE_BYTES / 1048576) + ' مگابایت).');
    if (added) haptic.tap();
    renderQueue();
    updateClosingGuard();
  }

  function removeFile(uid) {
    state.queue = state.queue.filter(function (it) {
      if (it.uid === uid) { if (it.url) URL.revokeObjectURL(it.url); return false; }
      return true;
    });
    renderQueue();
    updateClosingGuard();
  }

  function renderQueue() {
    var box = $('queue');
    if (!box) return;
    if (!state.queue.length) { box.innerHTML = ''; return; }
    box.innerHTML = state.queue.map(function (it) {
      var kind = kindOf(it.file);
      var thumb = it.url ? '<img src="' + it.url + '" alt="">' : (ICONS[kind] || '📄');
      var action;
      if (it.status === 'done') action = '<span class="q-ok">✅</span>';
      else if (it.status === 'failed') action = '<span class="q-fail" title="' + esc(it.error || '') + '">❌</span>';
      else if (it.status === 'uploading') action = '<span class="q-ok"><i class="fas fa-spinner fa-spin"></i></span>';
      else action = '<button class="q-remove" data-remove="' + esc(it.uid) + '" type="button">✕</button>';
      var bar = (it.status === 'uploading' || it.status === 'done')
        ? '<div class="q-bar"><i style="width:' + (it.progress || 0) + '%"></i></div>' : '';
      return '<div class="q-item">' +
        '<div class="q-thumb">' + thumb + '</div>' +
        '<div class="q-info"><div class="q-name">' + esc(it.file.name || 'فایل') + '</div>' +
        '<div class="q-meta">' + kindLabel(kind) + ' • ' + bytes(it.file.size) + '</div>' + bar + '</div>' +
        action + '</div>';
    }).join('');
  }

  function updateClosingGuard() {
    if (!TG || !TG.enableClosingConfirmation) return;
    try {
      var pending = state.queue.some(function (i) { return i.status !== 'done'; });
      if (pending) TG.enableClosingConfirmation();
      else if (TG.disableClosingConfirmation) TG.disableClosingConfirmation();
    } catch (e) { /* نادیده */ }
  }

  // ══════════════════════════════════════════════════════════
  // ارسال
  // ══════════════════════════════════════════════════════════
  function storagePath(tgId, requestId, filename) {
    return PREFIX + '/' + (tgId || 'web') + '/' + requestId + '/' +
      uuid().slice(0, 6) + '_' + safeKey(filename, 'file');
  }

  function submit() {
    if (state.busy) return;
    if (!state.identity) { showNameCard(); return; }
    if (!state.queue.length && !state.voiceBlob) {
      toast('🙂 حداقل یک فایل تعدیلات انتخاب کن.');
      return;
    }

    state.busy = true;
    $('btn-submit').disabled = true;
    blocker('دارم آماده می‌کنم…');

    var u = tgUser();
    var tgId = u ? u.id : null;
    var requestId = null;
    var requestCode = null;

    // ۱) اگر ویس اسم داریم، اول آپلودش کن
    var voicePathPromise = Promise.resolve(null);
    if (state.voiceBlob) {
      voicePathPromise = (function () {
        var path = storagePath(tgId, 'name-' + uuid().slice(0, 8),
                               'name.' + (state.voiceBlob.type.indexOf('ogg') !== -1 ? 'ogg' : 'webm'));
        return sbUpload(path, state.voiceBlob, state.voiceBlob.type || 'audio/webm')
          .then(function () { return path; })
          .catch(function () { return null; });
      })();
    }

    // ۰) مسیریابی خودکار: دانشجو → نویسندهٔ مربوطه
    var writerPromise;
    if (state.identity.student_id) {
      writerPromise = resolveWriter(state.identity.student_id, state.identity.name)
        .catch(function () { return null; });
    } else {
      writerPromise = Promise.resolve(null);
    }

    Promise.all([voicePathPromise, writerPromise])
      .then(function (pre) {
        var voicePath = pre[0];
        var writer = pre[1] || state.writer;
        state.writer = writer;

        // ۲) ساخت درخواست — با نویسندهٔ مسیریابی‌شده
        return sbRest('POST', 'tadilat_requests', [{
          source: 'mini_app',
          telegram_user_id: tgId,
          telegram_username: (u && u.username) || null,
          telegram_name: u ? [u.first_name, u.last_name].filter(Boolean).join(' ') : null,
          student_id: state.identity.student_id,
          student_name: state.identity.name,
          student_no: state.identity.student_no,
          name_source: state.voiceNameSource || 'text',
          name_audio_path: voicePath,
          note: ($('in-note').value || '').trim() || null,
          assigned_agent_id: writer ? writer.agent_id : null,
          assigned_agent_name: writer ? writer.agent_name : null,
          routed_at: writer ? new Date().toISOString() : null,
          routed_by: writer ? 'auto' : null,
          routed_note: writer ? ('سفارش ' + writer.order_id) : null,
          status: 'draft'
        }], 'return=representation');
      })
      .then(function (rows) {
        requestId = rows && rows[0] && rows[0].id;
        requestCode = rows && rows[0] && rows[0].code;
        if (!requestId) throw new Error('درخواست ساخته نشد');
        return uploadAll(requestId, tgId);
      })
      .then(function (sum) {
        return sbRest('PATCH', 'tadilat_requests?id=eq.' + encodeURIComponent(requestId),
          { status: 'new', files_count: sum.done, submitted_at: new Date().toISOString() },
          'return=minimal').then(function () { return sum; });
      })
      .then(function (sum) {
        // ۴) اتصال به پروفایل دانشجو:
        //    • مسیر فایل تعدیلات در ستون tadilat_doc (فیلد «تعدیلات» پروفایل)
        //    • و ثبت فایل در بخش «فایل ها» با دستهٔ «تعدیل شده»
        if (state.identity.student_id && sum.primaryPath) {
          var sid = state.identity.student_id;
          var fileName = sum.primaryName || 'تعدیلات';
          var fileType = (fileName.split('.').pop() || '').toLowerCase();
          return Promise.all([
            sbRest('POST', 'student_documents?on_conflict=student_id',
              [{ student_id: sid, tadilat_doc: sum.primaryPath }],
              'resolution=merge-duplicates,return=minimal')
              .catch(function (e) { console.warn('profile doc link failed', e); return null; }),
            sbRest('POST', 'student_files?on_conflict=student_id,category',
              [{
                student_id: sid,
                category: 'تعدیل شده',           // بخش «فایل ها» در ویرایش پروفایل
                file_name: fileName,
                file_path: sum.primaryPath,
                display_url: null,
                file_type: fileType || null,
                file_size_text: sum.primarySize ? bytes(sum.primarySize) : null,
                uploaded_by: 'mini_app',
                uploaded_by_name: state.identity.name || 'دانشجو'
              }],
              'resolution=merge-duplicates,return=minimal')
              .catch(function (e) { console.warn('student_files (تعدیل شده) failed', e); return null; })
          ]).then(function () { return sum; });
        }
        return sum;
      })
      .then(function (sum) {
        blocker(false);
        haptic.ok();
        // ویس نام مصرف شد — نباید به درخواست بعدی بچسبد
        clearVoice();
        hide($('card-files'));
        hide($('card-note'));
        showDone(requestId, requestCode, sum);
        updateSubmitBar();
        setTab('status');
        if (sum.failed) toast('⚠️ ' + fa(sum.failed) + ' فایل ارسال نشد؛ می‌توانی دوباره بفرستی.');
      })
      .catch(function (e) {
        blocker(false);
        haptic.err();
        console.error(e);
        var msg = (e && e.message) ? e.message : String(e);
        if (/does not exist|schema cache|PGRST205/i.test(msg)) {
          msg = 'جدول‌های تعدیلات در دیتابیس ساخته نشده‌اند. فایل supabase/tadilat_telegram_migration.sql را اجرا کن.';
        }
        toast('ارسال نشد: ' + msg);
      })
      .then(function () {
        state.busy = false;
        $('btn-submit').disabled = false;
      });
  }

  function uploadAll(requestId, tgId) {
    var pending = state.queue.filter(function (i) { return i.status !== 'done'; });

    function summary() {
      var doneItems = state.queue.filter(function (i) { return i.status === 'done'; });
      var primaryItem = null;
      for (var i = 0; i < doneItems.length; i++) {
        if (doneItems[i].kindDb === 'photo' || doneItems[i].kindDb === 'document') {
          primaryItem = doneItems[i]; break;
        }
      }
      if (!primaryItem && doneItems.length) primaryItem = doneItems[0];
      return {
        total: state.queue.length,
        done: doneItems.length,
        failed: state.queue.filter(function (i) { return i.status === 'failed'; }).length,
        primaryPath: primaryItem ? primaryItem.storagePath : null,
        primaryName: primaryItem && primaryItem.file ? primaryItem.file.name : null,
        primarySize: primaryItem && primaryItem.file ? primaryItem.file.size : null
      };
    }

    function step(i) {
      if (i >= pending.length) return Promise.resolve(summary());
      var item = pending[i];
      item.status = 'uploading'; item.progress = 0;
      renderQueue();

      var path = storagePath(tgId, requestId, item.file.name);
      var kindDb = dbKind(kindOf(item.file));
      blocker('ارسال فایل ' + fa(i + 1) + ' از ' + fa(pending.length) + '…');

      return sbUpload(path, item.file, item.file.type || 'application/octet-stream',
        function (p) { item.progress = p; renderQueue(); })
        .then(function () {
          return sbRest('POST', 'tadilat_files', [{
            request_id: requestId, kind: kindDb,
            file_name: item.file.name || 'file', storage_path: path,
            mime_type: item.file.type || null, file_size: item.file.size,
            duration: null, caption: null, telegram_file_id: null
          }], 'return=minimal');
        })
        .then(function () {
          item.status = 'done'; item.progress = 100;
          item.storagePath = path; item.kindDb = kindDb;
          return sbRest('PATCH', 'tadilat_requests?id=eq.' + encodeURIComponent(requestId),
            { files_count: summary().done }, 'return=minimal').catch(function () { return null; });
        })
        .catch(function (e) {
          item.status = 'failed';
          item.error = (e && e.message) ? e.message : String(e);
        })
        .then(function () { renderQueue(); return step(i + 1); });
    }
    return step(0);
  }

  // ══════════════════════════════════════════════════════════
  // پایان
  // ══════════════════════════════════════════════════════════
  function showDone(requestId, requestCode, sum) {
    show($('card-done'));
    $('done-name').textContent = state.identity ? state.identity.name : '—';
    $('done-count').textContent = fa(sum.done);
    // کد پیگیری ۵ رقمی (اگر تریگر دیتابیس کد را برگردانده باشد)
    $('done-code').textContent = requestCode ? fa(requestCode) : '—';
    updateClosingGuard();
  }

  function startAnother() {
    state.queue = state.queue.filter(function (it) {
      if (it.status === 'failed') { it.status = 'pending'; it.progress = 0; return true; }
      if (it.url) URL.revokeObjectURL(it.url);
      return false;
    });
    $('in-note').value = '';
    clearVoice();
    hide($('card-done'));
    show($('card-files'));
    show($('card-note'));
    renderQueue();
    setTab('send');
    loadStatus();
  }

  // ══════════════════════════════════════════════════════════
  // باکس ۴ — وضعیت
  // ══════════════════════════════════════════════════════════
  var STAGES = [
    { key: 'new',         title: 'دریافت شد',    emoji: '📥', field: 'submitted_at' },
    { key: 'started',     title: 'شروع شد',      emoji: '🚀', field: 'started_at' },
    { key: 'in_progress', title: 'در حال انجام', emoji: '✍️', field: null },
    { key: 'ready',       title: 'آماده تحویل',  emoji: '🎁', field: 'ready_at' },
    { key: 'completed',   title: 'تحویل شد',     emoji: '✅', field: 'completed_at' }
  ];
  var STATUS_FA = {
    draft: 'ناتمام', new: 'دریافت شد', started: 'شروع شد',
    in_progress: 'در حال انجام', ready: 'آماده تحویل',
    completed: 'تحویل شد', rejected: 'رد شد'
  };

  function statusIndex(status) {
    for (var i = 0; i < STAGES.length; i++) if (STAGES[i].key === status) return i;
    return -1;
  }

  function identityFilter() {
    if (state.identity && state.identity.student_id) {
      return 'student_id=eq.' + encodeURIComponent(state.identity.student_id);
    }
    var u = tgUser();
    if (u) return 'telegram_user_id=eq.' + encodeURIComponent(u.id);
    return null;
  }

  function loadStatus() {
    var filter = identityFilter();
    var card = $('card-status');
    var empty = $('card-empty');
    if (!filter) {
      hide(card); show(empty);
      state.hasRequest = false;
      return;
    }

    // ۶ مورد آخر را می‌گیریم: اولی برای نمودار وضعیت، بقیه برای «ارسال‌های قبلی»
    sbRest('GET', 'tadilat_requests?select=*&' + filter + '&order=created_at.desc&limit=6')
      .then(function (rows) {
        if (!rows || !rows.length) {
          hide(card); show(empty);
          state.hasRequest = false;
          return null;
        }
        state.hasRequest = true;
        hide(empty);
        var req = rows[0];
        return sbRest('GET', 'tadilat_files?select=*&request_id=eq.' +
          encodeURIComponent(req.id) + '&order=created_at')
          .then(function (files) { renderStatus(req, files || []); return rows; });
      })
      .then(function (rows) { if (rows) renderMiniHistory(rows); })
      .catch(function (e) {
        console.warn('status load failed', e);
        hide(card);
      });
  }

  function renderStatus(req, files) {
    show($('card-status'));
    var idx = statusIndex(req.status);
    var rejected = req.status === 'rejected';
    var deliverables = files.filter(function (f) { return f.kind === 'deliverable'; });

    // نویسندهٔ درخواست — در سرتیتر کارت وضعیت
    if ($('status-sub')) {
      $('status-sub').textContent = (req.code ? 'کد پیگیری ' + fa(req.code) + ' · ' : '') +
        (req.assigned_agent_name
          ? ('✍️ نویسنده: ' + req.assigned_agent_name)
          : '⏳ در انتظار تعیین نویسنده');
    }

    // ── کاشی‌های آماری ──
    $('stat-files').textContent = fa(req.files_count || files.length || 0);
    $('stat-status').textContent = STATUS_FA[req.status] || req.status || '—';
    $('stat-due').textContent = req.due_at ? jalaliDate(req.due_at) : 'تعیین نشده';
    $('stat-ready').textContent = fa(deliverables.length);

    // ── نوار پیشرفت (مثل نوار XP در طرح مرجع) ──
    var done = rejected ? 1 : Math.max(1, idx + 1);
    if ($('progress-fill')) {
      $('progress-fill').style.width = Math.round((done / STAGES.length) * 100) + '%';
    }
    if ($('progress-value')) {
      $('progress-value').textContent = fa(done) + ' از ' + fa(STAGES.length) + ' مرحله';
    }

    // ── فیلترهای قرصی مراحل (مراحل طي‌شده فعال‌اند) ──
    if ($('stage-pills')) {
      $('stage-pills').innerHTML = STAGES.map(function (s, i) {
        var on = rejected ? (i === 0) : (i <= idx);
        return '<button class="pill' + (on ? ' on' : '') + '" type="button">' +
          '<span>' + s.emoji + ' ' + esc(s.title) + '</span></button>';
      }).join('');
    }

    // ── نمودار مراحل ──
    // مرحلهٔ وضعیت فعلی «انجام‌شده» و برجسته است؛ بقیه در انتظار.
    var html = '';
    STAGES.forEach(function (stage, i) {
      var cls = 'step';
      if (!rejected) {
        if (i <= idx) cls += ' done';
        if (i === idx) cls += ' current';
      } else if (i === 0) {
        cls += ' done';
      }
      var when = stage.field && req[stage.field] ? jalaliDateTime(req[stage.field]) : '';
      if (i === 2 && !when && req.updated_at && idx >= 2) when = jalaliDateTime(req.updated_at);
      html += '<div class="' + cls + '">' +
        '<div class="step-dot">' + (i <= idx && !rejected ? '✓' : fa(i + 1)) + '</div>' +
        '<div class="step-body"><div class="step-title">' +
          esc(stage.title) + '<span class="step-emoji">' + stage.emoji + '</span></div>' +
          (when ? '<div class="step-time">' + esc(when) + '</div>' : '') +
        '</div></div>';
    });
    if (rejected) {
      html += '<div class="step"><div class="step-dot" style="background:#ffe4e6;color:#e11d48">✕</div>' +
        '<div class="step-body"><div class="step-title" style="color:#9f1239">رد شد</div>' +
        (req.agent_note ? '<div class="step-time">' + esc(req.agent_note) + '</div>' : '') +
        '</div></div>';
    }
    $('tracker').innerHTML = html;

    // ── زمان تحویل ──
    if (req.due_at) {
      $('due-value').textContent = jalaliDateTime(req.due_at);
      show($('due-box'));
    } else {
      hide($('due-box'));
    }

    // ── فایل‌های آمادهٔ دانلود (کارت‌های محتوایی سبک مرجع) ──
    if (deliverables.length) {
      $('deliverables-list').innerHTML = deliverables.map(function (f) {
        var name = f.file_name || 'فایل';
        var kind = /\.pdf$/i.test(name) ? 'pdf'
          : /\.(docx?|rtf)$/i.test(name) ? 'word'
          : /\.(xlsx?|csv)$/i.test(name) ? 'sheet'
          : /\.(zip|rar|7z)$/i.test(name) ? 'zip'
          : /^image\//.test(f.mime_type || '') ? 'image'
          : /^audio\//.test(f.mime_type || '') ? 'audio'
          : /^video\//.test(f.mime_type || '') ? 'video' : 'other';
        var icon = ICONS[kind] || '📄';
        var grad = kind === 'pdf' ? 'g-peach'
          : kind === 'word' ? 'g-sky'
          : kind === 'sheet' ? 'g-mint'
          : kind === 'audio' ? 'g-lav' : 'g-sky';
        return '<div class="dl-item">' +
          '<span class="tile-3d lg ' + grad + ' dl-icon">' + icon + '</span>' +
          '<div class="dl-info"><div class="dl-name">' + esc(name) + '</div>' +
          '<div class="dl-size">' + kindLabel(kind) + ' · ' + bytes(f.file_size) + '</div></div>' +
          '<button class="dl-btn" data-download="' + esc(f.storage_path || '') +
          '" data-name="' + esc(name) + '" type="button">دانلود</button></div>';
      }).join('');
      show($('deliverables'));
    } else {
      hide($('deliverables'));
    }
  }

  function renderMiniHistory(rows) {
    if (!rows || rows.length < 2) { $('history-mini').innerHTML = ''; return; }
    $('history-mini').innerHTML =
      '<h3 class="deliverables-title" style="margin-top:14px">🕘 ارسال‌های قبلی</h3>' +
      rows.slice(1, 6).map(function (r) {
        var st = r.status || 'new';
        return '<div class="hm-item"><span class="hm-date">' + esc(jalaliDate(r.created_at)) +
          ' — ' + fa(r.files_count || 0) + ' فایل</span>' +
          '<span class="hm-badge st-' + esc(st) + '">' + esc(STATUS_FA[st] || st) + '</span></div>';
      }).join('');
  }

  function download(path, name) {
    if (!path) return;
    toast('⏳ دارم لینک دانلود را آماده می‌کنم…', 'ok');
    sbSignedUrl(path, 3600).then(function (url) {
      if (!url) { toast('لینک دانلود ساخته نشد.'); return; }
      var a = document.createElement('a');
      a.href = url;
      a.download = name || '';
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { document.body.removeChild(a); }, 1000);
      hide($('global-error'));
    });
  }

  // ══════════════════════════════════════════════════════════
  // راه‌اندازی
  // ══════════════════════════════════════════════════════════
  function bind() {
    on($('btn-identity'), 'click', doIdentity);
    on($('btn-submit'), 'click', submit);
    on($('btn-another'), 'click', startAnother);
    on($('btn-go-send'), 'click', function () { setTab('send'); });
    on($('hero-help'), 'click', function () { setTab('help'); });
    ['send', 'status', 'help'].forEach(function (t) {
      on($('tab-' + t), 'click', function () { setTab(t); });
    });
    on($('btn-mic'), 'click', function () {
      if (state.recording) stopRecording(); else startRecording();
    });
    on($('btn-voice-stop'), 'click', stopRecording);
    on($('btn-voice-clear'), 'click', function () { clearVoice(); startRecording(); });
    on($('btn-name-change'), 'click', clearResolved);
    on($('name-list'), 'click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-pick]') : null;
      if (btn) pickStudent(btn.getAttribute('data-pick'));
    });
    var searchTimer = null;
    on($('name-search'), 'input', function (e) {
      var v = e.target.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { renderNameList(v); }, 220);
    });

    on($('who-chip'), 'click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-edit-id]') : null;
      if (t) editIdentity();
    });

    [['btn-pick-camera', 'file-camera'], ['btn-pick-gallery', 'file-gallery'],
     ['btn-pick-doc', 'file-doc'], ['btn-pick-audio', 'file-audio'],
     ['btn-pick-any', 'file-any']].forEach(function (pair) {
      on($(pair[0]), 'click', function () { $(pair[1]).click(); });
      on($(pair[1]), 'change', function (e) { addFiles(e.target.files); e.target.value = ''; });
    });

    on($('queue'), 'click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-remove]') : null;
      if (btn) removeFile(btn.getAttribute('data-remove'));
    });
    on($('deliverables-list'), 'click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-download]') : null;
      if (btn) download(btn.getAttribute('data-download'), btn.getAttribute('data-name'));
    });

    on($('in-name'), 'keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); $('in-no').focus(); }
    });
    on($('in-no'), 'keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); doIdentity(); }
    });

    // کشیدن و رها کردن روی dropzone
    var dz = $('dropzone');
    ['dragenter', 'dragover'].forEach(function (ev) {
      on(dz, ev, function (e) { e.preventDefault(); dz.classList.add('drag'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      on(dz, ev, function (e) { e.preventDefault(); dz.classList.remove('drag'); });
    });
    on(dz, 'drop', function (e) {
      if (!state.identity) { toast('اول اسمت را ثبت کن 🙂'); return; }
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        addFiles(e.dataTransfer.files);
      }
    });
    on(dz, 'click', function () { $('file-any').click(); });
  }

  function boot() {
    console.log('📦 tadilat-app.js v' + APP_V + ' بارگذاری شد');

    if (TG) {
      try {
        TG.ready(); TG.expand();
        if (TG.setHeaderColor) { try { TG.setHeaderColor('secondary_bg_color'); } catch (e) {} }
        if (TG.disableVerticalSwipes) { try { TG.disableVerticalSwipes(); } catch (e) {} }
      } catch (e) { console.warn('Telegram init', e); }
    } else {
      show($('browser-warning'));
    }

    if (!sbReady()) {
      toast('تنظیمات Supabase پیدا نشد (js/supabase-config.js بارگذاری نشد).');
      return;
    }

    bind();

    var saved = loadIdentity();
    if (saved && saved.name) {
      state.identity = saved;
      $('in-name').value = saved.name;
      $('in-no').value = saved.student_no || '';
      $('hero-title').textContent = 'خوش آمدی، ' + (saved.name.split(' ')[0] || '') + '! 🌟';
      renderHeroPill();
      revealForm();
      // نویسندهٔ مربوطه را از نو پیدا کن (ممکن است سفارش تازه‌ای ثبت شده باشد)
      if (saved.student_id) {
        resolveWriter(saved.student_id, saved.name).then(function (w) {
          state.writer = w;
          renderWhoChip();
        });
      }
    } else {
      var u = tgUser();
      if (u) $('hero-title').textContent = 'سلام ' + (u.first_name || '') + '! 👋';
      renderHeroPill();
      showNameCard();
    }
    renderHeroPill();
    setTab('send');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
