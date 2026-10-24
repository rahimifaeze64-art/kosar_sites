/* ══════════════════════════════════════════════════════════════
   js/tanzid/engine.js — موتور صفحه‌آرایی «تنضید» (نسخهٔ ۱.۵) در مرورگر

   منطق از کد بازیابی‌شدهٔ Tanzid 1.5 گرفته شده است:
     section_test.py               → تشخیص سرتیتر، استایل‌ها، سکشن/هدر
     section_page_setup.py         → A4 و حاشیه‌ها
     section_toc.py                → فهرست مطالب خودکار
     section_chapter_break.py      → سکشن‌بریک شروع متن فصل‌ها
     section_text_polish.py        → و/ی عربی و فاصلهٔ عنوان فصل
     section_english_footnotes.py  → انتقال متن انگلیسی به پاورقی

   به‌جای مدل شیء Word، مستقیماً روی XML فایل .docx کار می‌کند.
   مراحل «هوش مصنوعی» (ویرایش پاورقی/منابع) عمداً پیاده نشده‌اند؛
   بقیهٔ خط لوله کامل اجرا می‌شود.
   ══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  var R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  var CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
  var PR = 'http://schemas.openxmlformats.org/package/2006/relationships';
  var XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';
  var HDR_CT = 'application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml';
  var FTR_CT = 'application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml';
  var FNT_CT = 'application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml';
  var HDR_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/header';
  var FTR_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer';
  var FNT_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes';
  var SET_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings';

  /* ── ثابت‌های بازیابی‌شده از section_test.py ─────────────── */
  var HEADING_OUTLINE_LEVEL_MAP = {
    'Al-Moqaddame': 1, 'Fasl': 1, 'Al-Khateme': 1, 'Masader va Maraje': 1,
    'Mabhath': 2, 'Roos': 2, 'Nataej': 2, 'Tawsiyat': 2,
    'Matlab': 3, 'Far': 4
  };
  var HEADING_LEVEL_FONT_SIZE = { 1: 22, 2: 18, 3: 16, 4: 16 };
  var TOC_ONLY_HEADING_TYPES = ['Mabhath', 'Matlab', 'Far', 'Roos', 'Nataej', 'Tawsiyat'];
  var RIGHT_ALIGN_HEADING_LEVELS = [2, 3, 4];
  var HEADING_MAX_LENGTH = 200;
  var ARABIC_LEVEL_WORDS = [
    ['Fasl', 'الفصل'], ['Mabhath', 'المبحث'], ['Matlab', 'المطلب'], ['Far', 'الفرع']
  ];
  var PERSIAN_LEVEL_WORDS = [
    ['Fasl', 'فصل'], ['Mabhath', 'مبحث'], ['Mabhath', 'گفتار'], ['Matlab', 'مطلب'],
    ['Matlab', 'بند'], ['Far', 'فرع'], ['Far', 'نکته']
  ];
  var NATAEJ_VARIANTS = ['النتائج', 'النتایج', 'نتائج', 'نتایج'];
  var TAWSIYAT_VARIANTS = ['التوصيات', 'التوصیات', 'توصيات', 'توصیات', 'المقترحات', 'مقترحات'];
  var ROOS_THAMANIYA_WORDS = ['أولاً', 'ثانياً', 'ثالثاً', 'رابعاً', 'خامساً', 'سادساً', 'سابعاً', 'ثامناً'];
  var TOC_TITLE_VARIANTS = ['فهرس المحتويات', 'فهرس المحتویات', 'فهرست المحتويات', 'فهرست مطالب'];
  var THESIS_TITLE_SEARCH_VARIANTS = [
    'العنوان', 'عنوان', 'عنوان الرسالة', 'عنوان الأطروحة', 'عنوان البحث',
    'موضوع الرسالة', 'موضوع الأطروحة'
  ];
  var SENTENCE_END_CHARS = ['.', '؟', '?', '!', '۔'];
  var ROOS_NUMERIC_PATTERN = /^\s*([0-9١٢٣٤٥٦٧٨٩]{1,2})\s*[.:\-)]/;
  var _TRAILING_NUMBER_PUNCT = /[0-9۰-۹٠-٩.\-–—)(]+$/;

  var HEADER_FONT_NAME = 'Traditional Arabic';
  var HEADER_FONT_SIZE = 13;
  var TANZID_NORMAL_FONT = 'Traditional Arabic';
  var TANZID_NORMAL_SIZE = 15;

  var PAGE_TOP_TWIPS = 1984;
  var PAGE_SIDE_TWIPS = 1701;
  var A4_W = 11906, A4_H = 16838;
  var TOC_TAB_TWIPS = 8504;              // 15 cm = 425.2 pt

  /* ── وضعیت اجرا ──────────────────────────────────────────── */
  var LANG = 'ar';
  var quiet = false;
  var styleNameById = {};

  /* ══════════════════════════════════════════════════════════
     ابزارهای XML
     ══════════════════════════════════════════════════════════ */
  var parser = new DOMParser();
  var serializer = new XMLSerializer();

  function parseXml(text) { return parser.parseFromString(text, 'application/xml'); }
  function toXml(doc) { return serializer.serializeToString(doc); }
  function W_(doc, name, attrs) {
    var el = doc.createElementNS(W, 'w:' + name);
    if (attrs) for (var k in attrs) if (attrs.hasOwnProperty(k)) el.setAttributeNS(W, 'w:' + k, attrs[k]);
    return el;
  }
  function wOne(node, name) {
    if (!node) return null;
    var list = node.getElementsByTagNameNS(W, name);
    return list.length ? list[0] : null;
  }
  function wAll(node, name) {
    var list = node ? node.getElementsByTagNameNS(W, name) : [];
    return Array.prototype.slice.call(list);
  }
  /** فرزندان عنصر با نام محلی (مستقل از namespace) — برای [Content_Types] و rels */
  function elsByLocal(node, name) {
    if (!node) return [];
    var out = [];
    var all = node.getElementsByTagName('*');
    for (var i = 0; i < all.length; i++) {
      if (all[i].localName === name) out.push(all[i]);
    }
    return out;
  }
  function wAttr(el, name) { return el ? el.getAttributeNS(W, name) : null; }
  function wSet(el, name, val) { el.setAttributeNS(W, 'w:' + name, val); }

  var PPR_ORDER = ['pStyle', 'keepNext', 'keepLines', 'pageBreakBefore', 'framePr', 'widowControl',
    'numPr', 'suppressLineNumbers', 'pBdr', 'shd', 'tabs', 'suppressAutoHyphens', 'kinsoku',
    'wordWrap', 'overflowPunct', 'topLinePunct', 'autoSpaceDE', 'autoSpaceDN', 'bidi',
    'adjustRightInd', 'snapToGrid', 'spacing', 'ind', 'contextualSpacing', 'mirrorIndents',
    'suppressOverlap', 'jc', 'textDirection', 'textAlignment', 'textboxTightWrap', 'outlineLvl',
    'divId', 'cnfStyle', 'rPr', 'sectPr', 'pPrChange'];
  var SECT_ORDER = ['headerReference', 'footerReference', 'footnotePr', 'endnotePr', 'type',
    'pgSz', 'pgMar', 'paperSrc', 'pgBorders', 'lnNumType', 'pgNumType', 'cols', 'formProt',
    'vAlign', 'noEndnote', 'titlePg', 'textDirection', 'bidi', 'rtlGutter', 'docGrid',
    'printerSettings', 'sectPrChange'];
  var RPR_ORDER = ['rStyle', 'rFonts', 'b', 'bCs', 'i', 'iCs', 'caps', 'smallCaps', 'strike',
    'dstrike', 'outline', 'shadow', 'emboss', 'imprint', 'noProof', 'snapToGrid', 'vanish',
    'webHidden', 'color', 'spacing', 'w', 'kern', 'position', 'sz', 'szCs', 'highlight', 'u',
    'effect', 'bdr', 'shd', 'fitText', 'vertAlign', 'rtl', 'cs', 'em', 'lang', 'eastAsianLayout',
    'specVanish', 'oMath'];

  /** عنصر فرزند را با رعایت ترتیب اسکیما می‌سازد/برمی‌گرداند. */
  function ensureOrdered(parent, name, order) {
    var old = wOne(parent, name);
    if (old) return old;
    var el = W_(parent.ownerDocument, name);
    var want = order.indexOf(name), placed = false;
    for (var i = 0; i < parent.childNodes.length; i++) {
      var c = parent.childNodes[i];
      if (c.nodeType !== 1 || c.namespaceURI !== W) continue;
      var idx = order.indexOf(c.localName);
      if (idx === -1 || idx > want) { parent.insertBefore(el, c); placed = true; break; }
    }
    if (!placed) parent.appendChild(el);
    return el;
  }
  function pPr(p) { return ensureOrdered(p, 'pPr', PPR_ORDER); }
  function pprSet(p, name) { return ensureOrdered(pPr(p), name, PPR_ORDER); }
  function sectSet(sect, name) { return ensureOrdered(sect, name, SECT_ORDER); }
  function runRPr(r) { return ensureOrdered(r, 'rPr', RPR_ORDER); }
  function rprSet(r, name) { return ensureOrdered(runRPr(r), name, RPR_ORDER); }

  function escText(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ── متن پاراگراف ─────────────────────────────────────────── */
  function isVisibleTextNode(node, p) {
    var anc = node.parentNode;
    while (anc && anc !== p) {
      if (anc.localName === 'del' || anc.localName === 'instrText') return false;
      anc = anc.parentNode;
    }
    return true;
  }
  function paraText(p) {
    var out = '';
    var kids = p.getElementsByTagNameNS(W, 't');
    for (var i = 0; i < kids.length; i++) {
      if (!isVisibleTextNode(kids[i], p)) continue;
      out += kids[i].textContent;
    }
    return out;
  }
  function paraTextChars(p) {
    var arr = [];
    var nodes = p.getElementsByTagNameNS(W, 't');
    for (var i = 0; i < nodes.length; i++) {
      if (!isVisibleTextNode(nodes[i], p)) continue;
      arr.push({ node: nodes[i], text: nodes[i].textContent });
    }
    return arr;
  }

  /** فهرست پاراگراف‌های بدنه (به ترتیب سند، بدون پاراگراف جعبه‌متن). */
  function bodyParagraphs(doc) {
    var body = wOne(doc, 'body');
    var all = body ? wAll(body, 'p') : [];
    return all.filter(function (p) {
      var a = p.parentNode;
      while (a && a !== body) {
        if (a.localName === 'txbxContent') return false;
        a = a.parentNode;
      }
      return true;
    });
  }

  /* ══════════════════════════════════════════════════════════
     normalize_text — زنجیرهٔ دقیق سیزده‌مرحله‌ای
     ══════════════════════════════════════════════════════════ */
  var REPLACES = [
    ['ي', 'ی'], ['ى', 'ی'], ['ك', 'ک'], ['أ', 'ا'], ['إ', 'ا'], ['آ', 'ا'],
    ['ؤ', 'و'], ['ئ', 'ی'], ['ـ', ''], ['\u200c', ''], ['\u200d', ''],
    ['\ufeff', ''], ['\u200e', ''], ['\u200f', ''], [':', ''], ['：', '']
  ];
  function normalizeText(text) {
    if (!text) return '';
    var s = String(text).replace(/\r/g, '').replace(/\x07/g, '');
    for (var i = 0; i < REPLACES.length; i++) {
      s = s.split(REPLACES[i][0]).join(REPLACES[i][1]);
    }
    s = s.replace(/[\u064B-\u065F\u0670]/g, '');
    s = s.replace(/\s+/g, '');
    return s.trim().toLowerCase();
  }
  function isExactTitle(text, variants) {
    var t = normalizeText(text);
    for (var i = 0; i < variants.length; i++) {
      if (t === normalizeText(variants[i])) return true;
    }
    return false;
  }
  function looksLikeSentence(raw) {
    var s = raw ? String(raw).trim() : '';
    if (!s) return false;
    return SENTENCE_END_CHARS.indexOf(s.charAt(s.length - 1)) !== -1;
  }
  function isReasonableHeadingLength(raw) {
    if (!raw) return false;
    var s = String(raw).trim();
    if (!s) return false;
    if (typeof Array.from === 'function') return Array.from(s).length <= HEADING_MAX_LENGTH;
    return s.length <= HEADING_MAX_LENGTH;
  }
  function getFirstWord(raw) {
    if (!raw) return '';
    var text = String(raw).replace(/\u200c/g, ' ');
    var parts = text.split(/\s+/).filter(Boolean);
    if (!parts.length) return '';
    return normalizeText(parts[0].replace(_TRAILING_NUMBER_PUNCT, ''));
  }
  function detectLevelWordHeading(text, rawText) {
    var i;
    for (i = 0; i < ARABIC_LEVEL_WORDS.length; i++) {
      if (text.indexOf(normalizeText(ARABIC_LEVEL_WORDS[i][1])) === 0) return ARABIC_LEVEL_WORDS[i][0];
    }
    if (LANG === 'fa') {
      var first = getFirstWord(rawText);
      if (first) {
        for (i = 0; i < PERSIAN_LEVEL_WORDS.length; i++) {
          if (first === normalizeText(PERSIAN_LEVEL_WORDS[i][1])) return PERSIAN_LEVEL_WORDS[i][0];
        }
      }
    }
    return null;
  }
  function isRoosThamaniyaHeading(rawText) {
    var stripped = rawText ? String(rawText).trim() : '';
    if (!stripped) return false;
    var normalized = normalizeText(stripped);
    var remainder = null, i, word;
    for (i = 0; i < ROOS_THAMANIYA_WORDS.length; i++) {
      word = ROOS_THAMANIYA_WORDS[i];
      if (normalized.indexOf(normalizeText(word)) !== 0) continue;
      var base = String(word).replace(/[ًٌٍَُِّْ]/g, '');
      var re = new RegExp('^\\s*' + base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
        '[ًٌٍَُِّْ]*\\s*[:\\-]?\\s*');
      var m = re.exec(stripped);
      remainder = m ? stripped.slice(m[0].length) : stripped;
      break;
    }
    if (remainder === null) {
      var num = ROOS_NUMERIC_PATTERN.exec(stripped);
      if (num) {
        var digits = num[1].replace(/[١٢٣٤٥٦٧٨٩]/g, function (c) {
          return String('١٢٣٤٥٦٧٨٩'.indexOf(c) + 1);
        });
        var value = parseInt(digits, 10);
        if (value >= 1 && value <= 8) remainder = stripped.slice(num[0].length);
      }
    }
    if (remainder === null) return false;
    remainder = remainder.trim();
    if (!remainder) return true;
    if (looksLikeSentence(remainder)) return false;
    if (/[0-9\u0660-\u0669]/.test(remainder)) return false;
    if (remainder.indexOf('(') !== -1 || remainder.indexOf(')') !== -1) return false;
    if (remainder.split(/\s+/).filter(Boolean).length > 8) return false;
    return true;
  }

  /* ── استایل پاراگراف و تشخیص فهرست ───────────────────────── */
  function styleNameOf(p) {
    var pr = wOne(p, 'pPr');
    var st = pr && wOne(pr, 'pStyle');
    if (!st) return '';
    var id = wAttr(st, 'val');
    return styleNameById[id] || id || '';
  }
  function isTocParagraph(p) {
    var sn = styleNameOf(p);
    if (sn && (/TOC/i.test(sn) || /Contents/i.test(sn))) return true;
    var links = p.getElementsByTagNameNS(W, 'hyperlink');
    for (var i = 0; i < links.length; i++) {
      var anchor = wAttr(links[i], 'anchor') || '';
      if (anchor.indexOf('_Toc') === 0) return true;
    }
    var instr = p.getElementsByTagNameNS(W, 'instrText');
    for (var j = 0; j < instr.length; j++) {
      if (/\bTOC\b/.test(instr[j].textContent || '')) return true;
    }
    var txt = paraText(p);
    if (txt && /[.…]{3,}\s*[0-9٠-٩۰-۹]+\s*$/.test(txt)) return true;
    return false;
  }
  function buildTocRanges(paras) {
    var ranges = [];
    for (var i = 0; i < paras.length; i++) {
      var links = paras[i].getElementsByTagNameNS(W, 'hyperlink');
      for (var j = 0; j < links.length; j++) {
        var anchor = wAttr(links[j], 'anchor') || '';
        if (anchor.indexOf('_Toc') === 0) { ranges.push(i); break; }
      }
    }
    return ranges;
  }
  function detectHeading(p) {
    var raw = paraText(p);
    if (!raw) return null;
    var text = normalizeText(raw);
    if (!text) return null;
    if (isTocParagraph(p)) return null;
    if (isExactTitle(text, ['المقدمة', 'المقدمه'])) return 'Al-Moqaddame';
    if (isExactTitle(text, ['الخاتمة', 'الخاتمه'])) return 'Al-Khateme';
    if (isExactTitle(text, ['المصادر والمراجع', 'المصادر و المراجع'])) return 'Masader va Maraje';
    if (isExactTitle(text, NATAEJ_VARIANTS)) return 'Nataej';
    if (isExactTitle(text, TAWSIYAT_VARIANTS)) return 'Tawsiyat';
    if (isExactTitle(text, ['Abstract'])) return 'Abstract';
    if (isExactTitle(text, ['چکیده'])) return 'Chekide';
    if (isExactTitle(text, ['المستخلص'])) return 'Mostakhlas';
    if (isReasonableHeadingLength(raw) && isRoosThamaniyaHeading(raw)) return 'Roos';
    if (!isReasonableHeadingLength(raw)) return null;
    if (looksLikeSentence(raw)) return null;
    return detectLevelWordHeading(text, raw);
  }
  function getThesisTitle(paras) {
    var limit = Math.min(300, paras.length);
    for (var i = 0; i < limit; i++) {
      var p = paras[i];
      if (isTocParagraph(p)) continue;
      var raw = paraText(p);
      if (!raw) continue;
      if (!isExactTitle(raw, THESIS_TITLE_SEARCH_VARIANTS)) continue;
      if (i + 1 < paras.length) {
        var title = paraText(paras[i + 1]).trim();
        if (title) return title;
        continue;
      }
      return null;
    }
    return null;
  }

  /* ══════════════════════════════════════════════════════════
     مدیریت اجزای docx
     ══════════════════════════════════════════════════════════ */
  function decode(bytes) {
    if (bytes == null) return '';
    if (typeof bytes === 'string') return bytes;
    try { return new TextDecoder('utf-8').decode(bytes); } catch (e) { return ''; }
  }

  function Docx(files) {
    this.files = files;
    var txt = decode(files['word/document.xml']);
    if (!txt) throw new Error('word/document.xml در فایل پیدا نشد — این فایل docx نیست.');
    this.doc = parseXml(txt);
    if (this.doc.getElementsByTagName('parsererror').length) throw new Error('XML سند خراب است.');

    var stylesTxt = decode(files['word/styles.xml']);
    this.styles = stylesTxt ? parseXml(stylesTxt) : parseXml(XML_DECL +
      '<w:styles xmlns:w="' + W + '"><w:style w:type="paragraph" w:default="1" w:styleId="Normal">' +
      '<w:name w:val="Normal"/></w:style></w:styles>');

    var setTxt = decode(files['word/settings.xml']);
    this.settings = setTxt ? parseXml(setTxt) : null;

    this.ct = parseXml(decode(files['[Content_Types].xml']) ||
      XML_DECL + '<Types xmlns="' + CT + '"></Types>');
    this.rels = parseXml(decode(files['word/_rels/document.xml.rels']) ||
      XML_DECL + '<Relationships xmlns="' + PR + '"></Relationships>');

    var fntTxt = decode(files['word/footnotes.xml']);
    this.footnotes = fntTxt ? parseXml(fntTxt) : null;

    this._indexStyles();
    this._newParts = {};
  }
  Docx.prototype._indexStyles = function () {
    styleNameById = {};
    var st = wAll(this.styles, 'style');
    for (var i = 0; i < st.length; i++) {
      var id = wAttr(st[i], 'styleId');
      var nameEl = wOne(st[i], 'name');
      if (id) styleNameById[id] = nameEl ? wAttr(nameEl, 'val') : id;
    }
  };
  Docx.prototype.ensureContentType = function (partName, contentType) {
    var overrides = elsByLocal(this.ct, 'Override');
    for (var i = 0; i < overrides.length; i++) {
      if (overrides[i].getAttribute('PartName') === partName) {
        overrides[i].setAttribute('ContentType', contentType);
        return;
      }
    }
    var el = this.ct.createElementNS(CT, 'Override');
    el.setAttribute('PartName', partName);
    el.setAttribute('ContentType', contentType);
    this.ct.documentElement.appendChild(el);
  };
  Docx.prototype.ensureRel = function (type, target) {
    var rels = elsByLocal(this.rels, 'Relationship');
    for (var i = 0; i < rels.length; i++) {
      if (rels[i].getAttribute('Type') === type && rels[i].getAttribute('Target') === target) {
        return rels[i].getAttribute('Id');
      }
    }
    var id = 'rIdTz' + (rels.length + 1) + Math.floor(Math.random() * 1000);
    var el = this.rels.createElementNS(PR, 'Relationship');
    el.setAttribute('Id', id);
    el.setAttribute('Type', type);
    el.setAttribute('Target', target);
    this.rels.documentElement.appendChild(el);
    return id;
  };
  Docx.prototype.nextPartNumber = function (prefix) {
    var n = 1, name;
    do {
      name = 'word/' + prefix + n + '.xml';
      n++;
    } while (this.files[name] || this._newParts[name]);
    this._newParts[name] = true;
    return name;
  };
  Docx.prototype.addPart = function (name, xml, contentType, relType) {
    this.files[name] = xml;
    this.ensureContentType('/' + name, contentType);
    var target = name.replace(/^word\//, '');
    return this.ensureRel(relType, target);
  };
  Docx.prototype.save = function () {
    this.files['word/document.xml'] = toXml(this.doc);
    this.files['word/styles.xml'] = toXml(this.styles);
    if (this.settings) this.files['word/settings.xml'] = toXml(this.settings);
    if (this.footnotes) this.files['word/footnotes.xml'] = toXml(this.footnotes);
    this.files['[Content_Types].xml'] = toXml(this.ct);
    this.files['word/_rels/document.xml.rels'] = toXml(this.rels);
  };

  /* ══════════════════════════════════════════════════════════
     ۱) قالب صفحه (section_page_setup.py)
     ══════════════════════════════════════════════════════════ */
  function allSectPr(doc) { return wAll(doc, 'sectPr'); }

  function applyPageSetup(dx) {
    var sects = allSectPr(dx.doc);
    for (var i = 0; i < sects.length; i++) {
      var s = sects[i];
      var pgSz = sectSet(s, 'pgSz');
      wSet(pgSz, 'w', String(A4_W));
      wSet(pgSz, 'h', String(A4_H));
      if (!wAttr(pgSz, 'orient')) wSet(pgSz, 'orient', 'portrait');
      var pgMar = sectSet(s, 'pgMar');
      wSet(pgMar, 'top', String(PAGE_TOP_TWIPS));
      wSet(pgMar, 'bottom', String(PAGE_SIDE_TWIPS));
      wSet(pgMar, 'left', String(PAGE_SIDE_TWIPS));
      wSet(pgMar, 'right', String(PAGE_SIDE_TWIPS));
      wSet(pgMar, 'gutter', '0');
      wSet(pgMar, 'header', '709');
      wSet(pgMar, 'footer', '709');
    }
    return sects.length;
  }

  /* ══════════════════════════════════════════════════════════
     ۲) پاک‌سازی ساختار قبلی
     ══════════════════════════════════════════════════════════ */
  function resetStructure(dx) {
    var doc = dx.doc;
    var body = wOne(doc, 'body');
    if (!body) return 0;
    var sects = allSectPr(doc);
    var finalSect = null;
    for (var i = 0; i < sects.length; i++) {
      if (sects[i].parentNode === body) finalSect = sects[i];
    }
    for (var j = 0; j < sects.length; j++) {
      var s = sects[j];
      if (s !== finalSect && s.parentNode && s.parentNode.localName === 'pPr') {
        s.parentNode.removeChild(s);
      }
    }
    if (!finalSect) {
      finalSect = W_(doc, 'sectPr');
      body.appendChild(finalSect);
    }
    var kids = Array.prototype.slice.call(finalSect.childNodes);
    kids.forEach(function (c) {
      if (c.nodeType === 1 && (c.localName === 'headerReference' ||
          c.localName === 'footerReference' || c.localName === 'titlePg')) {
        finalSect.removeChild(c);
      }
    });
    if (dx.settings) {
      var eo = wOne(dx.settings, 'evenAndOddHeaders');
      if (eo && eo.parentNode) eo.parentNode.removeChild(eo);
    }
    cleanupOrphanHeaders(dx);
    return 1;
  }

  /** هدر/فوترهای قبلی که دیگر ارجاعی ندارند حذف شوند (جلوگیری از انباشت). */
  function cleanupOrphanHeaders(dx) {
    var rels = elsByLocal(dx.rels, 'Relationship');
    for (var i = rels.length - 1; i >= 0; i--) {
      var rel = rels[i];
      var type = rel.getAttribute('Type');
      if (type !== HDR_REL && type !== FTR_REL) continue;
      var target = rel.getAttribute('Target') || '';
      var partName = target.indexOf('word/') === 0 ? target : 'word/' + target;
      if (dx.files[partName]) delete dx.files[partName];
      var ct = elsByLocal(dx.ct, 'Override');
      for (var k = ct.length - 1; k >= 0; k--) {
        if (ct[k].getAttribute('PartName') === '/' + partName) ct[k].parentNode.removeChild(ct[k]);
      }
      rel.parentNode.removeChild(rel);
    }
  }

  /* ══════════════════════════════════════════════════════════
     ۳) اسکن سرتیترها
     ══════════════════════════════════════════════════════════ */
  function indexParagraphs(doc) {
    var paras = bodyParagraphs(doc);
    for (var i = 0; i < paras.length; i++) paras[i]._tzIndex = i;
    return paras;
  }
  function scanHeadings(paras) {
    var found = [];
    var moqStart = null, moqEnd = null;
    for (var i = 0; i < paras.length; i++) {
      var ht = detectHeading(paras[i]);
      var raw = paraText(paras[i]).trim();
      if (!ht) continue;
      found.push({ index: i, type: ht, text: raw });
      if (ht === 'Al-Moqaddame' && moqStart === null) moqStart = i;
      else if (moqStart !== null && moqEnd === null && ht === 'Fasl') moqEnd = i;
    }
    if (moqStart !== null && moqEnd === null) moqEnd = paras.length;
    var targets = [], tocOnly = [], headings = [];
    for (var k = 0; k < found.length; k++) {
      var f = found[k];
      if (f.type === 'Roos') {
        var inside = moqStart !== null && moqEnd !== null && f.index >= moqStart && f.index < moqEnd;
        if (!inside) continue;
      }
      if (f.type === 'Chekide' || f.type === 'Mostakhlas') continue;
      headings.push({ type: f.type, text: f.text, level: HEADING_OUTLINE_LEVEL_MAP[f.type] || 0 });
      if (TOC_ONLY_HEADING_TYPES.indexOf(f.type) !== -1) tocOnly.push(f);
      else targets.push(f);
    }
    return { all: found, targets: targets, tocOnly: tocOnly, headings: headings, moqStart: moqStart, moqEnd: moqEnd };
  }

  /* ══════════════════════════════════════════════════════════
     ۴) شکست سکشن قبل از عناوین سطح ۱ (odd page)
     ══════════════════════════════════════════════════════════ */
  function prevParagraph(p) {
    var el = p.previousSibling;
    while (el && !(el.nodeType === 1 && el.localName === 'p')) el = el.previousSibling;
    return el;
  }
  function nextParagraph(p) {
    var el = p.nextSibling;
    while (el && !(el.nodeType === 1 && el.localName === 'p')) el = el.nextSibling;
    return el;
  }
  function bodyFinalSect(doc) {
    var body = wOne(doc, 'body');
    var sects = wAll(body, 'sectPr').filter(function (s) { return s.parentNode === body; });
    return sects.length ? sects[sects.length - 1] : null;
  }
  function cloneSectBase(doc, template) {
    var s = W_(doc, 'sectPr');
    if (template) {
      var kids = Array.prototype.slice.call(template.childNodes);
      kids.forEach(function (c) {
        if (c.nodeType !== 1) return;
        if (c.localName === 'headerReference' || c.localName === 'footerReference' ||
            c.localName === 'titlePg' || c.localName === 'type') return;
        s.appendChild(c.cloneNode(true));
      });
    }
    return s;
  }
  function removePageBreakRuns(p) {
    var runs = wAll(p, 'r');
    for (var i = 0; i < runs.length; i++) {
      var brs = wAll(runs[i], 'br');
      for (var j = 0; j < brs.length; j++) {
        if (wAttr(brs[j], 'type') === 'page') brs[j].parentNode.removeChild(brs[j]);
      }
    }
  }
  function hasPageBreakBefore(p) {
    var pr = wOne(p, 'pPr');
    return !!(pr && wOne(pr, 'pageBreakBefore'));
  }
  function setPageBreakBefore(p) {
    var el = pprSet(p, 'pageBreakBefore');
    if (wAttr(el, 'val') === '0' || wAttr(el, 'val') === 'false') wSet(el, 'val', '1');
    return el;
  }
  function ensurePageBreakAfter(p) {
    var next = nextParagraph(p);
    if (next && hasPageBreakBefore(next)) return false;
    var lastRun = null;
    var kids = p.childNodes;
    for (var i = kids.length - 1; i >= 0; i--) {
      if (kids[i].nodeType === 1 && kids[i].localName === 'r') { lastRun = kids[i]; break; }
    }
    var brRun;
    if (lastRun && !wOne(lastRun, 't') && !lastRun.getElementsByTagNameNS(W, 'br').length) {
      brRun = lastRun;
    } else {
      brRun = W_(p.ownerDocument, 'r');
      p.appendChild(brRun);
    }
    var br = W_(p.ownerDocument, 'br');
    wSet(br, 'type', 'page');
    brRun.appendChild(br);
    return true;
  }

  function insertSectionBreaks(dx, scan) {
    var doc = dx.doc;
    var template = bodyFinalSect(doc);
    var targets = scan.targets;
    var added = 0;
    for (var i = targets.length - 1; i >= 0; i--) {
      var t = targets[i];
      var paras = bodyParagraphs(doc);
      var hp = paras[t.index];
      if (!hp) {
        // موقعیت بعد از درج‌های قبلی جابه‌جا شده — بر اساس متن پیدا کن
        for (var q = 0; q < paras.length; q++) {
          if (paraText(paras[q]).trim() === t.text) { hp = paras[q]; break; }
        }
        if (!hp) continue;
      }
      if (t.type === 'Fasl') ensurePageBreakAfter(hp);
      var prev = prevParagraph(hp);
      if (!prev) {
        prev = W_(doc, 'p');
        hp.parentNode.insertBefore(prev, hp);
      }
      var sect = wOne(prev, 'pPr') && wOne(wOne(prev, 'pPr'), 'sectPr');
      if (!sect) {
        sect = cloneSectBase(doc, template);
        pPr(prev).appendChild(sect);
      }
      var type = sectSet(sect, 'type');
      wSet(type, 'val', 'oddPage');
      added++;
    }
    return added;
  }

  /* ══════════════════════════════════════════════════════════
     ۵) هدرگذاری: عنوان فصل + شمارهٔ صفحه
     ══════════════════════════════════════════════════════════ */
  function cleanHeaderTitle(text) {
    var s = String(text == null ? '' : text);
    s = s.replace(/[\x0b\x0c\r\n\x07\u2028\u2029]/g, ' ');
    return s.replace(/\s+/g, ' ').trim();
  }
  function headerXml(titleText, opts) {
    opts = opts || {};
    var rtl = opts.rtl !== false;
    var align = opts.align || (rtl ? 'right' : 'left');
    var size = HEADER_FONT_SIZE * 2;
    var pPr = '<w:pPr>' +
      '<w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="auto"/></w:pBdr>' +
      (rtl ? '<w:bidi/>' : '') +
      '<w:jc w:val="' + align + '"/>' +
      '</w:pPr>';
    var rPr = '<w:rPr><w:rFonts w:ascii="' + HEADER_FONT_NAME + '" w:hAnsi="' +
      HEADER_FONT_NAME + '" w:cs="' + HEADER_FONT_NAME + '"/>' +
      '<w:sz w:val="' + size + '"/><w:szCs w:val="' + size + '"/>' +
      (rtl ? '<w:rtl/>' : '') + '</w:rPr>';
    var content = '';
    if (titleText) {
      content += '<w:r>' + rPr + '<w:t xml:space="preserve">' + escText(titleText) + '</w:t></w:r>';
    }
    content += '<w:r>' + rPr + '<w:ptab w:alignment="left" w:relativeTo="indent"/></w:r>';
    content += '<w:r>' + rPr + '<w:fldChar w:fldCharType="begin"/></w:r>' +
      '<w:r>' + rPr + '<w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>' +
      '<w:r>' + rPr + '<w:fldChar w:fldCharType="separate"/></w:r>' +
      '<w:r>' + rPr + '<w:t>1</w:t></w:r>' +
      '<w:r>' + rPr + '<w:fldChar w:fldCharType="end"/></w:r>';
    return XML_DECL + '<w:hdr xmlns:w="' + W + '" xmlns:r="' + R + '">' +
      '<w:p>' + pPr + content + '</w:p></w:hdr>';
  }
  function emptyHeaderXml() {
    return XML_DECL + '<w:hdr xmlns:w="' + W + '" xmlns:r="' + R + '"><w:p><w:pPr/></w:p></w:hdr>';
  }
  function addHeaderPart(dx, xml) {
    var name = dx.nextPartNumber('header');
    return dx.addPart(name, xml, HDR_CT, HDR_REL);
  }
  function setHeaderRef(dx, sect, type, rid) {
    var refs = wAll(sect, 'headerReference');
    for (var i = 0; i < refs.length; i++) {
      if (wAttr(refs[i], 'type') === type) refs[i].parentNode.removeChild(refs[i]);
    }
    var el = W_(dx.doc, 'headerReference');
    wSet(el, 'type', type);
    el.setAttributeNS(R, 'r:id', rid);
    var firstNonRef = null;
    for (var j = 0; j < sect.childNodes.length; j++) {
      var c = sect.childNodes[j];
      if (c.nodeType === 1 && c.localName !== 'headerReference' && c.localName !== 'footerReference') {
        firstNonRef = c; break;
      }
    }
    if (firstNonRef) sect.insertBefore(el, firstNonRef);
    else sect.appendChild(el);
  }
  function ensureTitlePg(sect) {
    var tp = wOne(sect, 'titlePg');
    if (!tp) tp = sectSet(sect, 'titlePg');
    if (wAttr(tp, 'val') === '0' || wAttr(tp, 'val') === 'false') wSet(tp, 'val', '1');
  }
  function ensureSettingsFlag(dx, name) {
    if (!dx.settings) {
      dx.settings = parseXml(XML_DECL + '<w:settings xmlns:w="' + W + '"></w:settings>');
      dx.files['word/settings.xml'] = toXml(dx.settings);
      dx.ensureContentType('/word/settings.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml');
      dx.ensureRel(SET_REL, 'settings.xml');
    }
    var el = wOne(dx.settings, name);
    if (!el) {
      el = W_(dx.settings, name);
      dx.settings.documentElement.appendChild(el);
    }
    return el;
  }

  function writeHeaders(dx, scan, thesisTitle) {
    var doc = dx.doc;
    var sects = allSectPr(doc);
    var L = sects.length;
    var targets = scan.targets;
    if (L < 2) return { sections: L, headers: 0 };
    if (L !== targets.length + 1) {
      reportWarn('تعداد سکشن‌ها (' + L + ') با تعداد عناوین (' + targets.length +
        ') هم‌خوانی کامل ندارد؛ هدرگذاری با بهترین تطبیق انجام شد.');
    }
    ensureSettingsFlag(dx, 'evenAndOddHeaders');
    var headerCount = 0;
    var evenTitle = cleanHeaderTitle(thesisTitle || '');
    for (var sec = 2; sec <= L - 1; sec++) {
      var sect = sects[sec - 1];
      if (!sect) continue;
      var title = sec - 2 < targets.length ? cleanHeaderTitle(targets[sec - 2].text) : '';
      ensureTitlePg(sect);
      var rid = addHeaderPart(dx, headerXml(title, { rtl: true }));
      setHeaderRef(dx, sect, 'default', rid);
      headerCount++;
      if (sec === 2 && evenTitle) {
        var ridEven = addHeaderPart(dx, headerXml(evenTitle, { rtl: true }));
        setHeaderRef(dx, sect, 'even', ridEven);
        headerCount++;
      }
      if (sec === 2) {
        var ridFirst = addHeaderPart(dx, emptyHeaderXml());
        setHeaderRef(dx, sect, 'first', ridFirst);
        headerCount++;
      }
      var pgNum = sectSet(sect, 'pgNumType');
      wSet(pgNum, 'fmt', 'decimal');
      if (sec === 2) wSet(pgNum, 'start', '1');
    }
    var lastSect = sects[L - 1];
    if (lastSect) {
      ['default', 'first', 'even'].forEach(function (t) {
        var ridEmpty = addHeaderPart(dx, emptyHeaderXml());
        setHeaderRef(dx, lastSect, t, ridEmpty);
        headerCount++;
      });
      ensureTitlePg(lastSect);
    }
    return { sections: L, headers: headerCount };
  }

  /* ══════════════════════════════════════════════════════════
     ۶) سکشن‌بریک شروع متن فصل‌ها + ۵ پاراگراف خالی
     ══════════════════════════════════════════════════════════ */
  var BODY_TOP_BLANK_PARAGRAPHS = 5;
  function isBlankParagraph(p) {
    var raw = paraText(p);
    if (raw) {
      for (var i = 0; i < raw.length; i++) {
        var ch = raw.charAt(i);
        if (!(/\s/.test(ch) || /[\u200b-\u200f\u202a-\u202e\ufeff]/.test(ch))) return false;
      }
    }
    if (p.getElementsByTagNameNS(W, 'drawing').length) return false;
    if (p.getElementsByTagNameNS(W, 'pict').length) return false;
    if (p.getElementsByTagNameNS(W, 'footnoteReference').length) return false;
    return true;
  }
  function removeParagraph(p) { if (p && p.parentNode) p.parentNode.removeChild(p); }

  function insertChapterBreaks(dx, scan) {
    var doc = dx.doc;
    var fasl = scan.targets.filter(function (t) { return t.type === 'Fasl'; });
    if (!fasl.length) return 0;
    var template = bodyFinalSect(doc);
    var added = 0;
    for (var i = fasl.length - 1; i >= 0; i--) {
      var paras = bodyParagraphs(doc);
      var ti = -1;
      for (var k = 0; k < paras.length; k++) {
        if (paraText(paras[k]).trim() === fasl[i].text) { ti = k; break; }
      }
      if (ti === -1) continue;
      var titleP = paras[ti];
      var bodyP = null, j = ti + 1;
      while (j < paras.length && j < ti + 41) {
        if (!isBlankParagraph(paras[j])) { bodyP = paras[j]; break; }
        j++;
      }
      if (!bodyP) continue;
      for (var m = j - 1; m > ti; m--) {
        if (isBlankParagraph(paras[m])) removeParagraph(paras[m]);
      }
      removePageBreakRuns(titleP);
      var sect = wOne(wOne(titleP, 'pPr') || W_(doc, 'pPr'), 'sectPr');
      if (!sect) {
        sect = cloneSectBase(doc, template);
        pPr(titleP).appendChild(sect);
      }
      var type = sectSet(sect, 'type');
      wSet(type, 'val', 'nextPage');
      ensureTitlePg(sect);
      var anchor = titleP.nextSibling;
      for (var b = 0; b < BODY_TOP_BLANK_PARAGRAPHS; b++) {
        var np = W_(doc, 'p');
        var pr = W_(doc, 'pPr');
        var ol = W_(doc, 'outlineLvl');
        wSet(ol, 'val', '9');
        pr.appendChild(ol);
        np.appendChild(pr);
        titleP.parentNode.insertBefore(np, anchor);
      }
      added++;
    }
    return added;
  }

  /* ══════════════════════════════════════════════════════════
     ۷) استایل‌ها و سطح‌های سرتیتر
     ══════════════════════════════════════════════════════════ */
  function styleExists(dx, id) {
    var st = wAll(dx.styles, 'style');
    for (var i = 0; i < st.length; i++) if (wAttr(st[i], 'styleId') === id) return st[i];
    return null;
  }
  function appendStyle(dx, xml) {
    var frag = parseXml(XML_DECL + '<w:styles xmlns:w="' + W + '">' + xml + '</w:styles>');
    var st = wOne(frag, 'style');
    var imported = dx.styles.importNode(st, true);
    dx.styles.documentElement.appendChild(imported);
    var nameEl = wOne(imported, 'name');
    if (wAttr(imported, 'styleId')) styleNameById[wAttr(imported, 'styleId')] = nameEl ? wAttr(nameEl, 'val') : '';
    return imported;
  }
  function ensureHeadingStyles(dx) {
    for (var level = 1; level <= 4; level++) {
      var id = 'TanzidHeading' + level;
      if (styleExists(dx, id)) continue;
      var size = HEADING_LEVEL_FONT_SIZE[level] * 2;
      var align = level === 1 ? '<w:jc w:val="center"/>' : '<w:bidi/><w:jc w:val="right"/>';
      appendStyle(dx,
        '<w:style w:type="paragraph" w:styleId="' + id + '"><w:name w:val="Tanzid Heading ' + level + '"/>' +
        '<w:basedOn w:val="Normal"/><w:qFormat/>' +
        '<w:pPr><w:keepNext/><w:outlineLvl w:val="' + (level - 1) + '"/>' + align + '</w:pPr>' +
        '<w:rPr><w:b/><w:bCs/><w:sz w:val="' + size + '"/><w:szCs w:val="' + size + '"/></w:rPr></w:style>');
    }
    if (!styleExists(dx, 'TanzidNormal')) {
      appendStyle(dx,
        '<w:style w:type="paragraph" w:styleId="TanzidNormal"><w:name w:val="Tanzid Normal"/>' +
        '<w:basedOn w:val="Normal"/>' +
        '<w:pPr><w:bidi/><w:jc w:val="both"/>' +
        '<w:ind w:left="0" w:right="0" w:firstLine="283"/>' +
        '<w:spacing w:line="276" w:lineRule="auto"/><w:outlineLvl w:val="9"/></w:pPr>' +
        '<w:rPr><w:rFonts w:ascii="' + TANZID_NORMAL_FONT + '" w:hAnsi="' + TANZID_NORMAL_FONT +
        '" w:cs="' + TANZID_NORMAL_FONT + '"/><w:sz w:val="' + (TANZID_NORMAL_SIZE * 2) +
        '"/><w:szCs w:val="' + (TANZID_NORMAL_SIZE * 2) + '"/></w:rPr></w:style>');
    }
  }
  function setParagraphStyle(p, styleId) {
    var st = pprSet(p, 'pStyle');
    wSet(st, 'val', styleId);
  }
  function setOutlineLevel(p, levelOneBased) {
    var ol = pprSet(p, 'outlineLvl');
    wSet(ol, 'val', String(levelOneBased - 1));
  }
  function setRunSizeAndBold(p, sizePt) {
    var runs = wAll(p, 'r');
    for (var i = 0; i < runs.length; i++) {
      var r = runs[i];
      var sz = rprSet(r, 'sz');
      wSet(sz, 'val', String(sizePt * 2));
      var szCs = rprSet(r, 'szCs');
      wSet(szCs, 'val', String(sizePt * 2));
      if (!wOne(runRPr(r), 'b')) {
        var b = W_(p.ownerDocument, 'b');
        var rp = runRPr(r);
        var rf = wOne(rp, 'rFonts');
        if (rf && rf.nextSibling) rp.insertBefore(b, rf.nextSibling);
        else rp.appendChild(b);
      }
      if (!wOne(runRPr(r), 'bCs')) rprSet(r, 'bCs');
    }
  }
  function clearBottomBorder(p) {
    var pr = wOne(p, 'pPr');
    if (!pr) return;
    var bdr = wOne(pr, 'pBdr');
    if (!bdr) return;
    var bottom = wOne(bdr, 'bottom');
    if (bottom) bottom.parentNode.removeChild(bottom);
    if (!bdr.childNodes.length) bdr.parentNode.removeChild(bdr);
  }
  function formatHeadings(dx, scan) {
    var doc = dx.doc;
    indexParagraphs(doc);
    ensureHeadingStyles(dx);
    var assigned = 0, reset = 0;
    var paras = bodyParagraphs(doc);
    for (var i = 0; i < paras.length; i++) {
      var p = paras[i];
      var ht = detectHeading(p);
      if (ht === 'Roos') {
        var inside = scan.moqStart !== null && scan.moqEnd !== null && i >= scan.moqStart && i < scan.moqEnd;
        if (!inside) ht = null;
      }
      if (ht && HEADING_OUTLINE_LEVEL_MAP[ht]) {
        var level = HEADING_OUTLINE_LEVEL_MAP[ht];
        setParagraphStyle(p, 'TanzidHeading' + level);
        setOutlineLevel(p, level);
        setRunSizeAndBold(p, HEADING_LEVEL_FONT_SIZE[level]);
        clearBottomBorder(p);
        if (RIGHT_ALIGN_HEADING_LEVELS.indexOf(level) !== -1) {
          pprSet(p, 'bidi');
          var jc2 = pprSet(p, 'jc');
          wSet(jc2, 'val', 'right');
        } else {
          var jc1 = pprSet(p, 'jc');
          wSet(jc1, 'val', 'center');
        }
        if (ht === 'Fasl') {
          var sp = pprSet(p, 'spacing');
          wSet(sp, 'before', '4200');
          wSet(sp, 'after', '0');
          var jcF = pprSet(p, 'jc');
          wSet(jcF, 'val', 'center');
        }
        assigned++;
      } else {
        var pr = wOne(p, 'pPr');
        var olEl = pr && wOne(pr, 'outlineLvl');
        var cur = olEl ? parseInt(wAttr(olEl, 'val'), 10) : 9;
        var isTocTitle = isExactTitle(paraText(p), TOC_TITLE_VARIANTS);
        if (cur !== 9) {
          setOutlineLevel(p, 10);
          if (!isTocTitle) setParagraphStyle(p, 'TanzidNormal');
          reset++;
        }
      }
    }
    return { assigned: assigned, reset: reset };
  }

  /* ══════════════════════════════════════════════════════════
     ۸) فهرست مطالب
     ══════════════════════════════════════════════════════════ */
  function ensureTocStyles(dx) {
    var specs = [[1, 15, true, 0], [2, 14, false, 221], [3, 14, false, 442], [4, 14, false, 663]];
    for (var i = 0; i < specs.length; i++) {
      var id = 'TOC' + specs[i][0];
      var st = styleExists(dx, id);
      if (!st) {
        st = appendStyle(dx,
          '<w:style w:type="paragraph" w:styleId="' + id + '"><w:name w:val="toc ' + specs[i][0] + '"/>' +
          '<w:basedOn w:val="Normal"/><w:qFormat/>' +
          '<w:pPr><w:bidi/>' + (specs[i][0] === 1 ? '' : '<w:jc w:val="both"/>') +
          '<w:ind w:left="' + specs[i][3] + '" w:right="0" w:firstLine="0"/>' +
          '<w:spacing w:before="' + (specs[i][0] === 1 ? 120 : 0) + '" w:after="0" w:line="276" w:lineRule="auto"/>' +
          '</w:pPr>' +
          '<w:rPr><w:rFonts w:ascii="Traditional Arabic" w:hAnsi="Traditional Arabic" w:cs="Traditional Arabic"/>' +
          '<w:sz w:val="' + (specs[i][1] * 2) + '"/><w:szCs w:val="' + (specs[i][1] * 2) + '"/>' +
          (specs[i][2] ? '<w:b/><w:bCs/>' : '<w:i w:val="0"/><w:iCs w:val="0"/>') +
          '<w:noProof/><w:rtl/></w:rPr></w:style>');
      }
      var pr = wOne(st, 'pPr');
      if (!pr) { pr = W_(dx.styles, 'pPr'); st.appendChild(pr); }
      var tabs = wOne(pr, 'tabs');
      if (!tabs) { tabs = W_(dx.styles, 'tabs'); pr.appendChild(tabs); }
      while (tabs.firstChild) tabs.removeChild(tabs.firstChild);
      var tab = W_(dx.styles, 'tab');
      wSet(tab, 'val', 'right'); wSet(tab, 'leader', 'dot'); wSet(tab, 'pos', String(TOC_TAB_TWIPS));
      tabs.appendChild(tab);
    }
  }
  function findTocTitle(paras) {
    for (var i = 0; i < paras.length; i++) {
      var raw = paraText(paras[i]).trim();
      if (raw && isExactTitle(raw, TOC_TITLE_VARIANTS)) return paras[i];
    }
    return null;
  }
  function removeExistingToc(doc) {
    var paras = bodyParagraphs(doc);
    var inToc = false, removed = 0;
    for (var i = 0; i < paras.length; i++) {
      var p = paras[i];
      var txt = paraText(p);
      var instr = p.getElementsByTagNameNS(W, 'instrText');
      var isField = false;
      for (var j = 0; j < instr.length; j++) if (/\bTOC\b/.test(instr[j].textContent || '')) isField = true;
      if (isField) { inToc = true; removeParagraph(p); removed++; continue; }
      if (inToc && isTocParagraph(p)) { removeParagraph(p); removed++; continue; }
      if (inToc && !txt.trim()) { inToc = false; continue; }
      inToc = false;
    }
    return removed;
  }
  function insertToc(dx, headingCount) {
    var doc = dx.doc;
    var paras = bodyParagraphs(doc);
    var titleP = findTocTitle(paras);
    if (!titleP) return { ok: false, entries: 0 };
    setOutlineLevel(titleP, 10);
    removeExistingToc(doc);
    paras = bodyParagraphs(doc);
    titleP = findTocTitle(paras);
    if (!titleP) return { ok: false, entries: 0 };
    ensureTocStyles(dx);
    var next = nextParagraph(titleP);
    var target;
    if (next && !paraText(next).trim() && !next.getElementsByTagNameNS(W, 'drawing').length) {
      target = next;
      while (target.firstChild) target.removeChild(target.firstChild);
    } else {
      target = W_(doc, 'p');
      titleP.parentNode.insertBefore(target, titleP.nextSibling);
    }
    var pPrEl = W_(doc, 'pPr');
    var pSt = W_(doc, 'pStyle');
    wSet(pSt, 'val', 'TOC1');
    pPrEl.appendChild(pSt);
    target.appendChild(pPrEl);
    function fldRun(type) {
      var r = W_(doc, 'r');
      var fc = W_(doc, 'fldChar');
      wSet(fc, 'fldCharType', type);
      if (type === 'begin') wSet(fc, 'dirty', 'true');
      r.appendChild(fc);
      return r;
    }
    target.appendChild(fldRun('begin'));
    var rInstr = W_(doc, 'r');
    var instr = W_(doc, 'instrText');
    instr.setAttribute('xml:space', 'preserve');
    instr.textContent = ' TOC \\o "1-4" \\h \\z \\u ';
    rInstr.appendChild(instr);
    target.appendChild(rInstr);
    target.appendChild(fldRun('separate'));
    var rPh = W_(doc, 'r');
    var tPh = W_(doc, 't');
    tPh.textContent = 'برای نمایش فهرست، در Word فیلدها را به‌روزرسانی کنید (F9).';
    rPh.appendChild(tPh);
    target.appendChild(rPh);
    target.appendChild(fldRun('end'));
    var uf = ensureSettingsFlag(dx, 'updateFields');
    wSet(uf, 'val', 'true');
    return { ok: true, entries: headingCount };
  }

  /* ══════════════════════════════════════════════════════════
     ۹) ویرایش نگارشی
     ══════════════════════════════════════════════════════════ */
  function isArabicParagraph(text) {
    if (!text || !text.trim()) return false;
    if (/[پچژگ]/.test(text)) return false;
    return /[\u0600-\u06FF]/.test(text);
  }
  function fixWawYaText(text) {
    var out = text.replace(/\s+و\s+/g, ' و');
    out = out.split('ی').join('ي');
    return out;
  }
  function skipRanges(paras) {
    var ranges = [];
    for (var i = 0; i < paras.length; i++) {
      var ht = detectHeading(paras[i]);
      if (ht !== 'Chekide' && ht !== 'Abstract') continue;
      ranges.push([i, Math.min(i + 3, paras.length - 1)]);
    }
    return ranges;
  }
  function inRange(i, ranges) {
    for (var k = 0; k < ranges.length; k++) if (i >= ranges[k][0] && i <= ranges[k][1]) return true;
    return false;
  }
  function polishDocument(dx) {
    var paras = bodyParagraphs(dx.doc);
    var ranges = skipRanges(paras);
    var changed = 0;
    for (var i = 0; i < paras.length; i++) {
      if (inRange(i, ranges)) continue;
      var p = paras[i];
      if (isTocParagraph(p)) continue;
      var full = paraText(p);
      if (!isArabicParagraph(full)) continue;
      var nodes = paraTextChars(p);
      var modified = false;
      for (var n = 0; n < nodes.length; n++) {
        var oldText = nodes[n].text;
        if (!oldText) continue;
        var newText = fixWawYaText(oldText);
        if (newText !== oldText) {
          nodes[n].node.textContent = newText;
          modified = true;
        }
      }
      if (modified) changed++;
    }
    return changed;
  }

  /* ══════════════════════════════════════════════════════════
     ۱۰) انتقال متن انگلیسی به پاورقی
     ══════════════════════════════════════════════════════════ */
  function isLatinLetter(ch) {
    var c = ch.charCodeAt(0);
    return (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 192 && c <= 255) || (c >= 256 && c <= 383);
  }
  function isAllowedInsideLatin(ch) { return '0123456789-–—\u2019\u2018'.indexOf(ch) !== -1; }
  function isBridgeChar(ch) {
    var c = ch.charCodeAt(0);
    return c === 32 || c === 160 || c === 46 || c === 44 || c === 38 || c === 47 || c === 58 ||
      c === 8206 || c === 8207 || c === 1563;
  }
  function isAsciiDigit(ch) { return ch >= '0' && ch <= '9'; }
  function containsLatin(text) {
    for (var i = 0; i < text.length; i++) if (isLatinLetter(text.charAt(i))) return true;
    return false;
  }
  function findLatinSequenceStart(text, minPos, pos) {
    var p = pos;
    while (p >= minPos) {
      var ch = text.charAt(p);
      if (isLatinLetter(ch) || isAllowedInsideLatin(ch)) { p--; continue; }
      if (isBridgeChar(ch)) {
        var q = p;
        while (q >= minPos && isBridgeChar(text.charAt(q))) q--;
        if (q < minPos) return p + 1;
        var before = text.charAt(q);
        if (isLatinLetter(before) || isAsciiDigit(before)) { p = q; continue; }
        return p + 1;
      }
      return p + 1;
    }
    return Math.max(0, p + 1);
  }
  function findMatchingOpening(text, closePos) {
    var depth = 0;
    for (var i = closePos; i >= 0; i--) {
      var ch = text.charAt(i);
      if (ch === ')') depth++;
      else if (ch === '(') {
        depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  }
  function removeOuterParentheses(txt) {
    var t = String(txt).trim();
    if (t.length >= 2 && t.charAt(0) === '(' && t.charAt(t.length - 1) === ')') t = t.slice(1, -1);
    return t.trim();
  }
  function cleanFootnoteText(txt) {
    var t = String(txt).replace(/\r/g, '').replace(/\x07/g, '');
    t = t.replace(/\x0b/g, ' ').replace(/\u00a0/g, ' ');
    t = t.replace(/[\u200e\u200f]/g, '');
    while (t.indexOf('  ') !== -1) t = t.split('  ').join(' ');
    return t.trim();
  }
  function planParenthesisFootnotes(text) {
    var ops = [];
    for (var i = text.length - 2; i >= 0; i--) {
      if (text.charAt(i) !== ')') continue;
      var open = findMatchingOpening(text, i);
      if (open < 0) continue;
      var inner = text.slice(open, i + 1);
      if (containsLatin(inner)) {
        var note = cleanFootnoteText(removeOuterParentheses(inner));
        if (note.trim()) ops.push({ start: open, end: i + 1, note: note });
      }
      i = open - 1;
    }
    return ops;
  }
  function planLatinFootnotes(text) {
    var depthBefore = new Array(text.length + 1);
    var depth = 0;
    for (var i = 0; i <= text.length; i++) {
      depthBefore[i] = depth;
      var ch = text.charAt(i);
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
    }
    var ops = [];
    for (var j = text.length - 2; j >= 0; j--) {
      if (!isLatinLetter(text.charAt(j))) continue;
      var latinEnd = j + 1;
      var latinStart = findLatinSequenceStart(text, 0, j);
      if (depthBefore[latinStart] <= 0) {
        var note = cleanFootnoteText(text.slice(latinStart, latinEnd));
        if (note.trim()) ops.push({ start: latinStart, end: latinEnd, note: note });
      }
      j = latinStart - 1;
    }
    return ops;
  }
  function isLatinFirst(text) {
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (isLatinLetter(ch)) return true;
      if (/[\u0600-\u06FF]/.test(ch)) return false;
    }
    return false;
  }
  function ensureFootnotesPart(dx) {
    if (dx.footnotes) return;
    var xml = XML_DECL + '<w:footnotes xmlns:w="' + W + '" xmlns:r="' + R + '">' +
      '<w:footnote w:type="separator" w:id="-1"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>' +
      '<w:r><w:separator/></w:r></w:p></w:footnote>' +
      '<w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>' +
      '<w:r><w:continuationSeparator/></w:r></w:p></w:footnote></w:footnotes>';
    dx.footnotes = parseXml(xml);
    dx.files['word/footnotes.xml'] = xml;
    dx.ensureContentType('/word/footnotes.xml', FNT_CT);
    dx.ensureRel(FNT_REL, 'footnotes.xml');
  }
  function ensureFootnoteStyles(dx) {
    if (!styleExists(dx, 'FootnoteReference')) {
      appendStyle(dx, '<w:style w:type="character" w:styleId="FootnoteReference">' +
        '<w:name w:val="footnote reference"/><w:uiPriority w:val="99"/><w:unhideWhenUsed/>' +
        '<w:rPr><w:vertAlign w:val="superscript"/></w:rPr></w:style>');
    }
    if (!styleExists(dx, 'FootnoteText')) {
      appendStyle(dx, '<w:style w:type="paragraph" w:styleId="FootnoteText">' +
        '<w:name w:val="footnote text"/><w:basedOn w:val="Normal"/>' +
        '<w:uiPriority w:val="99"/><w:unhideWhenUsed/>' +
        '<w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>' +
        '<w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style>');
    }
  }
  function nextFootnoteId(dx) {
    var fns = wAll(dx.footnotes, 'footnote');
    var max = 0;
    for (var i = 0; i < fns.length; i++) {
      var id = parseInt(fns[i].getAttributeNS(W, 'id'), 10);
      if (!isNaN(id) && id > max) max = id;
    }
    return max + 1;
  }
  function addFootnote(dx, note) {
    ensureFootnotesPart(dx);
    var id = nextFootnoteId(dx);
    var latin = isLatinFirst(note);
    var align = latin ? 'left' : 'right';
    var xml = '<w:footnote w:id="' + id + '"><w:p><w:pPr><w:pStyle w:val="FootnoteText"/>' +
      (latin ? '' : '<w:bidi/>') +
      '<w:jc w:val="' + align + '"/></w:pPr>' +
      '<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteRef/></w:r>' +
      '<w:r><w:t xml:space="preserve">. ' + escText(note) + '</w:t></w:r></w:p></w:footnote>';
    var frag = parseXml(XML_DECL + '<w:footnotes xmlns:w="' + W + '" xmlns:r="' + R + '">' + xml + '</w:footnotes>');
    var fn = wOne(frag, 'footnote');
    dx.footnotes.documentElement.appendChild(dx.footnotes.importNode(fn, true));
    return id;
  }
  function nodeOffsets(p) {
    var nodes = paraTextChars(p);
    var pos = 0, out = [];
    for (var i = 0; i < nodes.length; i++) {
      var len = nodes[i].text.length;
      out.push({ node: nodes[i].node, start: pos, end: pos + len, text: nodes[i].text });
      pos += len;
    }
    return out;
  }
  function deleteTextRange(p, start, end) {
    var list = nodeOffsets(p);
    for (var i = list.length - 1; i >= 0; i--) {
      var it = list[i];
      if (it.end <= start || it.start >= end) continue;
      var localStart = Math.max(0, start - it.start);
      var localEnd = Math.min(it.text.length, end - it.start);
      var newText = it.text.slice(0, localStart) + it.text.slice(localEnd);
      it.node.textContent = newText;
      if (!newText && it.node.parentNode) {
        var run = it.node.parentNode;
        if (!run.getElementsByTagNameNS(W, 't').length && run.parentNode) run.parentNode.removeChild(run);
      }
    }
  }
  function insertFootnoteRefAt(p, offset, id) {
    var doc = p.ownerDocument;
    var refRun = W_(doc, 'r');
    var rp = W_(doc, 'rPr');
    var rs = W_(doc, 'rStyle');
    wSet(rs, 'val', 'FootnoteReference');
    rp.appendChild(rs);
    refRun.appendChild(rp);
    var ref = W_(doc, 'footnoteReference');
    wSet(ref, 'id', String(id));
    refRun.appendChild(ref);
    var list = nodeOffsets(p);
    var host = null;
    for (var i = 0; i < list.length; i++) {
      if (offset >= list[i].start && offset <= list[i].end) { host = list[i]; break; }
    }
    if (!host) { p.appendChild(refRun); return; }
    var run = host.node.parentNode;
    if (offset === host.start) {
      run.parentNode.insertBefore(refRun, run);
      return;
    }
    if (offset === host.end) {
      run.parentNode.insertBefore(refRun, run.nextSibling);
      return;
    }
    var local = offset - host.start;
    var tailText = host.text.slice(local);
    host.node.textContent = host.text.slice(0, local);
    var tailRun = run.cloneNode(true);
    var tailTN = tailRun.getElementsByTagNameNS(W, 't');
    if (tailTN.length) {
      tailTN[0].textContent = tailText;
      for (var t = tailTN.length - 1; t >= 1; t--) tailTN[t].parentNode.removeChild(tailTN[t]);
    }
    run.parentNode.insertBefore(refRun, run.nextSibling);
    run.parentNode.insertBefore(tailRun, refRun.nextSibling);
  }
  function moveEnglishToFootnotes(dx) {
    var paras = bodyParagraphs(dx.doc);
    var moqIdx = -1, masIdx = -1;
    for (var i = 0; i < paras.length; i++) {
      var t = detectHeading(paras[i]);
      if (t === 'Al-Moqaddame' && moqIdx === -1) moqIdx = i;
      if (t === 'Masader va Maraje' && moqIdx !== -1) { masIdx = i; break; }
    }
    if (moqIdx === -1 || masIdx === -1) return { moved: 0, ok: false };
    ensureFootnotesPart(dx);
    ensureFootnoteStyles(dx);
    allSectPr(dx.doc).forEach(function (s) {
      var fp = sectSet(s, 'footnotePr');
      var nr = wOne(fp, 'numRestart');
      if (!nr) { nr = W_(dx.doc, 'numRestart'); fp.appendChild(nr); }
      wSet(nr, 'val', 'eachPage');
    });
    var moved = 0;
    for (var pi = masIdx - 1; pi >= moqIdx; pi--) {
      var p = paras[pi];
      var text = paraText(p);
      if (!text || !containsLatin(text)) continue;
      var ops = planParenthesisFootnotes(text).concat(planLatinFootnotes(text));
      ops.sort(function (a, b) { return b.start - a.start; });
      for (var k = 0; k < ops.length; k++) {
        var op = ops[k];
        try {
          var id = addFootnote(dx, op.note);
          insertFootnoteRefAt(p, op.start, id);
          deleteTextRange(p, op.start, op.end);
          moved++;
        } catch (e) { /* یک مورد خراب کل کار را متوقف نکند */ }
      }
    }
    return { moved: moved, ok: true };
  }

  /* ══════════════════════════════════════════════════════════
     خروجی/ورودی پاورقی و منابع برای مراحل هوش مصنوعی
     ══════════════════════════════════════════════════════════ */
  function footnoteTextOf(node) {
    var out = '';
    var ts = node.getElementsByTagNameNS(W, 't');
    for (var i = 0; i < ts.length; i++) {
      if (!isVisibleTextNode(ts[i], node)) continue;
      out += ts[i].textContent;
    }
    return out.replace(/\r/g, '\n').trim();
  }
  function exportFootnotes(dx) {
    if (!dx.footnotes) return [];
    var list = [];
    wAll(dx.footnotes, 'footnote').forEach(function (fn) {
      var id = parseInt(wAttr(fn, 'id'), 10);
      if (!(id > 0)) return;
      list.push({ id: id, page: null, footnote_text: footnoteTextOf(fn) });
    });
    list.sort(function (a, b) { return a.id - b.id; });
    return list;
  }
  function firstStrongIsLatin(text) {
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (/[A-Za-z\u00C0-\u024F]/.test(ch)) return true;
      if (/[\u0600-\u06FF]/.test(ch)) return false;
    }
    return false;
  }
  function setFootnoteText(dx, id, text) {
    var fn = null;
    wAll(dx.footnotes, 'footnote').forEach(function (n) {
      if (parseInt(wAttr(n, 'id'), 10) === id) fn = n;
    });
    if (!fn) return false;
    var latin = firstStrongIsLatin(text);
    var doc = dx.footnotes;
    // فقط یک پاراگراف نگه می‌داریم و آن را از نو می‌سازیم
    var paras = wAll(fn, 'p');
    paras.forEach(function (p, idx) { if (idx > 0 && p.parentNode) p.parentNode.removeChild(p); });
    while (fn.firstChild) fn.removeChild(fn.firstChild);
    var p = W_(doc, 'p');
    var pr = W_(doc, 'pPr');
    var ps = W_(doc, 'pStyle');
    wSet(ps, 'val', 'FootnoteText');
    pr.appendChild(ps);
    if (!latin) { pr.appendChild(W_(doc, 'bidi')); }
    var jc = W_(doc, 'jc');
    wSet(jc, 'val', latin ? 'left' : 'right');
    pr.appendChild(jc);
    p.appendChild(pr);
    var refRun = W_(doc, 'r');
    var refRPr = W_(doc, 'rPr');
    var rStyle = W_(doc, 'rStyle');
    wSet(rStyle, 'val', 'FootnoteReference');
    refRPr.appendChild(rStyle);
    refRun.appendChild(refRPr);
    refRun.appendChild(W_(doc, 'footnoteRef'));
    p.appendChild(refRun);
    var txtRun = W_(doc, 'r');
    var rp = W_(doc, 'rPr');
    var sz = W_(doc, 'sz'); wSet(sz, 'val', '20'); rp.appendChild(sz);
    var szCs = W_(doc, 'szCs'); wSet(szCs, 'val', '20'); rp.appendChild(szCs);
    txtRun.appendChild(rp);
    var t = W_(doc, 't');
    t.setAttribute('xml:space', 'preserve');
    t.textContent = text;
    txtRun.appendChild(t);
    p.appendChild(txtRun);
    fn.appendChild(p);
    return true;
  }
  function importFootnotes(dx, finalList) {
    var n = 0;
    finalList.forEach(function (item) {
      if (item.id == null || !item.footnote_text) return;
      if (setFootnoteText(dx, item.id, item.footnote_text)) n++;
    });
    return n;
  }

  function headingParagraphIndex(paras, type, from) {
    for (var i = (from || 0); i < paras.length; i++) {
      if (detectHeading(paras[i]) === type) return i;
    }
    return -1;
  }
  function exportReferences(dx) {
    var paras = bodyParagraphs(dx.doc);
    var refI = headingParagraphIndex(paras, 'Masader va Maraje', 0);
    if (refI === -1) return { ok: false, text: '' };
    var absI = headingParagraphIndex(paras, 'Abstract', refI + 1);
    var end = absI === -1 ? paras.length : absI;
    var lines = [];
    for (var i = refI + 1; i < end; i++) {
      var t = paraText(paras[i]).trim();
      if (t) lines.push(t);
    }
    return { ok: true, text: lines.join('\n'), lines: lines.length };
  }
  function makeReferenceParagraph(doc, line) {
    var p = W_(doc, 'p');
    var pr = W_(doc, 'pPr');
    pr.appendChild(W_(doc, 'bidi'));
    var jc = W_(doc, 'jc');
    wSet(jc, 'val', 'right');
    pr.appendChild(jc);
    p.appendChild(pr);
    var re = /\*\*(.+?)\*\*/g;
    var last = 0, m;
    var segs = [];
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) segs.push({ text: line.slice(last, m.index), bold: false });
      segs.push({ text: m[1], bold: true });
      last = re.lastIndex;
    }
    if (last < line.length) segs.push({ text: line.slice(last), bold: false });
    if (!segs.length) segs.push({ text: line, bold: false });
    segs.forEach(function (seg) {
      if (!seg.text) return;
      var r = W_(doc, 'r');
      var rp = W_(doc, 'rPr');
      var f = W_(doc, 'rFonts');
      wSet(f, 'ascii', 'Traditional Arabic');
      wSet(f, 'hAnsi', 'Traditional Arabic');
      wSet(f, 'cs', 'Traditional Arabic');
      rp.appendChild(f);
      if (seg.bold) {
        rp.appendChild(W_(doc, 'b'));
        rp.appendChild(W_(doc, 'bCs'));
      }
      var sz = W_(doc, 'sz'); wSet(sz, 'val', '30'); rp.appendChild(sz);
      var szCs = W_(doc, 'szCs'); wSet(szCs, 'val', '30'); rp.appendChild(szCs);
      r.appendChild(rp);
      var t = W_(doc, 't');
      t.setAttribute('xml:space', 'preserve');
      t.textContent = seg.text;
      r.appendChild(t);
      p.appendChild(r);
    });
    return p;
  }
  function paragraphHasSectPr(p) {
    var pr = wOne(p, 'pPr');
    return !!(pr && wOne(pr, 'sectPr'));
  }
  function importReferences(dx, lines) {
    if (!lines || !lines.length) return 0;
    var doc = dx.doc;
    var paras = bodyParagraphs(doc);
    var refI = headingParagraphIndex(paras, 'Masader va Maraje', 0);
    if (refI === -1) return 0;
    var absI = headingParagraphIndex(paras, 'Abstract', refI + 1);
    if (absI === -1) return 0;
    // پاراگرافی که سکشن‌بریک منابع/چکیده را نگه می‌دارد حفظ می‌شود
    var spacer = null;
    for (var i = absI - 1; i > refI; i--) {
      if (paragraphHasSectPr(paras[i])) { spacer = paras[i]; break; }
    }
    var insertBefore = spacer || paras[absI];
    for (var j = refI + 1; j < absI; j++) {
      var p = paras[j];
      if (p === spacer) continue;
      if (p.parentNode) p.parentNode.removeChild(p);
    }
    // اگر پاراگراف حامل سکشن‌بریک نگه داشته شد، متن قبلی‌اش پاک شود تا
    // خط قدیمی منابع دوباره در خروجی نماند (فقط pPr و sectPr می‌ماند).
    if (spacer) {
      var keepPr = wOne(spacer, 'pPr');
      while (spacer.firstChild) spacer.removeChild(spacer.firstChild);
      if (keepPr) spacer.appendChild(keepPr);
    }
    lines.forEach(function (line) {
      insertBefore.parentNode.insertBefore(makeReferenceParagraph(doc, line), insertBefore);
    });
    return lines.length;
  }

  /* ══════════════════════════════════════════════════════════
     اجرای خط لوله
     ══════════════════════════════════════════════════════════ */
  var report = null;
  function reportWarn(msg) { if (report) report.warnings.push(msg); }

  async function run(files, opts, onProgress) {
    opts = opts || {};
    LANG = opts.language === 'fa' ? 'fa' : 'ar';
    quiet = !!opts.quiet;
    report = { ok: true, steps: [], warnings: [], headings: [], counts: {} };
    var progress = typeof onProgress === 'function' ? onProgress : function () {};
    function done(i, detail) { progress(i, 'done', detail || ''); }
    function running(i, detail) { progress(i, 'running', detail || ''); }
    function aiLog(i) { return function (msg) { progress(i, 'running', msg); }; }

    var dx;
    try {
      running(0, 'باز کردن فایل و خواندن XML…');
      dx = new Docx(files);
      report.sections = allSectPr(dx.doc).length;
      done(0, 'فایل باز شد (' + report.sections + ' سکشن اولیه)');
    } catch (e) {
      report.ok = false;
      report.warnings.push(e && e.message ? e.message : String(e));
      progress(0, 'error', report.warnings[0]);
      return report;
    }

    var ai = global.TanzidAI;
    var fnItems = [];
    var refExport = { ok: false, text: '' };
    var fnAiResult = null;
    var refAiResult = null;

    /* ── ۱) استخراج پاورقی‌ها ── */
    if (opts.footnotes !== false) {
      running(1, 'استخراج پاورقی‌های سند…');
      try {
        fnItems = exportFootnotes(dx);
        report.counts.footnotesFound = fnItems.length;
        if (!fnItems.length) {
          done(1, 'پاورقی‌ای پیدا نشد — مراحل AI پاورقی رد می‌شود.');
        } else {
          report.steps.push('استخراج پاورقی: ' + fnItems.length + ' پاورقی.');
          done(1, fnItems.length + ' پاورقی');
        }
      } catch (e) {
        report.warnings.push('استخراج پاورقی ناموفق: ' + (e && e.message ? e.message : e));
        progress(1, 'error', report.warnings[report.warnings.length - 1]);
      }
    } else {
      progress(1, 'skip', 'غیرفعال');
    }

    /* ── ۲) استخراج منابع ── */
    if (opts.references !== false) {
      running(2, 'استخراج بخش المصادر والمراجع…');
      try {
        refExport = exportReferences(dx);
        report.counts.referenceLines = (refExport.lines || 0);
        if (!refExport.ok) {
          done(2, 'عنوان «المصادر والمراجع» پیدا نشد — مرحله رد شد.');
        } else {
          report.steps.push('استخراج منابع: ' + (refExport.lines || 0) + ' خط.');
          done(2, (refExport.lines || 0) + ' خط');
        }
      } catch (e) {
        report.warnings.push('استخراج منابع ناموفق: ' + (e && e.message ? e.message : e));
        progress(2, 'error', report.warnings[report.warnings.length - 1]);
      }
    } else {
      progress(2, 'skip', 'غیرفعال');
    }

    /* ── ۳) صفحه‌آرایی اصلی ── */
    running(3, 'شروع صفحه‌آرایی اصلی…');
    try {
      applyPageSetup(dx);
      report.steps.push('قالب صفحه روی ' + allSectPr(dx.doc).length + ' سکشن اعمال شد (A4، حاشیهٔ ۳٫۵/۳/۳/۳).');

      if (opts.section !== false || opts.header !== false) {
        resetStructure(dx);
        report.steps.push('ساختار سکشن/هدر قبلی پاک‌سازی شد.');
      }

      var paras = indexParagraphs(dx.doc);
      var tocTitle = null;
      for (var i = 0; i < paras.length; i++) {
        var raw = paraText(paras[i]).trim();
        if (raw && isExactTitle(raw, TOC_TITLE_VARIANTS)) { tocTitle = paras[i]; break; }
      }
      if (tocTitle && !hasPageBreakBefore(tocTitle)) {
        setPageBreakBefore(tocTitle);
        report.steps.push('شکست صفحه قبل از تیتر فهرست مطالب تضمین شد.');
      }

      var scan = scanHeadings(paras);
      report.headings = scan.headings;
      report.counts.headings = scan.headings.length;
      report.steps.push('اسکن سند: ' + scan.all.length + ' عنوان شناسایی شد؛ ' +
        scan.targets.length + ' عنوان سطح‌ساز و ' + scan.tocOnly.length + ' عنوان فقط‌فهرست.');

      if (opts.section !== false) {
        var nb = insertSectionBreaks(dx, scan);
        report.counts.pageBreaks = nb;
        report.sections = allSectPr(dx.doc).length;
        report.steps.push('سکشن‌گذاری: ' + nb + ' شکست سکشن (Odd Page) — ' +
          report.sections + ' سکشن.');
      }

      if (opts.header !== false && opts.section !== false) {
        var thesisTitle = getThesisTitle(indexParagraphs(dx.doc)) || '';
        var hr = writeHeaders(dx, scan, thesisTitle);
        report.counts.headers = hr.headers;
        report.steps.push('هدرگذاری: ' + hr.headers + ' سرصفحه (عنوان فصل + شمارهٔ صفحه).');
      } else if (opts.header !== false && opts.section === false) {
        report.warnings.push('هدرگذاری بدون سکشن‌گذاری ممکن نیست — رد شد.');
      }

      if (opts.chapterBreak !== false) {
        var cb = insertChapterBreaks(dx, scan);
        report.counts.chapterBreaks = cb;
        report.sections = allSectPr(dx.doc).length;
        report.steps.push('سکشن‌بریک شروع متن ' + cb + ' فصل + ۵ پاراگراف خالی.');
      }

      if (opts.heading !== false) {
        var fh = formatHeadings(dx, scan);
        report.counts.styled = fh.assigned;
        report.steps.push('هدینگ‌گذاری: ' + fh.assigned + ' عنوان استایل/سطح گرفت، ' +
          fh.reset + ' پاراگراف به متن اصلی برگشت.');
      }

      if (opts.polish !== false) {
        var np = polishDocument(dx);
        report.counts.polished = np;
        if (np) report.steps.push('ویرایش نگارشی: ' + np + ' پاراگراف (و/ی عربی).');
      }

      applyPageSetup(dx);
      done(3, 'صفحه‌آرایی اصلی تمام شد.');
    } catch (e) {
      report.ok = false;
      report.warnings.push('خطا در صفحه‌آرایی: ' + (e && e.message ? e.message : e));
      progress(3, 'error', report.warnings[report.warnings.length - 1]);
      return report;
    }

    /* ── ۴) ویرایش پاورقی‌ها با هوش مصنوعی ── */
    if (opts.footnotes !== false) {
      if (!fnItems.length) {
        progress(4, 'skip', 'پاورقی‌ای برای ارسال نبود.');
      } else if (!ai || !ai.isConfigured()) {
        report.warnings.push('کلید/ماژول هوش مصنوعی در دسترس نیست — پاورقی‌ها ویرایش نشدند.');
        progress(4, 'error', 'ماژول AI بارگذاری نشده است.');
      } else {
        running(4, 'ارسال ' + fnItems.length + ' پاورقی به هوش مصنوعی…');
        try {
          fnAiResult = await ai.processFootnotes(fnItems, LANG, aiLog(4));
          report.counts.aiFootnotes = fnAiResult.final.length;
          if (fnAiResult.review && fnAiResult.review.length) {
            report.counts.aiReview = fnAiResult.review.length;
          }
          report.steps.push('ویرایش پاورقی با AI: ' + fnAiResult.final.length +
            ' پاورقی قالب‌بندی شد' +
            (fnAiResult.review && fnAiResult.review.length
              ? ' (' + fnAiResult.review.length + ' نیازمند بازبینی)' : '') + '.');
          done(4, fnAiResult.final.length + ' پاورقی ویرایش شد.');
        } catch (e) {
          report.warnings.push('ویرایش پاورقی با AI ناموفق: ' + (e && e.message ? e.message : e));
          progress(4, 'error', report.warnings[report.warnings.length - 1]);
        }
      }
    } else {
      progress(4, 'skip', 'غیرفعال');
    }

    /* ── ۵) ویرایش منابع با هوش مصنوعی ── */
    if (opts.references !== false) {
      if (!refExport.ok || !refExport.text) {
        progress(5, 'skip', 'منبعی برای ارسال نبود.');
      } else if (!ai || !ai.isConfigured()) {
        report.warnings.push('کلید/ماژول هوش مصنوعی در دسترس نیست — منابع ویرایش نشدند.');
        progress(5, 'error', 'ماژول AI بارگذاری نشده است.');
      } else {
        running(5, 'ارسال منابع به هوش مصنوعی…');
        try {
          refAiResult = await ai.processReferences(refExport.text, aiLog(5));
          report.counts.aiReferences = refAiResult.total;
          report.steps.push('ویرایش منابع با AI: ' + refAiResult.total +
            ' منبع در ' + Math.max(0, refAiResult.lines.length - 1) + ' خط دسته‌بندی شد.');
          done(5, refAiResult.total + ' منبع ویرایش شد.');
        } catch (e) {
          report.warnings.push('ویرایش منابع با AI ناموفق: ' + (e && e.message ? e.message : e));
          progress(5, 'error', report.warnings[report.warnings.length - 1]);
        }
      }
    } else {
      progress(5, 'skip', 'غیرفعال');
    }

    /* ── ۶) جایگذاری پاورقی‌های ویرایش‌شده ── */
    if (fnAiResult && fnAiResult.final && fnAiResult.final.length) {
      running(6, 'جایگذاری متن پاورقی‌ها…');
      try {
        var fnUpdated = importFootnotes(dx, fnAiResult.final);
        report.counts.footnotesImported = fnUpdated;
        report.steps.push('جایگذاری پاورقی: ' + fnUpdated + ' پاورقی به‌روز شد.');
        done(6, fnUpdated + ' پاورقی');
      } catch (e) {
        report.warnings.push('جایگذاری پاورقی ناموفق: ' + (e && e.message ? e.message : e));
        progress(6, 'error', report.warnings[report.warnings.length - 1]);
      }
    } else {
      progress(6, 'skip', 'پاورقی ویرایش‌شده‌ای نبود.');
    }

    /* ── ۷) جایگذاری منابع ویرایش‌شده ── */
    if (refAiResult && refAiResult.lines && refAiResult.lines.length) {
      running(7, 'جایگذاری فهرست منابع…');
      try {
        var refCount = importReferences(dx, refAiResult.lines);
        report.counts.referencesImported = refCount;
        report.steps.push('جایگذاری منابع: ' + refCount + ' خط نوشته شد.');
        done(7, refCount + ' خط');
      } catch (e) {
        report.warnings.push('جایگذاری منابع ناموفق: ' + (e && e.message ? e.message : e));
        progress(7, 'error', report.warnings[report.warnings.length - 1]);
      }
    } else {
      progress(7, 'skip', 'منبع ویرایش‌شده‌ای نبود.');
    }

    /* ── ۸) انتقال متن انگلیسی به پاورقی ── */
    if (opts.englishFootnotes !== false) {
      running(8, 'جست‌وجوی متن انگلیسی در مقدمه تا الخاتمه…');
      try {
        var en = moveEnglishToFootnotes(dx);
        report.counts.englishFootnotes = en.moved;
        if (!en.ok) {
          progress(8, 'done', 'مقدمه/منابع پیدا نشد — مرحله رد شد.');
        } else {
          report.steps.push('انتقال متن انگلیسی: ' + en.moved + ' پاورقی ساخته شد.');
          done(8, en.moved + ' پاورقی');
        }
      } catch (e) {
        report.warnings.push('انتقال متن انگلیسی ناموفق: ' + (e && e.message ? e.message : e));
        progress(8, 'error', report.warnings[report.warnings.length - 1]);
      }
    } else {
      progress(8, 'skip', 'غیرفعال');
    }

    /* ── ۹) فهرست مطالب ── */
    if (opts.toc !== false) {
      running(9, 'ساخت فهرست مطالب خودکار…');
      try {
        var toc = insertToc(dx, report.counts.headings || 0);
        if (toc.ok) {
          report.counts.tocEntries = toc.entries;
          report.steps.push('فهرست مطالب ساخته شد (فیلد خودکار؛ در Word به‌روزرسانی شود).');
          done(9, 'فهرست مطالب اضافه شد.');
        } else {
          report.warnings.push('تیتر «فهرس المحتويات» پیدا نشد — فهرست ساخته نشد.');
          progress(9, 'done', 'تیتر فهرست پیدا نشد — رد شد.');
        }
      } catch (e) {
        report.warnings.push('ساخت فهرست ناموفق: ' + (e && e.message ? e.message : e));
        progress(9, 'error', report.warnings[report.warnings.length - 1]);
      }
    } else {
      progress(9, 'skip', 'غیرفعال');
    }

    /* ── ۱۰) ذخیره ── */
    running(10, 'نوشتن خروجی…');
    try {
      applyPageSetup(dx);
      dx.save();
      report.steps.push('فایل خروجی آماده شد.');
      done(10);
    } catch (e) {
      report.ok = false;
      report.warnings.push('ذخیرهٔ خروجی ناموفق: ' + (e && e.message ? e.message : e));
      progress(10, 'error', report.warnings[report.warnings.length - 1]);
    }
    return report;
  }

  global.TanzidEngine = {
    run: run,
    _internal: {
      normalizeText: normalizeText,
      isRoosThamaniyaHeading: isRoosThamaniyaHeading,
      detectHeading: detectHeading,
      isExactTitle: isExactTitle,
      planParenthesisFootnotes: planParenthesisFootnotes,
      planLatinFootnotes: planLatinFootnotes,
      fixWawYaText: fixWawYaText,
      isArabicParagraph: isArabicParagraph
    }
  };
})(window);
