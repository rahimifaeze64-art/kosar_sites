/* ══════════════════════════════════════════════════════════════
   js/tanzid/engine.js — موتور صفحه‌آرایی «تنضید» در مرورگر

   منطق از کد decompile‌شدهٔ Tanzid1.3 بازنویسی شده، ولی به‌جای
   مدل شیء Word روی XML خود فایل docx کار می‌کند. نتیجه: بدون
   نیاز به Microsoft Word و بدون سرور.

   انواع سرتیتر (از section_test.py):
     سطح ۱ : Al-Moqaddame · Fasl · Al-Khateme · Masader va Maraje
     سطح ۲ : Roos
     فقط فهرست: Mabhath · Matlab · Far · Roos · Nataej · Tawsiyat
     خاص   : Chekide (چکیده) · Mostakhlas (المستخلص)
   ══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  var parser = new DOMParser();
  var serializer = new XMLSerializer();

  function parseXml(text) { return parser.parseFromString(text, 'application/xml'); }
  function toXml(doc) { return serializer.serializeToString(doc); }

  // ── دسترسی به عناصر با فضای‌نام w ──
  function wAll(node, name) {
    var out = [], list = node.getElementsByTagNameNS(W, name);
    for (var i = 0; i < list.length; i++) out.push(list[i]);
    return out;
  }
  function wOne(node, name) {
    return node.getElementsByTagNameNS(W, name)[0] || null;
  }

  /** مطمئن می‌شود <w:pPr> وجود دارد و اول پاراگراف است */
  function pPr(p) {
    var pr = wOne(p, 'pPr');
    if (!pr) {
      pr = p.ownerDocument.createElementNS(W, 'w:pPr');
      p.insertBefore(pr, p.firstChild);
    }
    return pr;
  }

  /** عنصر فرزند را جایگزین/اضافه می‌کند (ترتیب مهم است) */
  var ORDER = ['pStyle', 'keepNext', 'keepLines', 'pageBreakBefore', 'framePr',
    'widowControl', 'numPr', 'suppressLineNumbers', 'pBdr', 'shd', 'tabs',
    'suppressAutoHyphens', 'kinsoku', 'wordWrap', 'overflowPunct',
    'topLinePunct', 'autoSpaceDE', 'autoSpaceDN', 'bidi', 'adjustRightInd',
    'snapToGrid', 'spacing', 'ind', 'contextualSpacing', 'mirrorIndents',
    'suppressOverlap', 'jc', 'textDirection', 'textAlignment', 'outlineLvl',
    'rPr', 'sectPr'];

  function setProp(p, tag, attrs) {
    var pr = pPr(p);
    var el = wOne(pr, tag);
    if (!el) {
      el = p.ownerDocument.createElementNS(W, 'w:' + tag);
      // جای درست بر اساس ترتیب اسکیما
      var want = ORDER.indexOf(tag), placed = false;
      for (var i = 0; i < pr.childNodes.length; i++) {
        var c = pr.childNodes[i];
        if (c.nodeType !== 1) continue;
        var idx = ORDER.indexOf(c.localName);
        if (idx > want || idx === -1) { pr.insertBefore(el, c); placed = true; break; }
      }
      if (!placed) pr.appendChild(el);
    }
    if (attrs) {
      for (var k in attrs) {
        if (attrs.hasOwnProperty(k)) el.setAttributeNS(W, 'w:' + k, attrs[k]);
      }
    }
    return el;
  }

  function removeProp(p, tag) {
    var pr = wOne(p, 'pPr');
    if (!pr) return;
    var el = wOne(pr, tag);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function hasProp(p, tag) {
    var pr = wOne(p, 'pPr');
    return !!(pr && wOne(pr, tag));
  }

  /** متن یک پاراگراف */
  function paraText(p) {
    var t = wAll(p, 't'), s = '';
    for (var i = 0; i < t.length; i++) s += t[i].textContent;
    return s;
  }

  /* ══════════════════════════════════════════════════════════
     ۱) نرمال‌سازی متن — عیناً از normalize_text در تنضید
     ══════════════════════════════════════════════════════════ */
  var HARAKAT = /[\u064B-\u0652\u0670\u0640]/g;
  var INVISIBLE = /[\u200b-\u200f\u202a-\u202e]/g;

  function normalizeText(v) {
    if (!v) return '';
    return String(v)
      .replace(HARAKAT, '')
      .replace(INVISIBLE, ' ')
      .replace(/[يىئ]/g, 'ی')
      .replace(/[ك]/g, 'ک')
      .replace(/[ۀة]/g, 'ه')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/[ؤ]/g, 'و')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** نسخهٔ مقایسه‌ای: بدون فاصله و همزه و «ال» */
  function normKey(v) {
    return normalizeText(v)
      .replace(/[\s\u200c\u0640.,،:;؛!?؟"'()\[\]{}«»\-–—]/g, '')
      .replace(/^ال/, '');
  }

  /* ══════════════════════════════════════════════════════════
     ۲) شناخت سرتیتر — از detect_heading
     ══════════════════════════════════════════════════════════ */
  var HEAD_WORDS = {
    'Al-Moqaddame': ['المقدمه', 'المقدمة', 'مقدمه', 'المقدمه'],
    'Al-Khateme': ['الخاتمه', 'الخاتمة', 'خاتمه', 'خاتمة', 'النتيجه', 'النتيجة'],
    'Masader va Maraje': ['المصادر والمراجع', 'المصادر', 'المراجع', 'منابع',
                          'مصادر', 'مراجع', 'المصادر و المراجع'],
    'Chekide': ['چکیده', 'چكيده', 'الملخص'],
    'Mostakhlas': ['المستخلص', 'مستخلص'],
    'Fasl': ['الفصل', 'فصل', 'الباب', 'باب']
  };

  /** کلمات «رؤوس ثمانیه» — از ROOS_THAMANIYA_WORDS */
  var ROOS_WORDS = ['مبحث', 'المبحث', 'مطلب', 'المطلب', 'فرع', 'الفرع',
    'الاول', 'الثانی', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن',
    'اولا', 'ثانیا', 'ثالثا', 'رابعا', 'خامسا', 'المقدمه', 'تمهید'];

  var ROOS_NUMERIC = /^\s*([0-9١٢٣٤٥٦٧٨٩]{1,2})\s*[.:\-)]/;

  /** از is_roos_thamaniya_heading */
  function isRoosThamaniya(raw) {
    var s = normalizeText(raw);
    if (!s) return false;
    for (var i = 0; i < ROOS_WORDS.length; i++) {
      if (normKey(s).indexOf(normKey(ROOS_WORDS[i])) === 0) return true;
    }
    return ROOS_NUMERIC.test(s);
  }

  /** از looks_like_sentence — سرتیتر جملهٔ کامل نیست */
  function looksLikeSentence(raw) {
    var s = normalizeText(raw);
    if (s.length > 120) return true;
    var stops = (s.match(/[.،؛:!؟]/g) || []).length;
    var words = s.split(' ').length;
    return stops >= 2 && words > 12;
  }

  /** از is_reasonable_heading_length */
  function isReasonableHeading(raw) {
    var s = normalizeText(raw);
    var words = s.split(' ').filter(Boolean).length;
    if (!s || s.length > 90 || words > 12) return false;
    return !looksLikeSentence(s);
  }

  var TOC_ONLY = ['Mabhath', 'Matlab', 'Far', 'Roos', 'Nataej', 'Tawsiyat'];

  /** از detect_heading — خروجی: نام نوع یا null */
  function detectHeading(p) {
    var raw = paraText(p);
    if (!raw || !raw.trim()) return null;
    if (isTocParagraph(p)) return null;
    var s = normalizeText(raw);
    var key = normKey(s);

    for (var type in HEAD_WORDS) {
      if (!HEAD_WORDS.hasOwnProperty(type)) continue;
      var list = HEAD_WORDS[type];
      for (var i = 0; i < list.length; i++) {
        var k = normKey(list[i]);
        // باید با آن شروع شود یا دقیقاً همان باشد
        if (key === k || key.indexOf(k) === 0) {
          if (type === 'Fasl' && !/^\s*(ال)?(فصل|باب)\s*[0-9١٢٣٤٥٦٧٨٩]?/.test(s)) {
            // «فصل» باید در آغاز باشد
            if (s.indexOf('فصل') > 2 && s.indexOf('الفصل') > 2) continue;
          }
          if (isReasonableHeading(s) || type === 'Chekide' || type === 'Mostakhlas') {
            return type;
          }
        }
      }
    }
    if (isReasonableHeading(s) && isRoosThamaniya(s)) return 'Roos';
    return null;
  }

  /** از is_toc_paragraph — پاراگراف فهرست است؟ */
  function isTocParagraph(p) {
    var s = paraText(p);
    if (!s) return false;
    // خطوط فهرست به نقطه‌چین و شمارهٔ صفحه ختم می‌شوند
    if (/[\u2026.]{3,}\s*[0-9٠-٩]+/.test(s)) return true;
    if (/\t[0-9٠-٩]+\s*$/.test(s)) return true;
    // هایپرلینک داخلی = فهرست
    var links = p.getElementsByTagNameNS(W, 'hyperlink');
    for (var i = 0; i < links.length; i++) {
      if (links[i].getAttributeNS(W, 'anchor')) return true;
    }
    return false;
  }

  /* ══════════════════════════════════════════════════════════
     ۳) جدول سطوح و قالب هر سرتیتر
     ══════════════════════════════════════════════════════════ */
  var LEVELS = {
    'Al-Moqaddame': 1, 'Fasl': 1, 'Al-Khateme': 1, 'Masader va Maraje': 1,
    'Roos': 2, 'Chekide': 1, 'Mostakhlas': 1
  };
  var BREAK_BEFORE = { 'Al-Moqaddame': 1, 'Fasl': 1, 'Al-Khateme': 1, 'Masader va Maraje': 1 };
  var TOC_INCLUDE = { 'Al-Moqaddame': 1, 'Fasl': 1, 'Al-Khateme': 1,
    'Masader va Maraje': 1, 'Chekide': 1, 'Mostakhlas': 1, 'Roos': 1 };

  /* ══════════════════════════════════════════════════════════
     ۴) عملیات روی سند
     ══════════════════════════════════════════════════════════ */

  /** از force_range_rtl — راست‌به‌چپ کردن همهٔ پاراگراف‌ها */
  function forceRtl(doc) {
    var ps = wAll(doc, 'p'), n = 0;
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      if (!hasProp(p, 'bidi')) { setProp(p, 'bidi'); n++; }
      // اگر تراز چپ است، به راست برگردان
      var pr = wOne(p, 'pPr');
      var jc = pr && wOne(pr, 'jc');
      if (jc && jc.getAttributeNS(W, 'val') === 'left') {
        jc.setAttributeNS(W, 'w:val', 'right');
      }
    }
    return n;
  }

  /** اندازهٔ کاغذ و حاشیه — A4 با حاشیهٔ استاندارد پایان‌نامه */
  function setPageSetup(doc, opt) {
    opt = opt || {};
    var n = 0;
    var sects = wAll(doc, 'sectPr');
    // اگر سندی sectPr نداشت، در پایان body بساز
    if (!sects.length) {
      var body = wOne(doc, 'body');
      if (body) {
        var sp = doc.createElementNS(W, 'w:sectPr');
        body.appendChild(sp);
        sects = [sp];
      }
    }
    for (var i = 0; i < sects.length; i++) {
      var s = sects[i];
      // A4: 11906 × 16838 twips
      var pgSz = wOne(s, 'pgSz');
      if (!pgSz) {
        pgSz = doc.createElementNS(W, 'w:pgSz');
        s.insertBefore(pgSz, s.firstChild);
      }
      pgSz.setAttributeNS(W, 'w:w', opt.w || '11906');
      pgSz.setAttributeNS(W, 'w:h', opt.h || '16838');

      var mg = wOne(s, 'pgMar');
      if (!mg) {
        mg = doc.createElementNS(W, 'w:pgMar');
        s.appendChild(mg);
      }
      // حاشیه: بالا/پایین 2.5cm، راست 3cm، چپ 2.5cm (twips: 1cm = 567)
      mg.setAttributeNS(W, 'w:top', opt.top || '1418');
      mg.setAttributeNS(W, 'w:bottom', opt.bottom || '1418');
      mg.setAttributeNS(W, 'w:right', opt.right || '1701');
      mg.setAttributeNS(W, 'w:left', opt.left || '1418');
      mg.setAttributeNS(W, 'w:header', '709');
      mg.setAttributeNS(W, 'w:footer', '709');
      mg.setAttributeNS(W, 'w:gutter', '0');
      n++;
    }
    return n;
  }

  /** از fix_arabic_waw_ya_in_doc — اصلاح حروف عربی در متن */
  function fixArabicLetters(doc) {
    var ts = wAll(doc, 't'), n = 0;
    for (var i = 0; i < ts.length; i++) {
      var t = ts[i], v = t.textContent, nv = v
        .replace(/ي/g, 'ی').replace(/ك/g, 'ک')
        .replace(/ۀ/g, 'ه').replace(/ة/g, 'ه');
      if (nv !== v) { t.textContent = nv; n++; }
    }
    return n;
  }

  /** از set_chapter_title_format — قالب عنوان فصل */
  function formatHeading(p, type, doc) {
    var lvl = LEVELS[type] || 2;
    setProp(p, 'outlineLvl', { val: String(lvl - 1) });
    setProp(p, 'jc', { val: 'center' });
    setProp(p, 'bidi');
    setProp(p, 'spacing', { before: '240', after: '240', line: '360', lineRule: 'auto' });
    // «keep with next» تا عنوان تنها نماند
    if (!hasProp(p, 'keepNext')) setProp(p, 'keepNext');

    // ── قالب اجراها ──
    var runs = wAll(p, 'r');
    for (var i = 0; i < runs.length; i++) {
      var r = runs[i];
      var rPr = wOne(r, 'rPr');
      if (!rPr) {
        rPr = doc.createElementNS(W, 'w:rPr');
        r.insertBefore(rPr, r.firstChild);
      }
      var sz = wOne(rPr, 'sz');
      if (!sz) { sz = doc.createElementNS(W, 'w:sz'); rPr.appendChild(sz); }
      sz.setAttributeNS(W, 'w:val', lvl === 1 ? '32' : '28');   // 16pt / 14pt
      var szCs = wOne(rPr, 'szCs');
      if (!szCs) { szCs = doc.createElementNS(W, 'w:szCs'); rPr.appendChild(szCs); }
      szCs.setAttributeNS(W, 'w:val', lvl === 1 ? '32' : '28');
      if (!wOne(rPr, 'b')) rPr.appendChild(doc.createElementNS(W, 'w:b'));
      if (!wOne(rPr, 'rtl')) rPr.appendChild(doc.createElementNS(W, 'w:rtl'));
    }

    // ── شکست صفحه قبل از فصل‌ها ──
    if (BREAK_BEFORE[type] && !hasProp(p, 'pageBreakBefore')) {
      setProp(p, 'pageBreakBefore', {});
      return true;
    }
    return false;
  }

  /** فاصلهٔ خطوط متن اصلی — ۱.۵ */
  function setBodySpacing(doc) {
    var ps = wAll(doc, 'p'), n = 0;
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      if (hasProp(p, 'outlineLvl')) continue;    // سرتیترها دست نخورند
      var s = paraText(p);
      if (!s.trim()) continue;
      setProp(p, 'spacing', { line: '360', lineRule: 'auto', after: '120' });
      n++;
    }
    return n;
  }

  /** از add_bottom_border — خط زیر عنوان */
  function addHeadingBorder(p, doc) {
    var pr = pPr(p);
    var bdr = wOne(pr, 'pBdr');
    if (bdr) return false;
    bdr = doc.createElementNS(W, 'w:pBdr');
    var bottom = doc.createElementNS(W, 'w:bottom');
    bottom.setAttributeNS(W, 'w:val', 'single');
    bottom.setAttributeNS(W, 'w:sz', '8');
    bottom.setAttributeNS(W, 'w:space', '4');
    bottom.setAttributeNS(W, 'w:color', 'auto');
    bdr.appendChild(bottom);
    pr.appendChild(bdr);
    return true;
  }

  /* ══════════════════════════════════════════════════════════
     ۵) خط لولهٔ اصلی
     ══════════════════════════════════════════════════════════ */
  function process(files, opts) {
    opts = opts || {};
    var report = { ok: true, steps: [], headings: [], warnings: [], counts: {} };

    var docName = 'word/document.xml';
    if (!files[docName]) {
      report.ok = false;
      report.warnings.push('word/document.xml در فایل پیدا نشد — این فایل docx نیست.');
      return report;
    }

    var xml = new TextDecoder('utf-8').decode(files[docName]);
    var doc = parseXml(xml);
    if (doc.getElementsByTagName('parsererror').length) {
      report.ok = false;
      report.warnings.push('XML سند خراب است.');
      return report;
    }

    // ۱) قالب صفحه
    if (opts.pageSetup !== false) {
      var secs = setPageSetup(doc);
      report.steps.push('قالب صفحه (A4 + حاشیهٔ استاندارد) روی ' + secs + ' بخش اعمال شد');
    }

    // ۲) راست‌به‌چپ
    if (opts.rtl !== false) {
      var nr = forceRtl(doc);
      report.counts.rtl = nr;
      report.steps.push('راست‌به‌چپ: ' + nr + ' پاراگراف');
    }

    // ۳) اصلاح حروف عربی
    if (opts.polish !== false) {
      var nf = fixArabicLetters(doc);
      report.counts.polished = nf;
      if (nf) report.steps.push('اصلاح حروف عربی (ي→ی، ك→ک): ' + nf + ' مورد');
    }

    // ۴) شناخت و قالب‌بندی سرتیترها
    if (opts.headings !== false) {
      var ps = wAll(doc, 'p'), nH = 0, nB = 0;
      for (var i = 0; i < ps.length; i++) {
        var type = detectHeading(ps[i]);
        if (!type) continue;
        var text = normalizeText(paraText(ps[i])).slice(0, 80);
        var brk = formatHeading(ps[i], type, doc);
        if (type === 'Fasl' || type === 'Al-Moqaddame' || type === 'Al-Khateme') {
          addHeadingBorder(ps[i], doc);
        }
        if (brk) nB++;
        nH++;
        report.headings.push({ type: type, text: text, level: LEVELS[type] || 2 });
      }
      report.counts.headings = nH;
      report.counts.pageBreaks = nB;
      report.steps.push('سرتیتر: ' + nH + ' عنوان شناسایی شد (' + nB + ' شکست صفحه)');
      if (!nH) report.warnings.push('هیچ سرتیتری شناسایی نشد — شاید قالب سند متفاوت است.');
    }

    // ۵) فاصلهٔ خطوط
    if (opts.spacing !== false) {
      var ns = setBodySpacing(doc);
      report.counts.spacing = ns;
      report.steps.push('فاصلهٔ خطوط ۱.۵ روی ' + ns + ' پاراگراف');
    }

    files[docName] = new TextEncoder().encode(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' +
      toXml(doc).replace(/^<\?xml[^>]*\?>\s*/, '')
    );

    return report;
  }

  global.TanzidEngine = {
    process: process,
    detectHeading: detectHeading,
    normalizeText: normalizeText,
    LEVELS: LEVELS,
    TOC_ONLY: TOC_ONLY
  };
})(window);
