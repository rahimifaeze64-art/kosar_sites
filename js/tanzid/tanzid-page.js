/* ══════════════════════════════════════════════════════════════
   js/tanzid/tanzid-page.js — رابط صفحهٔ «تنضید» داخل پوستهٔ سایت

   منطق این صفحه از کد بازیابی‌شدهٔ Tanzid 1.5 گرفته شده
   (section_test / section_page_setup / section_toc /
   section_chapter_break / section_text_polish /
   section_english_footnotes) ولی به‌جای مدل شیء Word، مستقیماً
   روی XML فایل .docx کار می‌کند. هیچ فایلی به سرور نمی‌رود.

   وابسته به: js/tanzid/zip.js  و  js/tanzid/engine.js
   ══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* ── ترتیب مراحل، عیناً مطابق pipeline نسخهٔ ۱.۵ ─────────── */
  var STEPS = [
    { key: 'open',      title: 'باز کردن فایل' },
    { key: 'fnExport',  title: 'استخراج پاورقی‌ها',        ai: true },
    { key: 'refExport', title: 'استخراج منابع',            ai: true },
    { key: 'layout',    title: 'صفحه‌آرایی اصلی' },
    { key: 'fnAi',      title: 'ویرایش پاورقی با AI',      ai: true },
    { key: 'refAi',     title: 'ویرایش منابع با AI',       ai: true },
    { key: 'fnImport',  title: 'جایگذاری پاورقی‌ها',       ai: true },
    { key: 'refImport', title: 'جایگذاری منابع',           ai: true },
    { key: 'enFoot',    title: 'انتقال انگلیسی به پاورقی' },
    { key: 'toc',       title: 'ساخت فهرست مطالب' },
    { key: 'save',      title: 'ذخیرهٔ فایل' }
  ];

  var LANG_LABELS = { ar: 'عربی', fa: 'فارسی' };

  var state = {
    files: null,
    fileName: '',
    fileSize: 0,
    blob: null,
    mounted: false,
    busy: false,
    lang: 'ar',
    flags: {
      section: true,
      header: true,
      heading: true,
      polish: true,
      chapterBreak: true,
      englishFootnotes: true,
      toc: true,
      footnotes: true,
      references: true
    }
  };

  /* ── ابزارها ─────────────────────────────────────────────── */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fa(n) {
    return String(n == null ? '' : n).replace(/[0-9]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[d]; });
  }
  function sizeText(b) {
    if (!b) return '۰';
    return b < 1048576
      ? fa((b / 1024).toFixed(0)) + ' کیلوبایت'
      : fa((b / 1048576).toFixed(1)) + ' مگابایت';
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function nowStamp() {
    var d = new Date();
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }

  /* ── بارگذاری تنبل موتور و ZIP ───────────────────────────── */
  var depsPromise = null;
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('بارگذاری نشد: ' + src)); };
      document.head.appendChild(s);
    });
  }
  function ensureDeps() {
    if (depsPromise) return depsPromise;
    var ts = global._APP_TS || Date.now();
    depsPromise = Promise.all([
      global.TanzidZip ? Promise.resolve() : loadScript('js/tanzid/zip.js?v=' + ts),
      global.TanzidEngine ? Promise.resolve() : loadScript('js/tanzid/engine.js?v=' + ts),
      global.TANZID_AI_PROMPTS ? Promise.resolve() : loadScript('js/tanzid/ai-prompts.js?v=' + ts)
        .catch(function () { global.TANZID_AI_PROMPTS = null; }),
      global.TanzidAI ? Promise.resolve() : loadScript('js/tanzid/ai.js?v=' + ts)
        .catch(function () { global.TanzidAI = null; })
    ]).then(function () {
      if (!global.TanzidZip || !global.TanzidEngine) {
        throw new Error('موتور تنضید بارگذاری نشد.');
      }
    });
    return depsPromise;
  }

  /* ══════════════════════════════════════════════════════════
     HTML صفحه
     ══════════════════════════════════════════════════════════ */
  function getContent() {
    var chips = [
      ['fa-layer-group', 'سکشن‌گذاری'],
      ['fa-heading', 'هدینگ و فهرست'],
      ['fa-file-word', 'هدر و شمارهٔ صفحه'],
      ['fa-align-right', 'راست‌به‌چپ'],
      ['fa-wand-magic-sparkles', 'پاورقی و منابع با AI'],
      ['fa-language', 'پاورقی انگلیسی']
    ].map(function (c) {
      return '<span class="tz-chip"><i class="fas ' + c[0] + '"></i>' + c[1] + '</span>';
    }).join('');

    var switchRows = [
      ['section', 'سکشن‌گذاری', 'شکست سکشن در آغاز هر عنوان فصل'],
      ['header', 'هدرگذاری', 'عنوان فصل و شمارهٔ صفحه در سرصفحه'],
      ['heading', 'هدینگ‌گذاری', 'استایل و سطح سرتیترها برای فهرست خودکار'],
      ['polish', 'ویرایش نگارشی', 'اصلاح ي/ك عربی و فاصلهٔ عنوان فصل‌ها'],
      ['chapterBreak', 'سکشن‌بریک شروع متن فصل‌ها', 'متن هر فصل از صفحهٔ جدید شروع شود'],
      ['englishFootnotes', 'انتقال متن انگلیسی به پاورقی', 'از مقدمه تا الخاتمه'],
      ['toc', 'ساخت فهرست مطالب خودکار', 'زیر عنوان «فهرس المحتويات»']
    ].map(function (r) {
      return rowSwitch(r[0], r[1], r[2], true);
    }).join('');

    var aiRows =
      rowSwitch('footnotes', 'ویرایش پاورقی‌ها با هوش مصنوعی', 'استخراج ساختاریافته + قالب‌بندی قطعی (AvalAI / DeepSeek)', true) +
      rowSwitch('references', 'ویرایش منابع و مصادر با هوش مصنوعی', 'دسته‌بندی و قالب دانشگاهی خودکار (AvalAI / DeepSeek)', true);

    return '' +
    '<div class="tz-wrap" dir="rtl">' +

      /* ── سربرگ ── */
      '<div class="tz-hero">' +
        '<div class="tz-hero-ic"><i class="fas fa-ruler-combined"></i></div>' +
        '<div style="min-width:0">' +
          '<h3>منطق تنضید ۱.۵، داخل مرورگر</h3>' +
          '<p>فایل Word پایان‌نامه را انتخاب کن؛ قواعد صفحه‌آرایی تنضید بدون نیاز به Word روی همان فایل اعمال می‌شود. ' +
             'فایل روی سرور آپلود نمی‌شود؛ فقط متن پاورقی/منابع برای ویرایش به سرویس هوش مصنوعی می‌رود.</p>' +
          '<div class="tz-chips">' + chips + '</div>' +
        '</div>' +
      '</div>' +

      '<div class="tz-grid">' +

        /* ── ستون اصلی ── */
        '<div class="tz-col">' +

          '<section class="tz-card">' +
            '<div class="tz-card-head">' +
              '<div class="tz-no">۱</div>' +
              '<div><h4>فایل Word را انتخاب کن</h4>' +
                '<p class="tz-sub">فقط <b>.docx</b> پذیرفته می‌شود (نه .doc قدیمی) — حداکثر ۵۰ مگابایت.</p></div>' +
            '</div>' +
            '<div class="tz-drop" id="tz-drop">' +
              '<span class="tz-drop-ic"><i class="fas fa-cloud-arrow-up"></i></span>' +
              '<b>فایل را اینجا بکش و رها کن</b>' +
              '<small>یا برای انتخاب کلیک کن</small>' +
              '<input type="file" id="tz-file-input" accept=".docx" class="tz-hidden">' +
            '</div>' +
            '<div class="tz-file tz-hidden" id="tz-file-info">' +
              '<div class="tz-file-ic"><i class="fas fa-file-word"></i></div>' +
              '<div style="min-width:0">' +
                '<div class="tz-file-name" id="tz-file-name">—</div>' +
                '<div class="tz-file-meta" id="tz-file-meta">—</div>' +
              '</div>' +
              '<button type="button" class="tz-file-x" id="tz-file-clear" title="حذف فایل">' +
                '<i class="fas fa-xmark"></i></button>' +
            '</div>' +
            '<div id="tz-file-msg"></div>' +
          '</section>' +

          '<section class="tz-card">' +
            '<div class="tz-card-head">' +
              '<div class="tz-no">۲</div>' +
              '<div><h4>اجرای تنضید</h4>' +
                '<p class="tz-sub">همهٔ مراحل داخل مرورگر اجرا می‌شود؛ پس از پایان، فایل نهایی آمادهٔ دانلود است.</p></div>' +
            '</div>' +
            '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
              '<button type="button" class="tz-btn tz-btn-primary tz-btn-lg" id="tz-run" disabled>' +
                '<i class="fas fa-play"></i><span id="tz-run-label">شروع صفحه‌آرایی</span>' +
              '</button>' +
              '<button type="button" class="tz-btn tz-btn-outline tz-hidden" id="tz-download">' +
                '<i class="fas fa-download"></i> دانلود فایل نهایی' +
              '</button>' +
              '<button type="button" class="tz-btn tz-btn-outline tz-hidden" id="tz-newfile">' +
                '<i class="fas fa-file-circle-plus"></i> فایل جدید' +
              '</button>' +
            '</div>' +
            '<div class="tz-bar tz-hidden" id="tz-bar"><i id="tz-bar-fill"></i></div>' +
            '<div id="tz-run-msg"></div>' +
            '<div class="tz-steps" id="tz-steps" style="margin-top:14px"></div>' +
            '<pre class="tz-log tz-hidden" id="tz-log"></pre>' +
          '</section>' +

          '<section class="tz-card tz-hidden" id="tz-report-card">' +
            '<div class="tz-card-head">' +
              '<div class="tz-no"><i class="fas fa-clipboard-check"></i></div>' +
              '<div><h4>گزارش تنضید</h4>' +
                '<p class="tz-sub" id="tz-report-sub">—</p></div>' +
            '</div>' +
            '<div class="tz-stats" id="tz-stats"></div>' +
            '<ul class="tz-report-list" id="tz-report-steps" style="margin-top:12px"></ul>' +
            '<div class="tz-hidden" id="tz-headings-wrap" style="margin-top:14px">' +
              '<b style="font-size:12.5px">سرتیترهای شناسایی‌شده</b>' +
              '<div class="tz-table-wrap">' +
                '<table class="tz-table"><thead><tr>' +
                  '<th style="width:40px">#</th><th style="width:110px">نوع</th>' +
                  '<th style="width:50px">سطح</th><th>متن</th>' +
                '</tr></thead><tbody id="tz-headings-body"></tbody></table>' +
              '</div>' +
            '</div>' +
            '<div id="tz-warnings"></div>' +
          '</section>' +

        '</div>' +

        /* ── ستون کناری: گزینه‌ها ── */
        '<div class="tz-col">' +
          '<section class="tz-card">' +
            '<div class="tz-card-head">' +
              '<div class="tz-no"><i class="fas fa-sliders"></i></div>' +
              '<div><h4>نوع صفحه‌آرایی</h4>' +
                '<p class="tz-sub">پیش‌فرض‌ها مطابق قواعد تنضید ۱.۵ است.</p></div>' +
            '</div>' +

            '<span class="tz-label">زبان پایان‌نامه</span>' +
            '<div class="tz-seg" id="tz-lang">' +
              '<button type="button" data-lang="ar" class="tz-on">عربی</button>' +
              '<button type="button" data-lang="fa">فارسی</button>' +
            '</div>' +

            rowSwitch('pageSetup', 'قالب صفحه A4 و حاشیه‌ها', 'بالا ۳٫۵ و پایین/چپ/راست ۳ سانتی‌متر', true, true) +
            switchRows +
            '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--tz-line)">' +
              '<span class="tz-label" style="color:#8c9393">' +
                '<i class="fas fa-wand-magic-sparkles" style="margin-left:4px"></i> ویرایش با هوش مصنوعی</span>' +
              aiRows +
              '<div class="tz-note tz-note-info" style="margin-top:8px">' +
                '<i class="fas fa-circle-info"></i><div>کلید API در همین صفحه تعبیه شده است؛ ' +
                'فقط <b>متن پاورقی‌ها و منابع</b> برای استخراج ساختاریافته به <b>api.avalai.ir</b> ' +
                'فرستاده می‌شود — خود فایل Word آپلود نمی‌شود. برای این دو مرحله اینترنت لازم است.</div></div>' +
            '</div>' +
          '</section>' +

          '<section class="tz-card">' +
            '<div class="tz-card-head">' +
              '<div class="tz-no"><i class="fas fa-circle-info"></i></div>' +
              '<div><h4>راهنما</h4></div>' +
            '</div>' +
            '<ul class="tz-help-list">' +
              '<li>فهرست مطالب به‌صورت <b>فیلد خودکار Word</b> ساخته می‌شود؛ هنگام باز کردن فایل در Word، ' +
                'به‌روزرسانی را تأیید کن تا شمارهٔ صفحه‌ها بنشیند.</li>' +
              '<li>پاورقی‌ها و منابع با <b>هوش مصنوعی</b> ویرایش می‌شوند؛ قالب‌بندی نهایی (المصدر السابق، ' +
                'چیدمان دانشگاهی، دسته‌بندی منابع) به‌صورت قطعی و بدون دخالت AI انجام می‌شود.</li>' +
              '<li>فایل ورودی باید <b>.docx</b> باشد و ساختار آن از قبل آسیب ندیده باشد. ' +
                'پیشنهاد می‌شود ابتدا از فایل نسخهٔ پشتیبان بگیر.</li>' +
              '<li>صفحه‌آرایی کاملاً محلی است؛ فقط مراحل پاورقی/منابع به اینترنت نیاز دارند.</li>' +
            '</ul>' +
          '</section>' +
        '</div>' +

      '</div>' +
    '</div>';
  }

  function rowSwitch(key, title, sub, checked, disabled, lockCtrl) {
    var cls = 'tz-switch-row' + (disabled ? ' tz-disabled' : '');
    return '<label class="' + cls + '">' +
      '<div class="tz-switch-text"><b>' + title + '</b>' +
        (sub ? '<small>' + sub + '</small>' : '') + '</div>' +
      '<span class="tz-switch">' +
        '<input type="checkbox" data-flag="' + key + '"' +
          (checked ? ' checked' : '') +
          (disabled ? ' disabled' : '') +
          (lockCtrl ? ' data-lock="1"' : '') + '>' +
        '<span></span>' +
      '</span>' +
    '</label>';
  }

  /* ══════════════════════════════════════════════════════════
     رندر مراحل / پیام / گزارش
     ══════════════════════════════════════════════════════════ */
  function renderSteps() {
    var box = $('tz-steps');
    if (!box) return;
    box.innerHTML = STEPS.map(function (s, i) {
      var icon = s.ai ? 'fa-robot' : (i === STEPS.length - 1 ? 'fa-floppy-disk' : 'fa-circle');
      return '<div class="tz-step" id="tz-step-' + i + '" ' +
        'title="' + esc(s.title) + '">' +
        '<i class="fas ' + icon + '"></i><span>' + esc(s.title) + '</span></div>';
    }).join('');
  }

  function setStep(i, status, detail) {
    var el = $('tz-step-' + i);
    if (!el) return;
    el.className = 'tz-step' +
      (status === 'running' ? ' tz-running' :
       status === 'done' ? ' tz-done' :
       status === 'error' ? ' tz-error' :
       status === 'skip' ? ' tz-skip' : '');
    var icon = el.querySelector('i');
    if (icon) {
      icon.className = 'fas ' +
        (status === 'running' ? 'fa-circle-notch' :
         status === 'done' ? 'fa-check' :
         status === 'error' ? 'fa-xmark' :
         status === 'skip' ? 'fa-robot' : 'fa-circle');
    }
    if (detail && status === 'error') el.title = detail;
  }

  function setBar(p) {
    var bar = $('tz-bar'), fill = $('tz-bar-fill');
    if (!bar || !fill) return;
    bar.classList.remove('tz-hidden');
    fill.style.width = Math.max(0, Math.min(100, p)) + '%';
  }

  function runMsg(kind, html) {
    var box = $('tz-run-msg');
    if (!box) return;
    if (!html) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="tz-note tz-note-' + kind + '">' +
      '<i class="fas ' + (kind === 'ok' ? 'fa-circle-check' : kind === 'warn' ? 'fa-triangle-exclamation' : kind === 'err' ? 'fa-circle-xmark' : 'fa-circle-info') + '"></i>' +
      '<div>' + html + '</div></div>';
  }

  function fileMsg(kind, html) {
    var box = $('tz-file-msg');
    if (box) box.innerHTML = '';
    if (html) runMsgAt(box, kind, html);
  }
  function runMsgAt(box, kind, html) {
    if (!box) return;
    box.innerHTML = '<div class="tz-note tz-note-' + kind + '">' +
      '<i class="fas fa-circle-info"></i><div>' + html + '</div></div>';
  }

  function addLog(line) {
    var log = $('tz-log');
    if (!log) return;
    log.classList.remove('tz-hidden');
    var time = '<span class="tz-log-time">' + nowStamp() + '</span>';
    log.innerHTML += time + esc(line) + '\n';
    log.scrollTop = log.scrollHeight;
  }

  function showReport(report, blobSize) {
    var card = $('tz-report-card');
    if (!card) return;
    card.classList.remove('tz-hidden');

    var sub = $('tz-report-sub');
    if (sub) sub.textContent = 'حجم فایل خروجی: ' + sizeText(blobSize);

    var c = report.counts || {};
    var stats = [
      ['سرتیتر', c.headings], ['شکست صفحه', c.pageBreaks],
      ['سکشن', c.sections], ['پاورقی جابه‌جا', c.englishFootnotes],
      ['مدخل فهرست', c.tocEntries], ['اصلاح حرف', c.polished]
    ].filter(function (x) { return x[1] != null; });
    $('tz-stats').innerHTML = stats.map(function (x) {
      return '<span class="tz-stat"><b>' + fa(x[1]) + '</b>' + x[0] + '</span>';
    }).join('');

    $('tz-report-steps').innerHTML = (report.steps || []).map(function (s) {
      return '<li>' + esc(s) + '</li>';
    }).join('') || '<li>تغییری لازم نبود</li>';

    var hs = report.headings || [];
    if (hs.length) {
      $('tz-headings-wrap').classList.remove('tz-hidden');
      $('tz-headings-body').innerHTML = hs.map(function (h, i) {
        return '<tr><td>' + fa(i + 1) + '</td>' +
          '<td><span class="tz-tag">' + esc(h.type) + '</span></td>' +
          '<td>' + (h.level ? fa(h.level) : '—') + '</td><td>' + esc(h.text) + '</td></tr>';
      }).join('');
    } else {
      $('tz-headings-wrap').classList.add('tz-hidden');
    }

    $('tz-warnings').innerHTML = (report.warnings || []).map(function (w) {
      return '<div class="tz-note tz-note-warn"><i class="fas fa-triangle-exclamation"></i><div>' + esc(w) + '</div></div>';
    }).join('');
  }

  /* ══════════════════════════════════════════════════════════
     رفتار صفحه
     ══════════════════════════════════════════════════════════ */
  function bindOptions() {
    var langBox = $('tz-lang');
    if (langBox) {
      langBox.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-lang]');
        if (!b) return;
        state.lang = b.getAttribute('data-lang');
        Array.prototype.forEach.call(langBox.querySelectorAll('button'), function (x) {
          x.classList.toggle('tz-on', x === b);
        });
        addLog('زبان پایان‌نامه: ' + (LANG_LABELS[state.lang] || 'عربی'));
      });
    }
    var root = $('tzAppRoot');
    if (!root) return;
    Array.prototype.forEach.call(root.querySelectorAll('input[data-flag]'), function (inp) {
      state.flags[inp.getAttribute('data-flag')] = inp.checked;
      inp.addEventListener('change', function () {
        state.flags[inp.getAttribute('data-flag')] = inp.checked;
      });
    });
  }

  function bindFile() {
    var drop = $('tz-drop');
    var input = $('tz-file-input');
    if (!drop || !input) return;

    drop.addEventListener('click', function () { input.click(); });
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('tz-over'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('tz-over'); });
    drop.addEventListener('drop', function (e) {
      e.preventDefault();
      drop.classList.remove('tz-over');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) takeFile(e.dataTransfer.files[0]);
    });
    input.addEventListener('change', function () {
      if (input.files && input.files[0]) takeFile(input.files[0]);
    });
    var clr = $('tz-file-clear');
    if (clr) clr.addEventListener('click', clearFile);
    var nf = $('tz-newfile');
    if (nf) nf.addEventListener('click', clearFile);
  }

  function takeFile(f) {
    if (!/\.docx$/i.test(f.name)) {
      fileMsg('err', 'فقط فایل <b>.docx</b> پذیرفته می‌شود. اگر فایل .doc قدیمی است، در Word آن را ' +
        '«Save As → .docx» کن.');
      return;
    }
    if (f.size > 50 * 1048576) {
      fileMsg('err', 'حجم فایل بیشتر از ۵۰ مگابایت است.');
      return;
    }
    state.fileName = f.name;
    state.fileSize = f.size;
    state.blob = null;

    $('tz-file-name').textContent = f.name;
    $('tz-file-meta').textContent = sizeText(f.size);
    $('tz-file-info').classList.remove('tz-hidden');
    $('tz-drop').classList.add('tz-hidden');
    $('tz-download').classList.add('tz-hidden');
    $('tz-newfile').classList.add('tz-hidden');
    $('tz-report-card').classList.add('tz-hidden');
    $('tz-run').disabled = false;
    fileMsg('info', 'فایل انتخاب شد؛ حالا «شروع صفحه‌آرایی» را بزن.');

    ensureDeps().then(function () {
      return global.TanzidZip.read(f);
    }).then(function (z) {
      state.files = z;
      addLog('فایل خوانده شد (' + sizeText(f.size) + ')');
    }).catch(function (e) {
      state.files = null;
      fileMsg('err', 'فایل خوانده نشد: ' + esc(e && e.message ? e.message : e));
      $('tz-run').disabled = true;
    });
  }

  function clearFile() {
    state.files = null;
    state.fileName = '';
    state.fileSize = 0;
    state.blob = null;
    var input = $('tz-file-input');
    if (input) input.value = '';
    $('tz-file-info').classList.add('tz-hidden');
    $('tz-drop').classList.remove('tz-hidden');
    $('tz-run').disabled = true;
    $('tz-download').classList.add('tz-hidden');
    $('tz-newfile').classList.add('tz-hidden');
    $('tz-report-card').classList.add('tz-hidden');
    $('tz-bar').classList.add('tz-hidden');
    $('tz-log').classList.add('tz-hidden');
    $('tz-log').innerHTML = '';
    fileMsg('', '');
    runMsg('', '');
    renderSteps();
  }

  function run() {
    if (state.busy) return;
    if (!state.files) { runMsg('warn', 'اول یک فایل .docx انتخاب کن.'); return; }

    state.busy = true;
    state.blob = null;
    $('tz-run').disabled = true;
    var label = $('tz-run-label');
    if (label) label.textContent = 'در حال اجرا…';
    $('tz-download').classList.add('tz-hidden');
    $('tz-newfile').classList.add('tz-hidden');
    $('tz-report-card').classList.add('tz-hidden');
    $('tz-log').classList.remove('tz-hidden');
    $('tz-log').innerHTML = '';
    runMsg('', '');
    renderSteps();
    setBar(0);

    var opts = {
      language: state.lang,
      pageSetup: true,
      section: !!state.flags.section,
      header: !!state.flags.header,
      heading: !!state.flags.heading,
      polish: !!state.flags.polish,
      chapterBreak: !!state.flags.chapterBreak,
      englishFootnotes: !!state.flags.englishFootnotes,
      toc: !!state.flags.toc,
      footnotes: !!state.flags.footnotes,
      references: !!state.flags.references
    };

    var doneCount = 0;
    function onProgress(i, status, detail) {
      if (status === 'running') {
        setStep(i, 'running');
        setBar((doneCount / STEPS.length) * 100);
      } else if (status === 'done') {
        doneCount++;
        setStep(i, 'done');
        setBar((doneCount / STEPS.length) * 100);
      } else if (status === 'skip') {
        setStep(i, 'skip');
      } else if (status === 'error') {
        setStep(i, 'error', detail);
        addLog('خطا در مرحلهٔ ' + fa(i + 1) + ': ' + (detail || ''));
      }
      if (detail && (status === 'running' || status === 'done' || status === 'log')) addLog(detail);
    }

    var report;
    ensureDeps().then(function () {
      return global.TanzidEngine.run(state.files, opts, onProgress);
    }).then(function (r) {
      report = r || {};
      if (!report.ok) {
        throw new Error((report.warnings && report.warnings[0]) || 'تنضید ناموفق بود.');
      }
      return global.TanzidZip.write(state.files);
    }).then(function (blob) {
      state.blob = blob;
      var base = state.fileName.replace(/\.docx$/i, '');
      $('tz-download').classList.remove('tz-hidden');
      $('tz-download').onclick = function () {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(state.blob);
        a.download = base + '-تنضید.docx';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      };
      $('tz-newfile').classList.remove('tz-hidden');
      runMsg('ok', 'تنضید تمام شد — فایل نهایی آمادهٔ دانلود است.');
      addLog('فایل خروجی ساخته شد (' + sizeText(blob.size) + ')');
      setBar(100);
      showReport(report, blob.size);
      state.busy = false;
      $('tz-run').disabled = false;
      if (label) label.textContent = 'تنضید دوباره';
    }).catch(function (e) {
      state.busy = false;
      $('tz-run').disabled = false;
      if (label) label.textContent = 'تلاش دوباره';
      runMsg('err', 'خطا در تنضید: ' + esc(e && e.message ? e.message : e));
      addLog('خطا: ' + (e && e.message ? e.message : e));
    });
  }

  /* ══════════════════════════════════════════════════════════
     mount / init
     ══════════════════════════════════════════════════════════ */
  function mount(container) {
    var root = typeof container === 'string' ? $(container) : container;
    if (!root) return false;
    if (root.getAttribute('data-tz-mounted') === '1') {
      // قبلاً نصب شده — فقط دکمه‌ها را همگام کن
      return true;
    }
    root.innerHTML = '<div id="tzAppRoot">' + getContent() + '</div>';
    root.setAttribute('data-tz-mounted', '1');
    renderSteps();
    bindFile();
    bindOptions();
    var runBtn = $('tz-run');
    if (runBtn) runBtn.addEventListener('click', run);
    return true;
  }

  function init() {
    var root = $('tanzid-root');
    if (root) mount(root);
  }

  global.TanzidPage = {
    STEPS: STEPS,
    getContent: getContent,
    mount: mount,
    init: init,
    _state: state
  };
})(window);
