// ══════════════════════════════════════════════════════════════
// supabase/functions/telegram-bot/index.ts
//
// ربات چتی «تعدیلات» روی Supabase Edge Function — بدون سرور،
// بدون کامپیوتر روشن، بدون پروکسی (سرورهای Supabase فیلتر نیستند).
//
// جریان:
//   /start → اسمت را بنویس
//     ↓ نام
//   آیا تو X هستی؟  [✅ بله] [❌ نه]
//     ↓ (اگر پیدا نشد) شمارهٔ دانشجویی → [⏭ رد کردن]
//     ↓ تأیید
//   هر فایلی بفرست (از فایل‌ها یا واتساپ)
//     ↓
//   ✅ تعدیلات شما ارسال شد
//     ↓ دکمه‌ها
//   📋 وضعیت من | ⏰ تاریخ تحویل | 📁 فایل‌های من | 🆕 تعدیلات جدید
//
// متغیرهای محیطی لازم (Edge Functions → Secrets):
//   TELEGRAM_BOT_TOKEN       توکن ربات
//   TELEGRAM_WEBHOOK_SECRET  یک رشتهٔ تصادفی برای امنیت Webhook
//   STORAGE_BUCKET           پیش‌فرض: student-documents
//   SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY خودکار هستند
// ══════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// ── تنظیمات ──────────────────────────────────────────────────
const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const SB_URL = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BUCKET = Deno.env.get("STORAGE_BUCKET") ?? "student-documents";
const SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
const MAX_FILE_MB = Number(Deno.env.get("MAX_FILE_MB") ?? "20");
const PREFIX = Deno.env.get("STORAGE_PREFIX") ?? "tadilat";

const TG_API = `https://api.telegram.org/bot${TG_TOKEN}`;
const TG_FILE = `https://api.telegram.org/file/bot${TG_TOKEN}`;

const log = (...a: unknown[]) => console.log("[bot]", ...a);

// ══════════════════════════════════════════════════════════════
// ابزارهای متنی — عیناً پورت‌شده از مینی‌اپ (تست‌شده روی ۳۵۱ دانشجو)
// ══════════════════════════════════════════════════════════════
function normName(v: unknown): string {
  if (!v) return "";
  let t = String(v).trim()
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
    .replace(/[\u200b-\u200f\u202a-\u202e]/g, " ");
  const map: Record<string, string> = {
    "ي": "ی", "ك": "ک", "ۀ": "ه", "ة": "ه", "أ": "ا", "إ": "ا",
    "آ": "ا", "ٱ": "ا", "ؤ": "و", "ئ": "ی",
  };
  t = t.replace(/[يكۀةأإآٱؤئ]/g, (c) => map[c] ?? c);
  return t.replace(/\s+/g, " ").trim();
}
const normKey = (v: unknown) => normName(v).replace(/\s/g, "");

function toEnDigits(v: unknown): string {
  return String(v ?? "")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

function lcs(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m || !n) return 0;
  let prev = new Array(n + 1).fill(0), cur = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      cur[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1] + 1
        : Math.max(prev[j], cur[j - 1]);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

const MATCH_FIRST_N = 3;
const MATCH_ACCEPT = 0.80;
const MATCH_MARGIN = 0.06;

const nameTokens = (v: unknown) =>
  normName(v).split(" ").filter((w) => !!w);

/** «ال» ابتدای فامیل نادیده گرفته می‌شود: المجبلي = مجبلي */
const stripAl = (w: string) =>
  (w.length > 4 && w.indexOf("ال") === 0) ? w.slice(2) : w;

function tokSim(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (stripAl(a) === stripAl(b)) return 0.94;
  if (a.replace(/\s/g, "") === b || b.replace(/\s/g, "") === a) return 0.93;
  if (a.indexOf(b) !== -1 || b.indexOf(a) !== -1) {
    return 0.80 * (Math.min(a.length, b.length) / Math.max(a.length, b.length)) + 0.14;
  }
  return 2 * lcs(a, b) / (a.length + b.length);
}

function nameScore(studentName: string, heard: string): number {
  const rt = nameTokens(studentName);
  const ht = nameTokens(heard);
  if (!rt.length || !ht.length) return 0;
  const basis = rt.slice(0, MATCH_FIRST_N);
  let total = 0, j = 0;
  for (let x = 0; x < ht.length; x++) {
    let best = 0, besti = -1;
    for (let i = j; i < basis.length; i++) {
      const s = tokSim(basis[i], ht[x]);
      if (s > best) { best = s; besti = i; }
    }
    if (besti >= 0) j = besti + 1;
    total += best;
  }
  const coverage = total / ht.length;
  const precision = total / basis.length;
  return coverage * 0.75 + precision * 0.25;
}

// ── شناسهٔ امن Storage (فقط ASCII) ───────────────────────────
const TR: Record<string, string> = {
  "آ": "a", "أ": "a", "إ": "a", "ا": "a", "ب": "b", "پ": "p", "ت": "t", "ث": "s",
  "ج": "j", "چ": "ch", "ح": "h", "خ": "kh", "د": "d", "ذ": "z", "ر": "r", "ز": "z",
  "ژ": "zh", "س": "s", "ش": "sh", "ص": "s", "ض": "z", "ط": "t", "ظ": "z", "ع": "a",
  "غ": "gh", "ف": "f", "ق": "q", "ك": "k", "ک": "k", "گ": "g", "ل": "l", "م": "m",
  "ن": "n", "و": "v", "ؤ": "v", "ه": "h", "ة": "h", "ي": "y", "ی": "y", "ئ": "y",
};
function safeKey(value: unknown, fallback = "file"): string {
  let out = "";
  for (const ch of String(value ?? "")) {
    out += TR[ch] ?? (/[A-Za-z0-9._-]/.test(ch) ? ch : "_");
  }
  return out.replace(/_{2,}/g, "_").slice(0, 80) || fallback;
}

// ══════════════════════════════════════════════════════════════
// تلگرام
// ══════════════════════════════════════════════════════════════
type Json = Record<string, unknown>;

async function tg(method: string, payload: Json = {}, retries = 2): Promise<any> {
  let lastErr = "";
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fetch(`${TG_API}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (j.ok) return j.result;
      lastErr = `HTTP ${r.status} ${JSON.stringify(j).slice(0, 200)}`;
      if (r.status === 401 || r.status === 400) break;
    } catch (e) {
      lastErr = String(e);
    }
    if (i < retries) await new Promise((res) => setTimeout(res, 800 * (i + 1)));
  }
  log("tg:", method, "ناموفق —", lastErr);
  return null;
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function send(chatId: number, text: string, keyboard?: Json) {
  const params: Json = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };
  if (keyboard) params.reply_markup = keyboard;
  const ok = await tg("sendMessage", params);
  if (!ok) {
    delete params.parse_mode;
    await tg("sendMessage", params);
  }
}

// ══════════════════════════════════════════════════════════════
// Supabase — REST + Storage
// ══════════════════════════════════════════════════════════════
const SB_HEADERS = {
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
  "Content-Type": "application/json",
};

async function sbSelect(table: string, query: string): Promise<any[]> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, {
      headers: SB_HEADERS,
    });
    if (!r.ok) {
      log("select", table, r.status, (await r.text()).slice(0, 160));
      return [];
    }
    return await r.json();
  } catch (e) {
    log("select error", table, String(e));
    return [];
  }
}

async function sbInsert(table: string, rows: Json[]): Promise<any[]> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { ...SB_HEADERS, Prefer: "return=representation" },
      body: JSON.stringify(rows),
    });
    if (!r.ok) {
      log("insert", table, r.status, (await r.text()).slice(0, 200));
      return [];
    }
    return await r.json();
  } catch (e) {
    log("insert error", table, String(e));
    return [];
  }
}

async function sbUpdate(table: string, query: string, patch: Json): Promise<boolean> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, {
      method: "PATCH",
      headers: SB_HEADERS,
      body: JSON.stringify(patch),
    });
    if (!r.ok) log("update", table, r.status, (await r.text()).slice(0, 160));
    return r.ok;
  } catch (e) {
    log("update error", table, String(e));
    return false;
  }
}

async function sbUpload(path: string, data: ArrayBuffer, mime: string): Promise<boolean> {
  try {
    const r = await fetch(
      `${SB_URL}/storage/v1/object/${BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SB_KEY}`,
          apikey: SB_KEY,
          "Content-Type": mime || "application/octet-stream",
          "x-upsert": "true",
        },
        body: data,
      },
    );
    if (!r.ok) log("upload", r.status, (await r.text()).slice(0, 200));
    return r.ok;
  } catch (e) {
    log("upload error", String(e));
    return false;
  }
}

// ── وضعیت گفتگو (در جدول bot_state) ──────────────────────────
async function getState(key: string): Promise<Json> {
  const rows = await sbSelect("bot_state", `select=value&key=eq.${encodeURIComponent(key)}&limit=1`);
  return (rows[0]?.value as Json) ?? {};
}

async function setState(key: string, value: Json): Promise<void> {
  const r = await fetch(`${SB_URL}/rest/v1/bot_state`, {
    method: "POST",
    headers: { ...SB_HEADERS, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ key, value, updated_at: new Date().toISOString() }]),
  });
  if (!r.ok) log("setState", r.status, (await r.text()).slice(0, 160));
}

// ══════════════════════════════════════════════════════════════
// کش فهرست دانشجوها (در حافظهٔ همان اجرا)
// ══════════════════════════════════════════════════════════════
let studentsCache: { id: string; name: string; student_id: string }[] | null = null;
let studentsAt = 0;

async function loadStudents() {
  if (studentsCache && Date.now() - studentsAt < 300_000) return studentsCache;
  const rows = await sbSelect(
    "profiles",
    "select=id,name,student_id&role=eq.student&limit=5000",
  );
  studentsCache = (rows ?? []).map((r) => ({
    id: r.id,
    name: r.name || "",
    student_id: String(r.student_id || "").trim(),
  }));
  studentsAt = Date.now();
  log("students loaded:", studentsCache.length);
  return studentsCache;
}

/** بهترین تطبیق → { student_id, name, student_no, reason } */
async function detect(rawText: string): Promise<Json> {
  const rows = await loadStudents();
  const text = String(rawText ?? "");
  const digits = toEnDigits(text);
  const m = digits.match(/\d{6,}/);
  const studentNo = m ? m[0] : null;

  // ۱) شمارهٔ دانشجویی — قطعی‌ترین
  if (studentNo) {
    const hit = rows.find((r) => r.student_id && r.student_id === studentNo);
    if (hit) {
      return { student_id: hit.id, name: hit.name, student_no: studentNo, reason: "ok" };
    }
  }
  // شناسه‌های غیرعددی مثل GRAD-N018
  const compact = digits.replace(/[\s\u200b-\u200f]+/g, "").toUpperCase();
  if (compact.length >= 5) {
    let best: { key: string; row: typeof rows[0] } | null = null;
    for (const r of rows) {
      const sid = String(r.student_id || "");
      if (sid.length < 5) continue;
      const key = sid.replace(/\s+/g, "").toUpperCase();
      if (compact.includes(key) && (!best || key.length > best.key.length)) {
        best = { key, row: r };
      }
    }
    if (best) {
      return {
        student_id: best.row.id, name: best.row.name,
        student_no: best.row.student_id, reason: "ok",
      };
    }
  }

  // ۲) تطبیق نام — سه کلمهٔ اول
  const namePart = digits.replace(/\d+/g, " ").trim();
  const key = normKey(namePart);
  if (!key || key.length < 4) {
    return { student_id: null, name: null, student_no: studentNo, reason: "short" };
  }

  let bestRow: typeof rows[0] | null = null, bestScore = 0, second = 0;
  for (const r of rows) {
    if (!r.name) continue;
    const s = nameScore(r.name, namePart);
    if (s > bestScore) { second = bestScore; bestScore = s; bestRow = r; }
    else if (s > second) { second = s; }
  }

  let reason = "ok";
  if (!bestRow || bestScore < MATCH_ACCEPT) reason = "weak";
  else if (bestScore - second < MATCH_MARGIN) reason = "ambiguous";

  return {
    student_id: reason === "ok" ? bestRow!.id : null,
    name: reason === "ok" ? bestRow!.name : null,
    student_no: studentNo,
    reason,
    score: Number(bestScore.toFixed(3)),
  };
}

// ══════════════════════════════════════════════════════════════
// کیبوردها و متن‌ها
// ══════════════════════════════════════════════════════════════
const BTN_STATUS = "📋 وضعیت من";
const BTN_DUE = "⏰ تاریخ تحویل";
const BTN_FILES = "📁 فایل‌های من";
const BTN_NEW = "🆕 تعدیلات جدید";

const mainKeyboard = () => ({
  keyboard: [
    [{ text: BTN_STATUS }, { text: BTN_DUE }],
    [{ text: BTN_FILES }, { text: BTN_NEW }],
  ],
  resize_keyboard: true,
  is_persistent: true,
});

const confirmKeyboard = () => ({
  inline_keyboard: [[
    { text: "✅ بله، من هستم", callback_data: "me:yes" },
    { text: "❌ نه، من نیستم", callback_data: "me:no" },
  ]],
});

const skipKeyboard = () => ({
  inline_keyboard: [[{ text: "⏭ رد کردن", callback_data: "num:skip" }]],
});

const TXT_INTRO =
  "سلام 👋 خوش آمدی به ربات <b>تعدیلات — شرکة الکوثر</b>\n\n" +
  "لطفاً <b>اسمت را بنویس</b> (نام، نام پدر، نام جد).\n" +
  "مثال: <i>محمد فاضل عباس الطالی</i>";

const TXT_HELP =
  "<b>راهنمای ربات</b>\n\n" +
  "۱) اسمت را می‌نویسی\n" +
  "۲) اگر لازم بود شمارهٔ دانشجویی را وارد می‌کنی\n" +
  "۳) تأیید می‌کنی که خودت هستی\n" +
  "۴) فایل‌های تعدیلات را می‌فرستی (از فایل‌ها، واتساپ یا هرجا)\n\n" +
  "<b>دکمه‌های پایین:</b>\n" +
  "📋 وضعیت من — وضعیت آخرین ارسال‌ها\n" +
  "⏰ تاریخ تحویل — زمان اعلام‌شده\n" +
  "📁 فایل‌های من — فایل‌های ارسالی\n" +
  "🆕 تعدیلات جدید — ارسال تازه\n\n" +
  "/reset — پاک کردن و شروع از اول";

const STATUS_FA: Record<string, string> = {
  draft: "ناتمام",
  new: "دریافت شد ⏳",
  started: "شروع شد 🚀",
  in_progress: "در حال انجام ✍️",
  ready: "آماده تحویل 🎁",
  completed: "تحویل شد ✅",
  rejected: "رد شد ❌",
};

const KIND_FA: Record<string, string> = {
  photo: "عکس",
  document: "فایل/PDF",
  voice: "ویس",
  audio: "صوت",
  video: "ویدیو",
};

function faDate(iso: unknown): string {
  if (!iso) return "—";
  try {
    const t = String(iso).replace("T", " ").slice(0, 16);
    const [d, tm] = t.split(" ");
    const [y, mo, dd] = d.split("-");
    return `${dd}/${mo}/${y} — ساعت ${tm}`;
  } catch {
    return String(iso).slice(0, 16);
  }
}

// ══════════════════════════════════════════════════════════════
// جریان گفتگو
// ══════════════════════════════════════════════════════════════
type Media = {
  kind: string;
  file_id: string;
  file_name: string;
  mime_type: string;
  file_size?: number;
} | null;

function extractMedia(message: Json): Media {
  const photo = message.photo as Json[] | undefined;
  if (photo?.length) {
    const p = photo.reduce((a, b) =>
      (Number(b.file_size ?? b.width ?? 0) > Number(a.file_size ?? a.width ?? 0) ? b : a));
    return {
      kind: "photo", file_id: String(p.file_id),
      file_name: `photo_${p.file_unique_id ?? "1"}.jpg`,
      mime_type: "image/jpeg", file_size: Number(p.file_size ?? 0),
    };
  }
  const doc = message.document as Json | undefined;
  if (doc) {
    return {
      kind: "document", file_id: String(doc.file_id),
      file_name: String(doc.file_name ?? "document.pdf"),
      mime_type: String(doc.mime_type ?? "application/octet-stream"),
      file_size: Number(doc.file_size ?? 0),
    };
  }
  const voice = message.voice as Json | undefined;
  if (voice) {
    return {
      kind: "voice", file_id: String(voice.file_id),
      file_name: `voice_${voice.file_unique_id ?? "1"}.ogg`,
      mime_type: String(voice.mime_type ?? "audio/ogg"),
      file_size: Number(voice.file_size ?? 0),
    };
  }
  const audio = message.audio as Json | undefined;
  if (audio) {
    return {
      kind: "audio", file_id: String(audio.file_id),
      file_name: String(audio.file_name ?? "audio.mp3"),
      mime_type: String(audio.mime_type ?? "audio/mpeg"),
      file_size: Number(audio.file_size ?? 0),
    };
  }
  const video = message.video as Json | undefined;
  if (video) {
    return {
      kind: "video", file_id: String(video.file_id),
      file_name: String(video.file_name ?? "video.mp4"),
      mime_type: String(video.mime_type ?? "video/mp4"),
      file_size: Number(video.file_size ?? 0),
    };
  }
  return null;
}

const stateKey = (userId: number) => `chat:${userId}`;

async function findStudentRequest(userId: number, profileId?: string | null) {
  if (profileId) {
    const r = await sbSelect(
      "tadilat_requests",
      `select=*&student_id=eq.${encodeURIComponent(profileId)}&order=created_at.desc&limit=1`,
    );
    if (r.length) return r[0];
  }
  const r = await sbSelect(
    "tadilat_requests",
    `select=*&telegram_user_id=eq.${userId}&order=created_at.desc&limit=1`,
  );
  return r[0] ?? null;
}

async function handleMedia(chatId: number, userId: number, message: Json, st: Json) {
  const media = extractMedia(message);
  if (!media) return;

  const me = await tg("getMe");
  const label = KIND_FA[media.kind] ?? media.kind;
  await tg("sendChatAction", { chat_id: chatId, action: "upload_document" });

  // ۱) درخواست را پیدا یا بساز
  let req = await findStudentRequest(userId, st.profile_id as string | undefined);
  const from = (message.from ?? {}) as Json;
  if (!req) {
    const rows = await sbInsert("tadilat_requests", [{
      source: "telegram_bot",
      telegram_user_id: userId,
      telegram_username: from.username ?? null,
      telegram_name:
        [from.first_name, from.last_name].filter(Boolean).join(" ").trim() || null,
      student_id: st.profile_id ?? null,
      student_name: (st.name as string) || "—",
      student_no: st.student_no ?? null,
      status: "new",
      files_count: 0,
    }]);
    req = rows[0];
    if (!req) {
      await send(chatId, "❌ ساخت درخواست ناموفق بود؛ دوباره بفرست.");
      return;
    }
  } else if (!req.student_id && st.profile_id) {
    await sbUpdate("tadilat_requests", `id=eq.${encodeURIComponent(req.id)}`, {
      student_id: st.profile_id,
      student_name: st.name ?? req.student_name,
      student_no: st.student_no ?? req.student_no,
    });
  }

  // ۲) دانلود از تلگرام
  const info = await tg("getFile", { file_id: media.file_id });
  const filePath = info?.file_path;
  if (!filePath) {
    await send(chatId, "❌ تلگرام فایل را نداد؛ دوباره بفرست.");
    return;
  }
  const size = Number(info?.file_size ?? media.file_size ?? 0);
  if (size && size > MAX_FILE_MB * 1048576) {
    await send(chatId,
      `⚠️ حجم این فایل ${(size / 1048576).toFixed(1)} مگابایت است؛ ` +
      `سقف ربات ${MAX_FILE_MB} مگابایت است.\nفایل کوچک‌تری بفرست.`);
    return;
  }

  let data: ArrayBuffer;
  try {
    const fr = await fetch(`${TG_FILE}/${filePath}`);
    if (!fr.ok) throw new Error(`HTTP ${fr.status}`);
    data = await fr.arrayBuffer();
  } catch (e) {
    log("download failed", String(e));
    await send(chatId, "❌ دانلود فایل ناموفق بود؛ دوباره بفرست.");
    return;
  }

  // ۳) آپلود در Storage
  const path = `${PREFIX}/${userId}/${req.id}/${crypto.randomUUID().slice(0, 6)}_${
    safeKey(media.file_name)
  }`;
  if (!(await sbUpload(path, data, media.mime_type))) {
    await send(chatId, "❌ ذخیرهٔ فایل ناموفق بود؛ دوباره بفرست.");
    return;
  }

  // ۴) ثبت ردیف
  const kindDb = media.kind === "photo"
    ? "photo"
    : (media.kind === "audio" || media.kind === "voice" ? "audio" : "document");
  await sbInsert("tadilat_files", [{
    request_id: req.id,
    kind: kindDb,
    file_name: media.file_name,
    storage_path: path,
    mime_type: media.mime_type,
    file_size: data.byteLength,
    caption: message.caption ?? null,
    telegram_file_id: media.file_id,
  }]);

  // ۵) شمارنده + بازکردن درخواست بسته
  const filesCount = Number(req.files_count ?? 0) + 1;
  const patch: Json = { files_count: filesCount };
  if (["completed", "ready", "rejected"].includes(String(req.status))) {
    patch.status = "new";
  }
  await sbUpdate("tadilat_requests", `id=eq.${encodeURIComponent(req.id)}`, patch);

  // ۶) پاسخ
  await send(chatId,
    "✅ <b>تعدیلات شما ارسال شد</b>\n\n" +
    `📎 ${label} دریافت شد (جمعاً ${filesCount} فایل)\n` +
    `🔖 کد پیگیری: <b>${esc(req.code ?? req.id)}</b>\n\n` +
    "از دکمه‌های پایین می‌توانی <b>وضعیت</b> و <b>تاریخ تحویل</b> را ببینی.",
    mainKeyboard());
  log("file attached", req.id, kindDb, me?.username ?? "");
}

async function showStatus(chatId: number, userId: number, st: Json) {
  let rows = await sbSelect("tadilat_requests",
    `select=*&telegram_user_id=eq.${userId}&order=created_at.desc&limit=5`);
  if (st.profile_id) {
    const byStudent = await sbSelect("tadilat_requests",
      `select=*&student_id=eq.${encodeURIComponent(String(st.profile_id))}&order=created_at.desc&limit=5`);
    if (byStudent.length) rows = byStudent;
  }
  if (!rows.length) {
    await send(chatId,
      "هنوز تعدیلاتی ارسال نکرده‌ای.\nهر فایلی بفرستی، همین‌جا وضعیتش را می‌بینی.",
      mainKeyboard());
    return;
  }
  const out = ["📋 <b>وضعیت ارسال‌های تو</b>", ""];
  for (const r of rows) {
    out.push(`🔖 کد <b>${esc(r.code ?? "—")}</b>`);
    out.push(`   ${STATUS_FA[r.status] ?? r.status ?? "—"}`);
    out.push(`   📎 ${r.files_count ?? 0} فایل · ${faDate(r.created_at)}`);
    if (r.assigned_agent_name) out.push(`   ✍️ ${esc(r.assigned_agent_name)}`);
    if (r.due_at) out.push(`   ⏰ تحویل: ${faDate(r.due_at)}`);
    out.push("");
  }
  await send(chatId, out.join("\n"), mainKeyboard());
}

async function showDue(chatId: number, userId: number, st: Json) {
  let rows = st.profile_id
    ? await sbSelect("tadilat_requests",
      `select=*&student_id=eq.${encodeURIComponent(String(st.profile_id))}&order=created_at.desc&limit=1`)
    : [];
  if (!rows.length) {
    rows = await sbSelect("tadilat_requests",
      `select=*&telegram_user_id=eq.${userId}&order=created_at.desc&limit=1`);
  }
  if (!rows.length) {
    await send(chatId, "هنوز ارسالی نداری.", mainKeyboard());
    return;
  }
  const r = rows[0];
  if (r.due_at) {
    await send(chatId,
      `⏰ زمان تحویل اعلام‌شده:\n<b>${faDate(r.due_at)}</b>\n\n` +
      `🔖 کد پیگیری: <b>${esc(r.code ?? "—")}</b>`, mainKeyboard());
  } else {
    await send(chatId,
      "⏰ هنوز زمان تحویلی برای این تعدیلات تعیین نشده.\n" +
      "به‌محض تعیین، همین‌جا می‌بینی.", mainKeyboard());
  }
}

async function showFiles(chatId: number, userId: number, st: Json) {
  let rows = st.profile_id
    ? await sbSelect("tadilat_requests",
      `select=*&student_id=eq.${encodeURIComponent(String(st.profile_id))}&order=created_at.desc&limit=1`)
    : [];
  if (!rows.length) {
    rows = await sbSelect("tadilat_requests",
      `select=*&telegram_user_id=eq.${userId}&order=created_at.desc&limit=1`);
  }
  if (!rows.length) {
    await send(chatId, "هنوز فایلی نفرستاده‌ای.", mainKeyboard());
    return;
  }
  const files = await sbSelect("tadilat_files",
    `select=kind,file_name,file_size&request_id=eq.${encodeURIComponent(String(rows[0].id))}&order=created_at.asc`);
  if (!files.length) {
    await send(chatId, "برای آخرین ارسال، فایلی ثبت نشده.", mainKeyboard());
    return;
  }
  const out = ["📁 <b>فایل‌های آخرین ارسال</b>",
    `🔖 کد <b>${esc(rows[0].code ?? "—")}</b>`, ""];
  for (const f of files) {
    out.push(`• ${KIND_FA[f.kind] ?? "📄"} ${esc(f.file_name ?? "فایل")} ` +
      `<i>(${Math.round((f.file_size ?? 0) / 1024)} KB)</i>`);
  }
  await send(chatId, out.join("\n"), mainKeyboard());
}

async function onName(chatId: number, userId: number, text: string) {
  if (text.length < 3) {
    await send(chatId, "اسمت را کامل‌تر بنویس 🙂");
    return;
  }
  await tg("sendChatAction", { chat_id: chatId, action: "typing" });
  const det = await detect(text);
  if (det.student_id) {
    await setState(stateKey(userId), {
      stage: "confirm", name: text, student_no: det.student_no ?? null,
      profile_id: null,
      candidate: { id: det.student_id, name: det.name, student_no: det.student_no },
    });
    await send(chatId, `🔎 آیا تو <b>${esc(det.name)}</b> هستی؟`, confirmKeyboard());
    return;
  }
  await setState(stateKey(userId), {
    stage: "number", name: text, profile_id: null, candidate: null,
  });
  await send(chatId,
    "اسمت را در فهرست پیدا نکردم 🤔\n\n" +
    "اگر <b>شمارهٔ دانشجویی</b> داری بنویس تا دقیق‌تر پیدایت کنم.\n" +
    "اگر هم نداری، «رد کردن» را بزن.", skipKeyboard());
}

async function onNumber(chatId: number, userId: number, text: string) {
  const st = await getState(stateKey(userId));
  const name = String(st.name ?? "");
  const det = await detect(`${name} ${text}`.trim());
  if (det.student_id) {
    await setState(stateKey(userId), {
      stage: "confirm", student_no: text,
      candidate: { id: det.student_id, name: det.name, student_no: det.student_no ?? text },
    });
    await send(chatId, `🔎 آیا تو <b>${esc(det.name)}</b> هستی؟`, confirmKeyboard());
    return;
  }
  await setState(stateKey(userId), {
    stage: "ready", profile_id: null, name, student_no: text, candidate: null,
  });
  await send(chatId,
    "پروفایلی با این مشخصات پیدا نکردم، ولی مشکلی نیست — " +
    "کارشناسان خودشان وصلش می‌کنند.\n\n" +
    "📤 حالا هر تعدیلاتی داری بفرست (عکس، PDF، Word یا ویس — از فایل‌ها یا واتساپ).",
    mainKeyboard());
}

async function handleMessage(message: Json) {
  const chat = (message.chat ?? {}) as Json;
  const chatId = Number(chat.id);
  if (!chatId) return;
  const from = (message.from ?? {}) as Json;
  const userId = Number(from.id ?? chatId);
  const text = String(message.text ?? "").trim();
  const st = await getState(stateKey(userId));
  const ready = st.stage === "ready";

  // ── فایل (شامل فوروارد از واتساپ) ──
  if (extractMedia(message)) {
    if (!ready) {
      await setState(stateKey(userId), { ...st, stage: "name" });
      await send(chatId,
        "📥 قبل از فرستادن فایل، یک‌بار خودت را معرفی کن:\n\n" + TXT_INTRO);
      return;
    }
    await handleMedia(chatId, userId, message, st);
    return;
  }

  // ── دستورها ──
  if (text.startsWith("/")) {
    const cmd = text.split(/\s+/)[0].split("@")[0].toLowerCase();
    if (["/start", "/app", "/new"].includes(cmd)) {
      if (ready) {
        await send(chatId,
          "خوش آمدی دوباره 👋\n📤 هر فایلی بفرستی خودکار به تعدیلاتت وصل می‌شود.",
          mainKeyboard());
      } else {
        await setState(stateKey(userId), { stage: "name" });
        await send(chatId, TXT_INTRO);
      }
      return;
    }
    if (cmd === "/help") { await send(chatId, TXT_HELP, mainKeyboard()); return; }
    if (cmd === "/status") { await showStatus(chatId, userId, st); return; }
    if (cmd === "/reset") {
      await setState(stateKey(userId), { stage: "name" });
      await send(chatId, TXT_INTRO);
      return;
    }
    await send(chatId, "دستور ناشناخته. /help را بزنید.");
    return;
  }

  // ── دکمه‌های منو ──
  if (text === BTN_STATUS) { await showStatus(chatId, userId, st); return; }
  if (text === BTN_DUE) { await showDue(chatId, userId, st); return; }
  if (text === BTN_FILES) { await showFiles(chatId, userId, st); return; }
  if (text === BTN_NEW) {
    await setState(stateKey(userId), { ...st, stage: "ready" });
    await send(chatId,
      "📤 بفرست! هر فایلی — عکس، PDF، Word یا ویس.\n" +
      "از واتساپ هم می‌شود: Share → Telegram.", mainKeyboard());
    return;
  }

  // ── جریان شناسایی ──
  if (!ready) {
    const stage = String(st.stage ?? "name");
    if (stage === "number") { await onNumber(chatId, userId, text); return; }
    if (stage === "confirm") {
      await send(chatId, "لطفاً از دکمه‌های بالا استفاده کن: ✅ بله یا ❌ نه");
      return;
    }
    await onName(chatId, userId, text);
    return;
  }

  await send(chatId,
    "📎 هر فایلی بفرستی خودکار به تعدیلاتت وصل می‌شود.\n" +
    "از دکمه‌های پایین وضعیتت را ببین.", mainKeyboard());
}

async function handleCallback(query: Json) {
  const data = String(query.data ?? "");
  const chat = ((query.message ?? {}) as Json).chat as Json | undefined;
  const chatId = Number(chat?.id ?? 0);
  const from = (query.from ?? {}) as Json;
  const userId = Number(from.id ?? chatId);
  await tg("answerCallbackQuery", { callback_query_id: query.id });
  if (!chatId) return;
  const st = await getState(stateKey(userId));

  if (data === "status") { await showStatus(chatId, userId, st); return; }

  if (data === "me:yes") {
    const cand = (st.candidate ?? {}) as Json;
    await setState(stateKey(userId), {
      stage: "ready",
      profile_id: cand.id ?? null,
      name: cand.name ?? st.name ?? "",
      student_no: cand.student_no ?? st.student_no ?? null,
      candidate: null,
    });
    await send(chatId,
      `✅ ثبت شد، <b>${esc(cand.name ?? "")}</b> عزیز!\n\n` +
      "📤 حالا هر تعدیلاتی داری بفرست — عکس، PDF، Word یا ویس.\n" +
      "می‌توانی از <b>واتساپ</b> هم Share → Telegram کنی.", mainKeyboard());
    return;
  }

  if (data === "me:no") {
    await setState(stateKey(userId), {
      stage: "name", candidate: null, profile_id: null,
    });
    await send(chatId,
      "باشه 🙂 اسمت را دقیق‌تر بنویس (نام، نام پدر، نام جد) تا درست پیدایت کنم.");
    return;
  }

  if (data === "num:skip") {
    await setState(stateKey(userId), {
      stage: "ready", profile_id: null,
      name: st.name ?? "", student_no: null, candidate: null,
    });
    await send(chatId,
      "بسیار خوب 👍 کارشناسان پروفایلت را وصل می‌کنند.\n\n" +
      "📤 حالا تعدیلاتت را بفرست.", mainKeyboard());
  }
}

// ══════════════════════════════════════════════════════════════
// نقطهٔ ورود — Webhook
// ══════════════════════════════════════════════════════════════
serve(async (req: Request) => {
  const url = new URL(req.url);

  // بررسی سلامت
  if (req.method === "GET") {
    return new Response(JSON.stringify({
      ok: true,
      bot: Boolean(TG_TOKEN),
      supabase: Boolean(SB_URL && SB_KEY),
      bucket: BUCKET,
      note: "این نقطهٔ Webhook تلگرام است.",
    }), { headers: { "Content-Type": "application/json" } });
  }

  // امنیت: فقط تلگرام با هدر درست
  if (SECRET) {
    const got = req.headers.get("x-telegram-bot-api-secret-token");
    if (got !== SECRET) {
      log("secret mismatch");
      return new Response("forbidden", { status: 403 });
    }
  }

  let update: Json;
  try {
    update = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }

  // پاسخ فوری به تلگرام، پردازش در پس‌زمینه
  // (وگرنه تلگرام ۱۰ ثانیه صبر می‌کند و دوباره می‌فرستد)
  const work = (async () => {
    try {
      if (update.message) await handleMessage(update.message as Json);
      else if (update.callback_query) await handleCallback(update.callback_query as Json);
    } catch (e) {
      log("handle error:", String(e), (e as Error)?.stack?.slice(0, 500));
    }
  })();

  // @ts-ignore EdgeRuntime در Supabase موجود است
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(work);
  } else {
    await work;
  }

  return new Response("ok");
});
