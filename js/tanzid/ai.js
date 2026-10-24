/* ══════════════════════════════════════════════════════════════
   js/tanzid/ai.js — مراحل هوش مصنوعی تنضید ۱.۵ (AvalAI / DeepSeek)

   ساختار عیناً مثل footnote_reference_engine.py:
     ۱) استخراج ساختاریافته با AI (فقط JSON)
     ۲) قالب‌بندی قطعی در جاوااسکریپت (بدون دخالت AI)
   کلید API همان کلیدی است که در سورس تنضید ۱.۵ تعبیه شده بود.
   ══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var CFG = {
    url: 'https://api.avalai.ir/v1/chat/completions',
    key: 'aa-b2yjBwo5pagNW14xOQJeb2KOmx3tFPHlj23bx8N0l8ibt7HZ',
    model: 'deepseek-v4-flash',
    maxTokens: 32000,
    timeoutMs: 100000,
    retries: 3,
    backoffMs: 4000,
    batchSize: 15,
    concurrency: 2
  };

  var P = global.TANZID_AI_PROMPTS || {};
  var LABELS = P.LABELS || {};
  var LANGS = ['ar', 'fa', 'en'];
  var TYPE_ORDER = ['book', 'article', 'thesis', 'law'];
  var LANG_ORDER = ['ar', 'fa', 'en'];
  var TYPE_TITLES = P._TYPE_TITLES_BY_LANG || {};
  var LANG_TITLES = P._LANG_TITLES || {};

  function labels(lang) { return LABELS[lang] || LABELS.ar; }
  function comma(lang) { return lang === 'en' ? ', ' : '، '; }

  /* ── ابزار ────────────────────────────────────────────────── */
  function cleanKey() {
    return String(CFG.key || '').replace(/[^A-Za-z0-9\-_.]/g, '').trim();
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function stripFences(text) {
    var t = String(text || '').trim();
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    return t;
  }
  function extractJsonArray(raw) {
    var text = stripFences(raw);
    var start = text.indexOf('[');
    var end = text.lastIndexOf(']');
    if (start === -1 || end === -1 || end < start) {
      throw new Error('آرایهٔ JSON در پاسخ AI پیدا نشد. طول پاسخ: ' + text.length +
        '، ابتدای پاسخ: ' + JSON.stringify(text.slice(0, 200)));
    }
    return JSON.parse(text.slice(start, end + 1));
  }

  /* ── فراخوانی API با retry ────────────────────────────────── */
  function callAI(systemPrompt, userText, onLog) {
    var log = onLog || function () {};
    var body = {
      model: CFG.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText }
      ],
      max_tokens: CFG.maxTokens,
      thinking: { type: 'disabled' },
      reasoning_effort: 'none'
    };
    var payload = JSON.stringify(body);

    function once() {
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, CFG.timeoutMs) : null;
      return fetch(CFG.url, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + cleanKey(),
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: payload,
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (res) {
        if (timer) clearTimeout(timer);
        if (!res.ok) {
          return res.text().then(function (t) {
            throw new Error('API خطا برگرداند (status ' + res.status + '): ' + t.slice(0, 300));
          });
        }
        return res.json();
      }).then(function (data) {
        var choice = data && data.choices && data.choices[0];
        if (!choice) throw new Error('پاسخ API ساختار درست ندارد.');
        var content = choice.message ? choice.message.content : null;
        if (!content || !String(content).trim()) {
          throw new Error('پاسخ API محتوای خالی برگرداند (finish_reason=' +
            (choice.finish_reason || '?') + ').');
        }
        if (choice.finish_reason === 'length') {
          throw new Error('پاسخ API به سقف max_tokens رسید و بریده شد.');
        }
        return content;
      }).catch(function (err) {
        if (timer) clearTimeout(timer);
        throw err;
      });
    }

    var attempt = 0;
    function retry() {
      attempt++;
      return once().catch(function (err) {
        log('تلاش ' + attempt + ' از ' + CFG.retries + ' برای فراخوانی API شکست خورد: ' + err.message);
        if (attempt >= CFG.retries) throw err;
        return sleep(CFG.backoffMs * attempt).then(retry);
      });
    }
    return retry();
  }

  /* ── ارسال دسته‌ای و جمع‌آوری JSON ────────────────────────── */
  function extractItemsViaAI(items, systemPrompt, buildLine, onLog) {
    var log = onLog || function () {};
    if (!items.length) return Promise.resolve({});
    var batches = [];
    for (var i = 0; i < items.length; i += CFG.batchSize) batches.push(items.slice(i, i + CFG.batchSize));
    var results = {};
    var index = 0;

    function worker() {
      if (index >= batches.length) return Promise.resolve();
      var bi = index++;
      var batch = batches[bi];
      log('ارسال دستهٔ ' + (bi + 1) + ' از ' + batches.length + ' (' + batch.length + ' مورد) به هوش مصنوعی…');
      var userText = batch.map(buildLine).join('\n');
      return callAI(systemPrompt, userText, log).then(function (response) {
        var arr = extractJsonArray(response);
        arr.forEach(function (obj) {
          if (obj && obj.id != null) results[String(obj.id)] = obj;
        });
        log('دستهٔ ' + (bi + 1) + ' از ' + batches.length + ' تمام شد (' + arr.length + ' مورد).');
      }).catch(function (err) {
        log('HESHDAR: دستهٔ ' + (bi + 1) + ' شکست خورد: ' + err.message + ' — این موارد خام می‌مانند.');
      }).then(function () {
        if (index < batches.length) return worker();
      });
    }

    var runners = [];
    var n = Math.min(CFG.concurrency, batches.length);
    for (var r = 0; r < n; r++) runners.push(worker());
    return Promise.all(runners).then(function () { return results; });
  }

  /* ══════════════════════════════════════════════════════════
     بخش پاورقی‌ها — معادل توابع پایتون
     ══════════════════════════════════════════════════════════ */
  var DIGITS = '0-9۰-۹٠-٩';
  var LEAD_JUNK_RE = new RegExp('^[\\s\\u200e\\u200f\\u202a-\\u202e\\u2066-\\u2069\\ufeff.\\u06D4]+');
  var LEAD_NUMBER_RE = new RegExp('^(?:[\\(\\[' + DIGITS + ']{1,3}[\\)\\]]|[' + DIGITS +
    ']{1,3}[.\\u06D4)\\]:\\-\\u2013\\u2014\\u060C])(?![' + DIGITS + '])\\s*');

  function leadingPrefixLength(text) {
    var t = text || '';
    var pos = 0;
    for (var guard = 0; guard < 20; guard++) {
      var rest = t.slice(pos);
      var m = LEAD_JUNK_RE.exec(rest) || LEAD_NUMBER_RE.exec(rest);
      if (!m || m[0].length === 0) return pos;
      pos += m[0].length;
    }
    return pos;
  }
  function stripLeadingNumberAndDot(text) {
    if (!text) return '';
    var cut = leadingPrefixLength(text);
    var cleaned = text.slice(cut).trim();
    return cleaned || String(text).trim();
  }

  var SELF_REF_PATTERNS = [
    /[،,]?\s*همان\s+منبع\s+پیشین\s*/gi,
    /[،,]?\s*منبع\s+پیشین\s*/gi,
    /[،,]?\s*همان\s+منبع\s*(?=[،,\s]|$)/gi,
    /[،,]?\s*The\s+same\s+previous\s+source\s*/gi,
    /[،,]?\s*Previous\s+source\s*/gi,
    /،?\s*المصدر\s+نفسه\s*/gi,
    /،?\s*نفس\s+المصدر\s*/gi,
    /،?\s*المصدر\s+السابق\s*/gi
  ];
  function stripPriorSourcePhrases(text) {
    var had = false;
    var cleaned = String(text || '');
    SELF_REF_PATTERNS.forEach(function (re) {
      var next = cleaned.replace(re, '');
      if (next !== cleaned) had = true;
      cleaned = next;
    });
    cleaned = cleaned.replace(/[ \t]{2,}/g, ' ').replace(/^[\s.،\n]+|[\s.،\n]+$/g, '');
    return { text: cleaned, had: had };
  }
  function precleanFootnotes(items, log) {
    var n = 0;
    var out = items.map(function (item) {
      var noNumber = stripLeadingNumberAndDot(item.footnote_text);
      var r = stripPriorSourcePhrases(noNumber);
      var cleaned = r.text ? stripLeadingNumberAndDot(r.text) : r.text;
      if (r.had) n++;
      return {
        id: item.id,
        page: item.page,
        footnote_text: cleaned || noNumber,
        had_self_ref: r.had
      };
    });
    if (log && n) log('پیش‌پردازش: ' + n + ' پاورقی دارای «المصدر السابق/نفس المصدر» بود که پاک شد.');
    return out;
  }

  function combineOneAuthorFootnote(fRaw, lRaw, lang) {
    var first = String(fRaw || '').trim();
    var last = String(lRaw || '').trim();
    if (first && last) return first + comma(lang) + last;
    if (first && !last) return first;
    if (!first && last) return last;
    return '';
  }
  function combineAuthorsFootnote(authors, lang) {
    if (!authors || !authors.length) return '';
    return authors.map(function (a) { return combineOneAuthorFootnote(a.f, a.l, lang); })
      .filter(Boolean).join('، ');
  }
  function normalizeArabicFinal(text) {
    if (!text) return '';
    var t = /[\u0600-\u06FF]/.test(text) ? text.split('ی').join('ي') : text;
    return t.replace(/\s+و\s+/g, ' و');
  }
  function pageFromRaw(rawText) {
    var t = String(rawText || '');
    var m = /(?:ص|صفحه|الصفحة|pp?|pages?)\.?\s*([0-9۰-۹٠-٩]+(?:\s*[-–—]\s*[0-9۰-۹٠-٩]+)?)/i.exec(t);
    if (!m) return '';
    return m[1].replace(/[۰-۹]/g, function (c) {
      return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c));
    }).replace(/[٠-٩]/g, function (c) {
      return String('٠١٢٣٤٥٦٧٨٩'.indexOf(c));
    }).trim();
  }
  function pageStr(citedPage, lang, rawText) {
    if (lang === 'en') {
      if (citedPage) {
        var ev = String(citedPage).trim().replace(/^(?:pp?|pages?)[.\s]*/i, '').trim();
        return ev ? 'p. ' + ev : 'p.';
      }
      var m = /\b(?:pp?|pages?)(?![A-Za-z])\.?\s*\d+(?:\s*[-–—]\s*\d+)?/i.exec(rawText || '');
      return m ? m[0].trim() : 'p.';
    }
    var v = String(citedPage || '').trim().replace(/^(?:pp?|pages?|ص+|صفحه|الصفحة)\.?\s*/i, '').trim();
    if (!v) return labels(lang).page;
    var lab = /[0-9۰-۹٠-٩]\s*[-–—]\s*[0-9۰-۹٠-٩]/.test(v) ? labels(lang).pages : labels(lang).page;
    return lab + v; // tight: ص12
  }
  function localizeExtra(extra, lang) {
    if (!extra) return extra;
    var vol = labels(lang).volume;
    return String(extra).replace(
      /(?<![\u0600-\u06FFA-Za-z])(?:المجلد|مجلد|جلد|مج|ج|volume|vol)\s*\.?\s*(\d+)/gi,
      function (m, num) { return vol + ' ' + num; });
  }
  function finalizeFootnoteText(text, lang) {
    return lang === 'ar' ? normalizeArabicFinal(text) : text;
  }
  function formatFullReference(sourceType, authorRaw, titleRaw, year, extraRaw, citedPage, lang, rawText) {
    var parts = [];
    if (authorRaw) parts.push(authorRaw);
    if (year) parts.push('(' + year + ')');
    if (sourceType === 'article') { if (titleRaw) parts.push('«' + titleRaw + '»'); }
    else if (titleRaw) parts.push(titleRaw);
    extraRaw = localizeExtra(extraRaw, lang);
    if (extraRaw) parts.push(sourceType === 'thesis' ? '(' + extraRaw + ')' : extraRaw);
    var sep = comma(lang);
    var body = parts.filter(Boolean).join(sep);
    var pg = pageStr(citedPage, lang, rawText);
    body = body ? body + sep + pg : pg;
    return finalizeFootnoteText('. ' + body + '.', lang);
  }
  function formatSamePrev(citedPage, lang, rawText) {
    var pgv = String(citedPage || '').trim();
    if (!pgv) {
      return finalizeFootnoteText('. ' + labels(lang).prev_same + '.', lang);
    }
    return finalizeFootnoteText('. ' + labels(lang).prev_same + comma(lang) +
      pageStr(pgv, lang, rawText) + '.', lang);
  }
  function formatPrevWithAuthor(authorRaw, titleRaw, citedPage, multiSources, lang, rawText) {
    var sep = comma(lang);
    var pg = pageStr(citedPage, lang, rawText);
    var t = '. ' + authorRaw + sep + (multiSources && titleRaw ? titleRaw + sep : '') +
      labels(lang).prev + sep + pg + '.';
    return finalizeFootnoteText(t, lang);
  }
  function formatOtherFootnote(rawText, lang) {
    return finalizeFootnoteText('. ' + stripLeadingNumberAndDot(rawText), lang);
  }
  function isEnglishFootnote(text) {
    var t = String(text || '');
    var hasLatin = /[A-Za-z\u00C0-\u024F]/.test(t);
    return hasLatin && !/[\u0600-\u06FF]/.test(t);
  }
  function detectFootnoteLanguage(extracted, rawText, fallback) {
    if (isEnglishFootnote(rawText)) return 'en';
    var lg = extracted && extracted.lg;
    if (typeof lg === 'string' && LANGS.indexOf(lg.trim().toLowerCase()) !== -1) return lg.trim().toLowerCase();
    return LANGS.indexOf(fallback) !== -1 ? fallback : 'ar';
  }

  function normKey(text) {
    return String(text || '').replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
      .replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '')
      .replace(/[.,;:!?،؛؛؟\-–—_"'«»()\[\]{}]/g, ' ')
      .replace(/\s+/g, '').toLowerCase();
  }

  function resolveFootnotes(items, extractedById, defaultLang, log) {
    var registry = [];
    var finalList = [];
    var review = [];
    var prevSourceId = null;

    function matchOrCreate(authorsDisplay, titleRaw) {
      var authorKey = authorsDisplay.map(normKey).sort().join('|');
      var bestId = null, bestScore = null;
      registry.forEach(function (src) {
        if (src.authorKey !== authorKey) return;
        if (bestId === null) { bestId = src.id; }
      });
      if (bestId !== null) return { id: bestId, isNew: false };
      var id = registry.length + 1;
      registry.push({ id: id, authorKey: authorKey, titleRaw: titleRaw, authors: authorsDisplay });
      return { id: id, isNew: true };
    }
    function countSourcesForAuthors(authorsDisplay) {
      var key = authorsDisplay.map(normKey).sort().join('|');
      return registry.filter(function (s) { return s.authorKey === key; }).length;
    }

    items.forEach(function (item) {
      var fid = String(item.id);
      var extracted = extractedById[fid];
      var lang = detectFootnoteLanguage(extracted, item.footnote_text, defaultLang);
      if (!extracted) {
        finalList.push({ id: item.id, footnote_text: formatOtherFootnote(item.footnote_text, lang) });
        review.push({ id: item.id, reason: 'بدون پاسخ AI — متن خام نگه داشته شد' });
        prevSourceId = null;
        return;
      }
      if (!extracted.r) {
        finalList.push({ id: item.id, footnote_text: formatOtherFootnote(item.footnote_text, lang) });
        prevSourceId = null;
        return;
      }
      var authors = Array.isArray(extracted.au) ? extracted.au : [];
      var authorsDisplay = authors.map(function (a) {
        return combineOneAuthorFootnote(a.f, a.l, lang);
      }).filter(Boolean);
      var authorRaw = authorsDisplay.join(comma(lang));
      var titleRaw = extracted.t;
      if (!authorRaw && !titleRaw) {
        // اگر دانشجو خودش «المصدر السابق» نوشته و همان منبع قبلی است،
        // از همان قاعدهٔ «نفس المصدر» استفاده می‌کنیم (شمارهٔ صفحه از متن خام).
        if (item.had_self_ref && prevSourceId !== null) {
          finalList.push({
            id: item.id,
            footnote_text: formatSamePrev(pageFromRaw(item.footnote_text), lang, item.footnote_text)
          });
          return;
        }
        finalList.push({ id: item.id, footnote_text: formatOtherFootnote(item.footnote_text, lang) });
        review.push({ id: item.id, reason: 'بدون نویسنده و عنوان — قابل تشخیص نبود' });
        prevSourceId = null;
        return;
      }
      var m = matchOrCreate(authorsDisplay, titleRaw);
      var sourceId = m.id;
      var text;
      if (!item.had_self_ref) {
        if (sourceId === prevSourceId) text = formatSamePrev(extracted.p, lang, item.footnote_text);
        else text = formatFullReference(extracted.st, authorRaw, titleRaw, extracted.y,
          extracted.e, extracted.p, lang, item.footnote_text);
      } else if (sourceId === prevSourceId) {
        text = formatSamePrev(extracted.p, lang, item.footnote_text);
      } else {
        var src = registry.filter(function (s) { return s.id === sourceId; })[0];
        var nSources = countSourcesForAuthors(authorsDisplay);
        text = formatPrevWithAuthor(authorRaw, titleRaw || (src ? src.titleRaw : ''),
          extracted.p, nSources > 1, lang, item.footnote_text);
        review.push({ id: item.id, reason: 'دانشجو از قبل «المصدر السابق» نوشته بود — لطفاً تأیید کن' });
      }
      prevSourceId = sourceId;
      finalList.push({ id: item.id, footnote_text: text });
    });
    if (log) log('قالب‌بندی پاورقی‌ها انجام شد (' + finalList.length + ' مورد، ' + review.length + ' نیازمند بازبینی).');
    return { finalList: finalList, review: review };
  }

  /* ══════════════════════════════════════════════════════════
     بخش منابع
     ══════════════════════════════════════════════════════════ */
  var EXISTING_HEADERS = (P._EXISTING_HEADER_TITLES || []).slice();
  var DIGITS_RE = /[0-9۰-۹٠-٩]/;
  var LEADING_MARKER_RE = /^\s*[\(\[]?[0-9۰-۹٠-٩]{1,2}[\)\].:\-–—]\s*/;
  var TOKEN_STRIP = ' \t.:،؛;,-–—*()[]"\'«»\u200c\u200f\u200eـ';
  var TOKEN_STRIP_SET = {};
  for (var _tsi = 0; _tsi < TOKEN_STRIP.length; _tsi++) TOKEN_STRIP_SET[TOKEN_STRIP.charAt(_tsi)] = 1;

  function trimToken(t) {
    var a = 0, b = t.length;
    while (a < b && TOKEN_STRIP_SET[t.charAt(a)]) a++;
    while (b > a && TOKEN_STRIP_SET[t.charAt(b - 1)]) b--;
    return t.slice(a, b);
  }

  function normToken(token) {
    var t = String(token || '');
    t = t.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '');
    var pairs = [['ي', 'ی'], ['ى', 'ی'], ['ك', 'ک'], ['ة', 'ه'], ['أ', 'ا'], ['إ', 'ا'],
      ['آ', 'ا'], ['ٱ', 'ا'], ['ؤ', 'و'], ['ئ', 'ی']];
    pairs.forEach(function (p) { t = t.split(p[0]).join(p[1]); });
    t = t.split('\u200c').join('');
    t = trimToken(t).toLowerCase();
    if (t.indexOf('وال') === 0 && t.length > 5) t = t.slice(3);
    else if (t.indexOf('ال') === 0 && t.length > 4) t = t.slice(2);
    return t;
  }
  var NON_SOURCE_SET = {};
  (P.NON_SOURCE_WORDS || []).forEach(function (w) { var n = normToken(w); if (n) NON_SOURCE_SET[n] = 1; });

  function isCategoryLabelText(text, maxWords) {
    maxWords = maxWords || 7;
    var cleaned = String(text || '').trim().replace(/^\*+|\*+$/g, '').trim();
    cleaned = cleaned.replace(LEADING_MARKER_RE, '');
    if (!cleaned) return false;
    if (DIGITS_RE.test(cleaned)) return false;
    if (/[«»()\[\]]/.test(cleaned)) return false;
    var tokens = cleaned.split(/\s+/).map(normToken).filter(Boolean);
    if (!tokens.length || tokens.length > maxWords) return false;
    for (var i = 0; i < tokens.length; i++) {
      var tk = tokens[i];
      if (tk.length === 1) continue;
      if (!NON_SOURCE_SET[tk]) return false;
    }
    return true;
  }
  function stripExistingHeaders(lines) {
    return lines.filter(function (line) {
      var s = line.trim().replace(/^\*+|\*+$/g, '').trim();
      return EXISTING_HEADERS.indexOf(s) === -1;
    });
  }
  function splitReferenceParagraphs(rawText) {
    var lines = String(rawText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      .split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    lines = stripExistingHeaders(lines);
    return lines.map(function (l, i) { return { id: i + 1, text: l }; });
  }
  var QURAN_LINE_RE = /^[\s*]*القرآن\s+الكريم/;
  function extractQuranLines(items) {
    var quran = [], rest = [];
    items.forEach(function (item) {
      if (QURAN_LINE_RE.test(item.text)) {
        var remainder = item.text.replace(QURAN_LINE_RE, '').trim();
        if (remainder.replace(/[\s.:،؛;,\-–—*]/g, '')) quran.push(item.text);
        return;
      }
      rest.push(item);
    });
    return { quran: quran, rest: rest };
  }
  function filterNonSourceLines(items) {
    return items.filter(function (item) { return !isCategoryLabelText(item.text); });
  }

  function combineOneAuthorAcademic(fRaw, lRaw, language) {
    var first = String(fRaw || '').trim();
    var last = String(lRaw || '').trim();
    var c = language === 'en' ? ',' : '،';
    if (last && first) return last + c + ' ' + first;
    return last || first || '';
  }
  function combineAuthorsAcademic(authors, language) {
    if (!authors || !authors.length) return '';
    var parts = authors.map(function (a) { return combineOneAuthorAcademic(a.f, a.l, language); })
      .filter(Boolean);
    if (!parts.length) return '';
    return parts.join('؛ ') + '.';
  }
  function finalizeReferenceText(text, language) {
    return language === 'ar' ? normalizeArabicFinal(text) : text;
  }
  function formatBook(e) {
    var author = combineAuthorsAcademic(e.au, e.lg);
    var title = String(e.t || '').trim();
    var parts = [];
    if (author) parts.push(author);
    if (e.y) parts.push('(' + e.y + ').');
    if (title) parts.push(title + '.');
    var place = String(e.pl || '').trim();
    var publisher = String(e.pb || '').trim();
    if (place && publisher) parts.push(place + ': ' + publisher + '.');
    else if (publisher) parts.push(publisher + '.');
    else if (place) parts.push(place + '.');
    return finalizeReferenceText(parts.filter(Boolean).join(' '), e.lg);
  }
  function formatArticle(e) {
    var author = combineAuthorsAcademic(e.au, e.lg);
    var title = String(e.t || '').trim();
    var lg = LANGS.indexOf(e.lg) !== -1 ? e.lg : 'ar';
    var parts = [];
    if (author) parts.push(author);
    if (e.y) parts.push('(' + e.y + ').');
    if (title) parts.push('«' + title + '».');
    var bits = [];
    if (e.j) bits.push(String(e.j).trim());
    if (e.v) bits.push(labels(lg).volume + ' ' + e.v);
    if (e.is) bits.push(labels(lg).issue + ' ' + e.is);
    if (e.pg) bits.push(pageStr(e.pg, lg === 'en' ? 'en' : lg));
    if (bits.length) parts.push(bits.join(comma(lg)) + '.');
    return finalizeReferenceText(parts.filter(Boolean).join(' '), e.lg);
  }
  function formatThesis(e) {
    var author = combineAuthorsAcademic(e.au, e.lg);
    var title = String(e.t || '').trim();
    var parts = [];
    if (author) parts.push(author);
    if (e.y) parts.push('(' + e.y + ').');
    if (title) parts.push(title + '.');
    var tail = [String(e.tt || '').trim(), String(e.u || '').trim()].filter(Boolean);
    if (tail.length) parts.push(tail.join('، ') + '.');
    return finalizeReferenceText(parts.filter(Boolean).join(' '), e.lg);
  }
  function formatReferenceEntry(extracted, rawFallback) {
    var formatted = '';
    if (extracted.st === 'book') formatted = formatBook(extracted);
    else if (extracted.st === 'article') formatted = formatArticle(extracted);
    else if (extracted.st === 'thesis') formatted = formatThesis(extracted);
    return formatted || rawFallback;
  }
  function isAiFlaggedNonSource(extracted, text) {
    if (!extracted || extracted.ns !== true) return false;
    var cleaned = String(text || '').trim().replace(/^\*+|\*+$/g, '').trim();
    if (!cleaned || DIGITS_RE.test(cleaned)) return false;
    if (/[«»()\[\]]/.test(cleaned)) return false;
    return cleaned.split(/\s+/).length <= 6;
  }
  function assembleReferencesDocument(quranTexts, refItems, extractedById, log) {
    var buckets = {};
    refItems.forEach(function (item) {
      var extracted = extractedById[String(item.id)] || { lg: 'ar', st: 'book' };
      if (isAiFlaggedNonSource(extracted, item.text)) return;
      var lang = LANG_ORDER.indexOf(extracted.lg) !== -1 ? extracted.lg : 'ar';
      var stype = TYPE_ORDER.indexOf(extracted.st) !== -1 ? extracted.st : 'law';
      var key = lang + '|' + stype;
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(formatReferenceEntry(extracted, item.text));
    });
    var lines = ['**القرآن الكريم**'].concat(quranTexts);
    LANG_ORDER.forEach(function (lang) {
      var has = TYPE_ORDER.some(function (st) { return buckets[lang + '|' + st]; });
      if (!has) return;
      lines.push('**' + (LANG_TITLES[lang] || lang) + '**');
      TYPE_ORDER.forEach(function (st) {
        var arr = buckets[lang + '|' + st];
        if (!arr || !arr.length) return;
        lines.push('**' + ((TYPE_TITLES[lang] || {})[st] || st) + '**');
        lines = lines.concat(arr);
      });
    });
    return lines;
  }

  /* ── API عمومی ────────────────────────────────────────────── */
  function processFootnotes(items, defaultLang, onProgress) {
    var log = onProgress || function () {};
    var cleaned = precleanFootnotes(items, log);
    var prompt = P.FOOTNOTE_EXTRACT_PROMPT;
    if (!prompt) return Promise.reject(new Error('پرامپت پاورقی بارگذاری نشده است.'));
    return extractItemsViaAI(cleaned, prompt, function (it) {
      return it.id + '|' + (it.page == null ? '' : it.page) + '|' + it.footnote_text;
    }, log).then(function (extracted) {
      var r = resolveFootnotes(cleaned, extracted, defaultLang, log);
      return { final: r.finalList, review: r.review, total: cleaned.length };
    });
  }

  function processReferences(refsText, onProgress) {
    var log = onProgress || function () {};
    var items = splitReferenceParagraphs(refsText);
    if (!items.length) return Promise.resolve({ lines: [], total: 0, quran: 0, removed: 0 });
    var q = extractQuranLines(items);
    var rest = filterNonSourceLines(q.rest);
    var removed = items.length - rest.length - q.quran.length;
    if (log) log('منابع: ' + items.length + ' خط، ' + q.quran.length + ' قرآن، ' +
      rest.length + ' منبع برای ارسال به AI.');
    var prompt = P.REFERENCE_EXTRACT_PROMPT;
    if (!prompt) return Promise.reject(new Error('پرامپت منابع بارگذاری نشده است.'));
    return extractItemsViaAI(rest, prompt, function (it) {
      return it.id + '|' + it.text;
    }, log).then(function (extracted) {
      var lines = assembleReferencesDocument(q.quran, rest, extracted, log);
      return { lines: lines, total: rest.length, quran: q.quran.length, removed: removed };
    });
  }

  function isConfigured() { return !!cleanKey(); }

  function testConnection() {
    return callAI('You are a test. Reply with exactly: OK', 'ping').then(function (txt) {
      return { ok: true, reply: String(txt).trim().slice(0, 80) };
    });
  }

  global.TanzidAI = {
    CFG: CFG,
    isConfigured: isConfigured,
    testConnection: testConnection,
    processFootnotes: processFootnotes,
    processReferences: processReferences,
    _internal: {
      precleanFootnotes: precleanFootnotes,
      resolveFootnotes: resolveFootnotes,
      splitReferenceParagraphs: splitReferenceParagraphs,
      extractQuranLines: extractQuranLines,
      filterNonSourceLines: filterNonSourceLines,
      isCategoryLabelText: isCategoryLabelText,
      assembleReferencesDocument: assembleReferencesDocument,
      formatFullReference: formatFullReference,
      formatBook: formatBook,
      formatArticle: formatArticle,
      formatThesis: formatThesis,
      normalizeArabicFinal: normalizeArabicFinal,
      pageStr: pageStr,
      normToken: normToken,
      NON_SOURCE_SET: NON_SOURCE_SET
    }
  };
})(window);
