// ============================================================
// supabase/functions/tadilat-stt/index.ts
//
// تبدیل صدای اسم دانشجو به متن با Whisper.
//
// چرا این تابع؟
//   Web Speech API داخل وب‌ویو اندروید تلگرام به سرویس گفتار گوگل
//   دسترسی ندارد و عملاً کار نمی‌کند. پس تلگرام فایل صوتی را
//   base64 می‌فرستد، این‌جا به Whisper داده می‌شود و متن برمی‌گردد.
//
// چرا سرور و نه مستقیم از تلگرام؟
//   کلید API هرگز نباید داخل صفحهٔ عمومی باشد — هر کسی می‌تواند
//   آن را بردارد و از اعتبار شما استفاده کند. این‌جا کلید در
//   Secrets سوپابیس می‌ماند و به مرورگر نمی‌رسد.
//
// راه‌اندازی (یک‌بار):
//   ۱) Project Settings → Edge Functions → Secrets
//      GROQ_API_KEY = gsk_...        (رایگان: console.groq.com)
//      یا OPENAI_API_KEY = sk-...    (اگر Groq ندارید)
//   ۲) Deploy این تابع (از داشبورد یا CLI)
//
// ورودی : { audio: "<base64>", mime: "audio/webm", lang: "ar" }
// خروجی : { text: "محمد فاضل عباس", provider: "groq" }
// ============================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/** پسوند مناسب بر اساس نوع فایل صوتی */
function extFor(mime: string): string {
  const m = (mime || '').toLowerCase();
  if (m.includes('mp4') || m.includes('m4a') || m.includes('aac')) return 'mp4';
  if (m.includes('ogg') || m.includes('opus')) return 'ogg';
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
  if (m.includes('wav')) return 'wav';
  return 'webm';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.audio) return json({ error: 'audio لازم است' }, 400);

    // ── کلید سرویس: Groq ترجیح دارد (رایگان و سریع) ──
    const groqKey = Deno.env.get('GROQ_API_KEY');
    const openaiKey = Deno.env.get('OPENAI_API_KEY');

    let url: string;
    let key: string;
    let model: string;
    let provider: string;

    if (groqKey) {
      url = 'https://api.groq.com/openai/v1/audio/transcriptions';
      key = groqKey;
      model = Deno.env.get('GROQ_MODEL') || 'whisper-large-v3';
      provider = 'groq';
    } else if (openaiKey) {
      url = 'https://api.openai.com/v1/audio/transcriptions';
      key = openaiKey;
      model = 'whisper-1';
      provider = 'openai';
    } else {
      return json(
        { error: 'هیچ کلیدی تنظیم نشده. GROQ_API_KEY یا OPENAI_API_KEY را در Secrets بگذارید.' },
        500,
      );
    }

    // ── base64 → bytes ──
    let bytes: Uint8Array;
    try {
      const bin = atob(body.audio);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } catch (_e) {
      return json({ error: 'audio معتبر نیست (base64)' }, 400);
    }

    const mime = String(body.mime || 'audio/webm');
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: mime }), 'name.' + extFor(mime));
    form.append('model', model);
    form.append('language', String(body.lang || 'ar'));   // عربی
    form.append('response_format', 'json');
    form.append('temperature', '0');                      // کمترین خلاقیت = دقیق‌ترین

    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key },
      body: form,
    });

    const raw = await res.text();
    if (!res.ok) {
      console.error('STT provider error', res.status, raw.slice(0, 400));
      let detail = raw.slice(0, 300);
      try {
        const p = JSON.parse(raw);
        detail = p?.error?.message || detail;
      } catch (_e) { /* متن خام */ }
      return json({ error: detail || 'سرویس تشخیص گفتار خطا داد' }, 502);
    }

    let text = '';
    try {
      text = JSON.parse(raw)?.text || '';
    } catch (_e) {
      text = raw;
    }

    return json({ text: String(text).trim(), provider });
  } catch (e) {
    console.error('tadilat-stt fatal', e);
    return json({ error: String(e) }, 500);
  }
});
