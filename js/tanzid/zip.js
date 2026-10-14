/* ══════════════════════════════════════════════════════════════
   js/tanzid/zip.js — خواندن و نوشتن فایل ZIP (docx) بدون کتابخانه

   چرا خودمان؟ چون .docx یک فایل ZIP است و نمیخواهیم سایت به CDN
   وابسته باشد. مرورگرهای امروزی DecompressionStream/CompressionStream
   دارند و همین کافی است.
   ══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  // ── CRC32 (برای صحت فایل ZIP لازم است) ──
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256), c, n, k;
    for (n = 0; n < 256; n++) {
      c = n;
      for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(buf) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < buf.length; i++) {
      c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  var enc = new TextEncoder();
  var dec = new TextDecoder('utf-8');

  function u8(str) { return enc.encode(str); }

  /* ── رمزگشایی/رمزگذاری deflate با API خود مرورگر ── */
  function inflateRaw(bytes) {
    if (typeof DecompressionStream === 'undefined') {
      return Promise.reject(new Error('مرورگر شما DecompressionStream ندارد'));
    }
    var ds = new DecompressionStream('deflate-raw');
    var stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Response(stream).arrayBuffer().then(function (ab) {
      return new Uint8Array(ab);
    });
  }

  function deflateRaw(bytes) {
    if (typeof CompressionStream === 'undefined') {
      return Promise.resolve(null);   // بدون فشرده‌سازی ذخیره می‌شود
    }
    var cs = new CompressionStream('deflate-raw');
    var stream = new Blob([bytes]).stream().pipeThrough(cs);
    return new Response(stream).arrayBuffer().then(function (ab) {
      return new Uint8Array(ab);
    }).catch(function () { return null; });
  }

  /* ══════════════════════════════════════════════════════════
     خواندن ZIP
     خروجی: { 'word/document.xml': Uint8Array, ... }
     ══════════════════════════════════════════════════════════ */
  function readZip(buffer) {
    var view = new DataView(buffer);
    var bytes = new Uint8Array(buffer);

    // پیدا کردن End of Central Directory از انتها
    var eocd = -1;
    for (var i = bytes.length - 22; i >= 0 && i > bytes.length - 66000; i--) {
      if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) return Promise.reject(new Error('فایل ZIP معتبر نیست (docx باشد؟)'));

    var count = view.getUint16(eocd + 10, true);
    var cdOffset = view.getUint32(eocd + 16, true);

    var entries = [];
    var p = cdOffset;
    for (var n = 0; n < count; n++) {
      if (view.getUint32(p, true) !== 0x02014b50) break;
      var method = view.getUint16(p + 10, true);
      var compSize = view.getUint32(p + 20, true);
      var nameLen = view.getUint16(p + 28, true);
      var extraLen = view.getUint16(p + 30, true);
      var commentLen = view.getUint16(p + 32, true);
      var localOffset = view.getUint32(p + 42, true);
      var name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
      entries.push({ name: name, method: method, compSize: compSize, offset: localOffset });
      p += 46 + nameLen + extraLen + commentLen;
    }

    // استخراج دادهٔ هر فایل
    var tasks = entries.map(function (e) {
      var lp = e.offset;
      if (view.getUint32(lp, true) !== 0x04034b50) return Promise.resolve(null);
      var lnameLen = view.getUint16(lp + 26, true);
      var lextraLen = view.getUint16(lp + 28, true);
      var dataStart = lp + 30 + lnameLen + lextraLen;
      var raw = bytes.subarray(dataStart, dataStart + e.compSize);
      if (e.method === 0) return Promise.resolve(raw.slice());
      if (e.method === 8) return inflateRaw(raw);
      return Promise.resolve(null);   // روش‌های دیگر پشتیبانی نمی‌شوند
    });

    return Promise.all(tasks).then(function (list) {
      var files = {};
      entries.forEach(function (e, i) {
        if (list[i]) files[e.name] = list[i];
      });
      return files;
    });
  }

  /* ══════════════════════════════════════════════════════════
     نوشتن ZIP
     ورودی: { 'word/document.xml': Uint8Array|string, ... }
     ══════════════════════════════════════════════════════════ */
  function writeZip(files) {
    var names = Object.keys(files);
    return Promise.all(names.map(function (k) {
      var v = files[k];
      var data = (typeof v === 'string') ? u8(v) : v;
      return deflateRaw(data).then(function (comp) {
        return { name: k, data: data, comp: comp, crc: crc32(data) };
      });
    })).then(function (items) {
      var parts = [], central = [], offset = 0;

      items.forEach(function (it) {
        var nameBytes = u8(it.name);
        var comp = it.comp;
        var method = comp ? 8 : 0;
        var payload = comp || it.data;

        var head = new Uint8Array(30 + nameBytes.length);
        var hv = new DataView(head.buffer);
        hv.setUint32(0, 0x04034b50, true);
        hv.setUint16(4, 20, true);            // version needed
        hv.setUint16(6, 0x0800, true);        // UTF-8 flag
        hv.setUint16(8, method, true);
        hv.setUint16(10, 0, true);            // time
        hv.setUint16(12, 0x21, true);         // date (1980-01-01)
        hv.setUint32(14, it.crc, true);
        hv.setUint32(18, payload.length, true);
        hv.setUint32(22, it.data.length, true);
        hv.setUint16(26, nameBytes.length, true);
        hv.setUint16(28, 0, true);
        head.set(nameBytes, 30);

        parts.push(head, payload);

        var ch = new Uint8Array(46 + nameBytes.length);
        var cv = new DataView(ch.buffer);
        cv.setUint32(0, 0x02014b50, true);
        cv.setUint16(4, 20, true);
        cv.setUint16(6, 20, true);
        cv.setUint16(8, 0x0800, true);
        cv.setUint16(10, method, true);
        cv.setUint16(12, 0, true);
        cv.setUint16(14, 0x21, true);
        cv.setUint32(16, it.crc, true);
        cv.setUint32(20, payload.length, true);
        cv.setUint32(24, it.data.length, true);
        cv.setUint16(28, nameBytes.length, true);
        cv.setUint32(42, offset, true);
        ch.set(nameBytes, 46);
        central.push(ch);

        offset += head.length + payload.length;
      });

      var cdSize = central.reduce(function (a, b) { return a + b.length; }, 0);
      var end = new Uint8Array(22);
      var ev = new DataView(end.buffer);
      ev.setUint32(0, 0x06054b50, true);
      ev.setUint16(8, items.length, true);
      ev.setUint16(10, items.length, true);
      ev.setUint32(12, cdSize, true);
      ev.setUint32(16, offset, true);

      var all = parts.concat(central, [end]);
      var total = all.reduce(function (a, b) { return a + b.length; }, 0);
      var out = new Uint8Array(total), pos = 0;
      all.forEach(function (b) { out.set(b, pos); pos += b.length; });
      return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    });
  }

  global.TanzidZip = {
    read: function (file) {
      return file.arrayBuffer().then(readZip);
    },
    write: writeZip,
    inflateRaw: inflateRaw
  };
})(window);
