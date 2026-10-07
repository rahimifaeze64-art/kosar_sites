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
  var LS_LANG = 'tadilat_app_lang_v1';

  // ══════════════════════════════════════════════════════════
  // چندزبانه: فارسی + عربی  (هر دو راست‌به‌چپ)
  // ══════════════════════════════════════════════════════════
  var I18N = {
    fa: {
      // سرصفحه
      hero_hello: 'سلام! 👋', hero_pill: 'تعدیلاتت رو بفرست',
      aria_help: 'راهنما', aria_lang: 'انتخاب زبان', aria_mic: 'اسمت را بگو',
      browser_warn: '💡 بیرون از تلگرام باز شده. کار می‌کند، ولی از دکمهٔ منوی ربات بازش کنی بهتر است.',
      // باکس اسم
      name_title: 'اسمت چیه؟', name_sub: 'اسمت را <b>بگو</b> تا خودمان پیدایت کنیم',
      mic_hint: '🎤 بزن و اسمت را بگو <b>(الزامی)</b>',
      voice_recording: 'در حال ضبط…', btn_stop: 'تمام', btn_rerecord: 'ضبط دوباره',
      btn_not_my_name: 'اسم من این نیست',
      picker_hint: 'از فهرست انتخاب کن یا خودت بنویس',
      ph_search: '🔍 جستجوی نام یا شمارهٔ دانشجویی…',
      label_write: 'یا خودت بنویس <span class="hint">(اختیاری)</span>',
      ph_name: 'نام و نام خانوادگی',
      label_no: 'شمارهٔ دانشجویی <span class="hint">(اختیاری — برای دقت بیشتر)</span>',
      ph_no: 'مثال: 40254021132', btn_continue: 'ادامه',
      // باکس فایل
      files_title: 'تعدیلاتت چیه؟',
      files_sub: 'عکس، PDF، Word یا هر فرمت صوتی — چندتایی هم می‌شه',
      dz_title: 'فایل‌ها را اینجا بریز', dz_sub: 'یا از دکمه‌های پایین انتخاب کن',
      pick_camera: 'دوربین', pick_gallery: 'گالری', pick_doc: 'PDF / سند',
      pick_audio: 'فایل صوتی', pick_any: 'همهٔ فایل‌ها',
      wa_title: 'از واتساپ هم می‌شه!',
      wa_body: 'فایل را در واتساپ بزن <b>Share → Telegram</b> و برای همین ربات بفرست؛ خودش به همین درخواستت وصل می‌شود.',
      // توضیحات
      note_title: 'توضیح بده', note_sub: 'هر نکته‌ای که فکر می‌کنی لازم است',
      ph_note: 'مثال: تعدیلات فصل دوم بعد از مناقشه — لطفاً تا آخر هفته',
      // پایان
      done_title: 'تعدیلاتت رسید!',
      done_sub: 'تیم نویسنده‌ها بررسی می‌کند و وضعیت را همین‌جا می‌بینی.',
      lbl_name: 'نام', lbl_files_count: 'تعداد فایل', lbl_code: 'کد پیگیری',
      btn_another: 'ارسال تعدیلات جدید',
      // وضعیت
      progress_title: 'پیشرفت تعدیلات', my_status: 'وضعیت من',
      stat_files: 'تعداد فایل‌ها', not_set: 'تعیین نشده', stat_due: 'زمان تحویل',
      stat_status: 'وضعیت فعلی', stat_ready: 'آمادهٔ دانلود',
      track_title: 'مسیر تعدیلاتت', track_sub: 'هر مرحله که رد شود، تیک می‌خورد',
      due_label: 'زمان تحویل اعلام‌شده', deliv_title: '🎁 فایل‌های آماده‌شده',
      empty_title: 'هنوز تعدیلاتی نداری',
      empty_sub: 'اولین تعدیلاتت را از تب «ارسال» بفرست.', btn_go_send: 'رفتن به ارسال',
      // راهنما
      how_title: 'چطور کار می‌کند؟',
      how1_t: 'اسمت را بگو', how1_s: 'با 🎤 اسمت را بگو تا بدونیم تعدیلات مال کیه',
      how2_t: 'فایل‌ها را بفرست', how2_s: 'عکس، PDF، Word یا فایل صوتی — چندتایی',
      how3_t: 'وضعیت را دنبال کن', how3_s: 'دریافت شد ← شروع شد ← در حال انجام ← آماده تحویل',
      wa_card_title: 'فایل از واتساپ داری؟', wa_card_sub: 'یک راه سریع',
      wa_card_body: 'در واتساپ روی فایل بزن <b>Share → Telegram</b> و برای همین ربات بفرست. فایل خودش به آخرین درخواستت وصل می‌شود.',
      tips_title: 'نکته‌های کوچک', tips_sub: 'تا کارت سریع‌تر جلو برود',
      tip1: '📄 فایل‌های PDF و Word را کامل و بدون قفل بفرست',
      tip2: '🖼 عکس‌ها را واضح و از بالا بگیر',
      tip3: '🎤 اگر توضیحِ ویس داری، همان‌جا بگو',
      tip4: '⏱ زمان تحویل را در تب «وضعیت» می‌بینی',
      footer: 'سیستم مدیریت تحصیلی دانشجویان بین‌المللی',
      // نوار پایین
      btn_submit: 'ارسال تعدیلات', tab_send: 'ارسال', tab_status: 'وضعیت',
      tab_help: 'راهنما', blocker: 'در حال ارسال…',
      // مراحل و وضعیت‌ها
      st_new: 'دریافت شد', st_started: 'شروع شد', st_in_progress: 'در حال انجام',
      st_ready: 'آماده تحویل', st_completed: 'تحویل شد',
      st_draft: 'ناتمام', st_rejected: 'رد شد',
      // ── پویا ──
      voice_listening: '🎧 گوش می‌دهم…',
      voice_unsupported: '⚠️ این دستگاه ضبط صدا را پشتیبانی نمی‌کند؛ نامت را تایپ کن.',
      voice_stopped: 'ضبط تمام شد',
      voice_no_stt: '🎤 ویس ضبط شد (این مرورگر تشخیص گفتار ندارد) — اسمت را از فهرست انتخاب کن.',
      voice_saved: '🎤 ویس اسمت ضبط شد و همراه درخواست ذخیره می‌شود.',
      voice_heard_fail: '🎤 ویس ضبط شد. تشخیص خودکار روی این دستگاه کار نکرد — نامت را از فهرست انتخاب کن.',
      picker_notfound: 'دانشجویی با این نام پیدا نشد — می‌توانی خودت بنویسی',
      picker_choose: 'اسمت را از فهرست انتخاب کن',
      picker_no_stt: 'این مرورگر تشخیص خودکار ندارد؛ اسمت را از فهرست انتخاب کن',
      picker_unsure: 'مطمئن نشدم؛ اسمت را از فهرست انتخاب کن',
      picker_pick_hint: 'اسمت را از فهرست انتخاب کن یا خودت بنویس',
      resolved_heard: '🗣 شنیدم: «{0}»',
      resolved_you: '✅ اسم تو: <b>{0}</b>',
      resolved_you_no: '✅ اسم تو: <b>{0}</b> <span class="hint">({1})</span>',
      match_ok: '✅ <b>{0}</b> — پروفایلت پیدا شد؛ تعدیلات به خودت وصل می‌شود.',
      match_ok_writer: '✍️ نویسندهٔ شما: <b>{0}</b>',
      match_warn: '🤔 پروفایلت را پیدا نکردم. اشکالی ندارد — کارشناس‌ها وصلش می‌کنند.',
      match_warn_hint: 'برای اتصال دقیق‌تر، شمارهٔ دانشجویی را بنویس و دوباره ثبت کن.',
      welcome: 'خوش آمدی، {0}! 🌟',
      hello_named: 'سلام {0}! 👋',
      who_linked: '• متصل به پروفایل',
      who_unlinked: '• در انتظار اتصال کارشناس',
      who_edit: 'ویرایش',
      toast_voice_first: '🎤 اول روی دکمهٔ میکروفن بزن و اسمت را بگو.',
      toast_pick_name: 'اسمت را انتخاب کن یا بنویس 🙂',
      toast_bad_no: 'شمارهٔ دانشجویی معتبر نیست.',
      toast_identity_fail: 'بررسی مشخصات ناموفق بود: {0}',
      toast_min_file: '🙂 حداقل یک فایل تعدیلات انتخاب کن.',
      toast_files_rejected: '🚫 {0} فایل رد شد (خالی یا بزرگ‌تر از {1} مگابایت).',
      toast_many_failed: '⚠️ {0} فایل ارسال نشد؛ می‌توانی دوباره بفرستی.',
      toast_send_failed: 'ارسال نشد: {0}',
      toast_preparing_link: '⏳ دارم لینک دانلود را آماده می‌کنم…',
      toast_no_link: 'لینک دانلود ساخته نشد.',
      toast_first_identity: 'اول اسمت را ثبت کن 🙂',
      toast_no_config: 'تنظیمات Supabase پیدا نشد (js/supabase-config.js بارگذاری نشد).',
      progress_of: '{0} از {1} مرحله',
      code_label: 'کد پیگیری {0} · ',
      waiting_writer: '⏳ در انتظار تعیین نویسنده',
      writer_label: '✍️ نویسنده: {0}',
      deliv_download: 'دانلود',
      picker_more: 'و {0} مورد دیگر — دقیق‌تر جستجو کن',
      voice_mic_denied: '⚠️ دسترسی به میکروفن نشد. اگر می‌توانی، اجازهٔ میکروفن را بده یا نامت را از فهرست انتخاب کن.',
      pill_no: 'شمارهٔ {0}',
      pill_linked: 'متصل به پروفایل',
      time_at: 'ساعت',
      blocker_preparing: 'دارم آماده می‌کنم…',
      blocker_uploading: 'ارسال فایل {0} از {1}…',
      err_network: 'خطای شبکه در آپلود',
      err_no_request: 'درخواست ساخته نشد',
      file_default: 'تعدیلات',
      uploader_student: 'دانشجو',
      toast_migration: 'جدول‌های تعدیلات در دیتابیس ساخته نشده‌اند. فایل supabase/tadilat_telegram_migration.sql را اجرا کن.',
      history_title: '📤 ارسال‌های قبلی',
      unit_byte: 'بایت', unit_kb: 'کیلوبایت', unit_mb: 'مگابایت',
      k_image: 'عکس', k_pdf: 'PDF', k_word: 'Word', k_sheet: 'Excel',
      k_audio: 'صدا', k_video: 'ویدیو', k_zip: 'فشرده', k_other: 'فایل',
    },
    ar: {
      hero_hello: 'مرحباً! 👋', hero_pill: 'أرسل تعديلاتك',
      aria_help: 'مساعدة', aria_lang: 'اختيار اللغة', aria_mic: 'قل اسمك',
      browser_warn: '💡 تم فتحه خارج تلگرام. يعمل، لكن الأفضل فتحه من زر قائمة البوت.',
      name_title: 'ما اسمك؟', name_sub: 'قل <b>اسمك</b> لنبحث عنك',
      mic_hint: '🎤 اضغط وقل اسمك <b>(إلزامي)</b>',
      voice_recording: 'جارٍ التسجيل…', btn_stop: 'تم', btn_rerecord: 'إعادة التسجيل',
      btn_not_my_name: 'ليس اسمي',
      picker_hint: 'اختر من القائمة أو اكتبه بنفسك',
      ph_search: '🔍 ابحث بالاسم أو برقم الطالب…',
      label_write: 'أو اكتبه بنفسك <span class="hint">(اختياري)</span>',
      ph_name: 'الاسم الكامل',
      label_no: 'رقم الطالب <span class="hint">(اختياري — لدقة أكبر)</span>',
      ph_no: 'مثال: 40254021132', btn_continue: 'متابعة',
      files_title: 'ما هي تعديلاتك؟',
      files_sub: 'صور، PDF، Word أو أي صيغة صوتية — ويمكن أكثر من ملف',
      dz_title: 'أفلت الملفات هنا', dz_sub: 'أو اختر من الأزرار أدناه',
      pick_camera: 'الكاميرا', pick_gallery: 'المعرض', pick_doc: 'PDF / مستند',
      pick_audio: 'ملف صوتي', pick_any: 'كل الملفات',
      wa_title: 'يمكنك من واتساب أيضاً!',
      wa_body: 'اضغط على الملف في واتساب ثم <b>Share → Telegram</b> وأرسله إلى هذا البوت؛ سيُربط تلقائياً بطلبك.',
      note_title: 'اكتب توضيحاً', note_sub: 'أي ملاحظة تراها ضرورية',
      ph_note: 'مثال: تعديلات الفصل الثاني بعد المناقشة — من فضلك حتى نهاية الأسبوع',
      done_title: 'وصلت تعديلاتك!',
      done_sub: 'سيراجعها فريق الكتّاب وسترى الحالة هنا.',
      lbl_name: 'الاسم', lbl_files_count: 'عدد الملفات', lbl_code: 'رمز المتابعة',
      btn_another: 'إرسال تعديلات جديدة',
      progress_title: 'تقدّم التعديلات', my_status: 'حالتي',
      stat_files: 'عدد الملفات', not_set: 'غير محدد', stat_due: 'موعد التسليم',
      stat_status: 'الحالة الحالية', stat_ready: 'جاهز للتنزيل',
      track_title: 'مسار تعديلاتك', track_sub: 'كل مرحلة تُنجَز تُعلَّم بعلامة ✓',
      due_label: 'موعد التسليم المعلن', deliv_title: '🎁 الملفات الجاهزة',
      empty_title: 'لا توجد تعديلات بعد',
      empty_sub: 'أرسل تعديلاتك الأولى من تبويب «إرسال».', btn_go_send: 'الذهاب إلى الإرسال',
      how_title: 'كيف يعمل؟',
      how1_t: 'قل اسمك', how1_s: 'قل اسمك بصوتك 🎤 لنعرف صاحب التعديلات',
      how2_t: 'أرسل الملفات', how2_s: 'صور، PDF، Word أو ملف صوتي — ويمكن أكثر من ملف',
      how3_t: 'تابع الحالة', how3_s: 'تم الاستلام ← بدأ العمل ← قيد التنفيذ ← جاهز للتسليم',
      wa_card_title: 'لديك ملف من واتساب؟', wa_card_sub: 'طريقة سريعة',
      wa_card_body: 'اضغط على الملف في واتساب ثم <b>Share → Telegram</b> وأرسله إلى هذا البوت. سيُربط تلقائياً بآخر طلب لك.',
      tips_title: 'نصائح صغيرة', tips_sub: 'لتسريع عملك',
      tip1: '📄 أرسل ملفات PDF و Word كاملة وغير محمية',
      tip2: '🖼 صوّر الأوراق بوضوح ومن الأعلى',
      tip3: '🎤 إذا كان لديك توضيح صوتي، سجّله هنا',
      tip4: '⏱ ترى موعد التسليم في تبويب «الحالة»',
      footer: 'نظام إدارة دراسة الطلبة الدوليين',
      btn_submit: 'إرسال التعديلات', tab_send: 'إرسال', tab_status: 'الحالة',
      tab_help: 'مساعدة', blocker: 'جارٍ الإرسال…',
      st_new: 'تم الاستلام', st_started: 'بدأ العمل', st_in_progress: 'قيد التنفيذ',
      st_ready: 'جاهز للتسليم', st_completed: 'تم التسليم',
      st_draft: 'غير مكتمل', st_rejected: 'مرفوض',
      voice_listening: '🎧 أستمع…',
      voice_unsupported: '⚠️ هذا الجهاز لا يدعم التسجيل؛ اكتب اسمك.',
      voice_stopped: 'انتهى التسجيل',
      voice_no_stt: '🎤 سُجّل الصوت (هذا المتصفح لا يتعرّف على الكلام) — اختر اسمك من القائمة.',
      voice_saved: '🎤 تم تسجيل صوتك وسيُرفَق بالطلب.',
      voice_heard_fail: '🎤 سُجّل الصوت. التعرّف التلقائي لا يعمل على هذا الجهاز — اختر اسمك من القائمة.',
      picker_notfound: 'لا يوجد طالب بهذا الاسم — يمكنك كتابته بنفسك',
      picker_choose: 'اختر اسمك من القائمة',
      picker_no_stt: 'هذا المتصفح لا يدعم التعرّف التلقائي؛ اختر اسمك من القائمة',
      picker_unsure: 'لست متأكداً؛ اختر اسمك من القائمة',
      picker_pick_hint: 'اختر اسمك من القائمة أو اكتبه بنفسك',
      resolved_heard: '🗣 سمعت: «{0}»',
      resolved_you: '✅ اسمك: <b>{0}</b>',
      resolved_you_no: '✅ اسمك: <b>{0}</b> <span class="hint">({1})</span>',
      match_ok: '✅ <b>{0}</b> — تم العثور على ملفك؛ ستُربط التعديلات بك.',
      match_ok_writer: '✍️ كاتبك: <b>{0}</b>',
      match_warn: '🤔 لم أجد ملفك. لا مشكلة — سيربطه المختصون.',
      match_warn_hint: 'لربط أدق، اكتب رقم الطالب وأعد التسجيل.',
      welcome: 'أهلاً {0}! 🌟',
      hello_named: 'مرحباً {0}! 👋',
      who_linked: '• مرتبط بالملف الشخصي',
      who_unlinked: '• بانتظار ربط المختص',
      who_edit: 'تعديل',
      toast_voice_first: '🎤 أولاً اضغط زر الميكروفون وقل اسمك.',
      toast_pick_name: 'اختر اسمك أو اكتبه 🙂',
      toast_bad_no: 'رقم الطالب غير صالح.',
      toast_identity_fail: 'تعذّر التحقق من بياناتك: {0}',
      toast_min_file: '🙂 اختر ملف تعديلات واحداً على الأقل.',
      toast_files_rejected: '🚫 رُفض {0} ملف (فارغ أو أكبر من {1} ميغابايت).',
      toast_many_failed: '⚠️ لم يُرسَل {0} ملف؛ يمكنك إعادة المحاولة.',
      toast_send_failed: 'لم يُرسَل: {0}',
      toast_preparing_link: '⏳ أُجهّز رابط التنزيل…',
      toast_no_link: 'لم يُنشأ رابط التنزيل.',
      toast_first_identity: 'أولاً سجّل اسمك 🙂',
      toast_no_config: 'لم يتم العثور على إعدادات Supabase (js/supabase-config.js لم يُحمّل).',
      progress_of: '{0} من {1} مرحلة',
      code_label: 'رمز المتابعة {0} · ',
      waiting_writer: '⏳ بانتظار تعيين كاتب',
      writer_label: '✍️ الكاتب: {0}',
      deliv_download: 'تنزيل',
      picker_more: 'و {0} أخرى — ابحث بدقة أكبر',
      voice_mic_denied: '⚠️ لم يتم الوصول إلى الميكروفون. اسمح بالوصول إن أمكن أو اختر اسمك من القائمة.',
      pill_no: 'الرقم {0}',
      pill_linked: 'مرتبط بالملف الشخصي',
      time_at: 'الساعة',
      blocker_preparing: 'أُجهّز…',
      blocker_uploading: 'إرسال الملف {0} من {1}…',
      err_network: 'خطأ في الشبكة أثناء الرفع',
      err_no_request: 'لم يُنشأ الطلب',
      file_default: 'تعديلات',
      uploader_student: 'طالب',
      toast_migration: 'جداول التعديلات غير موجودة في قاعدة البيانات. نفّذ الملف supabase/tadilat_telegram_migration.sql.',
      history_title: '📤 إرسالاتك السابقة',
      unit_byte: 'بايت', unit_kb: 'كيلوبايت', unit_mb: 'ميغابايت',
      k_image: 'صورة', k_pdf: 'PDF', k_word: 'Word', k_sheet: 'Excel',
      k_audio: 'صوت', k_video: 'فيديو', k_zip: 'مضغوط', k_other: 'ملف',
    },
  };

  var DIGITS = { fa: '۰۱۲۳۴۵۶۷۸۹', ar: '٠١٢٣٤٥٦٧٨٩' };
  var currentLang = 'fa';

  function detectLang() {
    try {
      var saved = localStorage.getItem(LS_LANG);
      if (saved && I18N[saved]) return saved;
    } catch (e) { /* نادیده */ }
    try {
      var tg = window.Telegram && window.Telegram.WebApp;
      var u = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
      var code = String((u && u.language_code) || '');
      if (/^ar/i.test(code)) return 'ar';
      if (/^(fa|pe|per)/i.test(code)) return 'fa';
    } catch (e) { /* نادیده */ }
    try {
      var nav = String(navigator.language || navigator.userLanguage || '');
      if (/^ar/i.test(nav)) return 'ar';
    } catch (e) { /* نادیده */ }
    return 'fa';
  }

  /** ترجمهٔ یک کلید؛ {0} و {1} جای‌گذاری می‌شوند */
  function t(key, a, b) {
    var pack = I18N[currentLang] || I18N.fa;
    var s = pack[key];
    if (s == null) s = I18N.fa[key];
    if (s == null) return key;
    if (a !== undefined) s = s.replace('{0}', a);
    if (b !== undefined) s = s.replace('{1}', b);
    return s;
  }
  function tp(key, vars) {
    var s = t(key);
    (vars || []).forEach(function (v, i) { s = s.replace('{' + i + '}', v); });
    return s;
  }

  /** همهٔ متن‌های ثابت HTML را با زبان جاری پر می‌کند */
  function applyI18n() {
    var d = document.documentElement;
    d.setAttribute('lang', currentLang);
    d.setAttribute('dir', 'rtl');

    var i, nodes;
    nodes = document.querySelectorAll('[data-i18n]');
    for (i = 0; i < nodes.length; i++) nodes[i].textContent = t(nodes[i].getAttribute('data-i18n'));

    nodes = document.querySelectorAll('[data-i18n-html]');
    for (i = 0; i < nodes.length; i++) nodes[i].innerHTML = t(nodes[i].getAttribute('data-i18n-html'));

    nodes = document.querySelectorAll('[data-i18n-ph]');
    for (i = 0; i < nodes.length; i++) {
      nodes[i].setAttribute('placeholder', t(nodes[i].getAttribute('data-i18n-ph')));
    }
    nodes = document.querySelectorAll('[data-i18n-aria]');
    for (i = 0; i < nodes.length; i++) {
      nodes[i].setAttribute('aria-label', t(nodes[i].getAttribute('data-i18n-aria')));
    }
    nodes = document.querySelectorAll('.lang-opt');
    for (i = 0; i < nodes.length; i++) {
      nodes[i].classList.toggle('on', nodes[i].getAttribute('data-lang') === currentLang);
    }
  }

  function setLang(lang) {
    if (!I18N[lang] || lang === currentLang) { applyI18n(); return; }
    currentLang = lang;
    try { localStorage.setItem(LS_LANG, lang); } catch (e) { /* نادیده */ }
    applyI18n();
    // متن‌های پویا دوباره ساخته شوند
    try { renderHeroPill(); } catch (e) {}
    try { renderQueue(); } catch (e) {}
    try { renderWhoChip(); } catch (e) {}
    try { if (state.lastReq) renderStatus(state.lastReq, state.lastFiles || []); } catch (e) {}
    try { haptic.tap(); } catch (e) {}
  }


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
    var map = DIGITS[currentLang] || DIGITS.fa;
    return String(v == null ? '' : v).replace(/[0-9]/g, function (d) { return map[d]; });
  }
  function bytes(n) {
    n = Number(n) || 0;
    if (n < 1024) return fa(n) + ' ' + t('unit_byte');
    if (n < 1048576) return fa((n / 1024).toFixed(1)) + ' ' + t('unit_kb');
    return fa((n / 1048576).toFixed(1)) + ' ' + t('unit_mb');
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

  /** تاریخ میلادی برای دانشجویان عرب‌زبان */
  function gregorianDate(iso) {
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('ar-EG-u-nu-arab', {
        year: 'numeric', month: 'long', day: 'numeric',
      });
    } catch (e) {
      try { return new Date(iso).toLocaleDateString('ar-EG'); } catch (e2) { return '—'; }
    }
  }
  function jalaliDate(iso) {
    // دانشجوی عرب‌زبان تاریخ میلادی می‌بیند
    if (currentLang === 'ar') return gregorianDate(iso);
    var p = jalaliParts(iso);
    if (!p) return '—';
    return fa(p.jd) + ' ' + MONTHS[p.jm - 1] + ' ' + fa(p.jy);
  }
  function jalaliDateTime(iso) {
    var p = jalaliParts(iso);
    if (!p) return '—';
    var hm = fa(('0' + p.hh).slice(-2) + ':' + ('0' + p.mi).slice(-2));
    // برای دانشجوی عرب‌زبان تاریخ میلادی طبیعی‌تر است
    if (currentLang === 'ar') return gregorianDate(iso) + ' — ' + hm;
    return jalaliDate(iso) + ' — ' + t('time_at') + ' ' + hm;
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
      xhr.onerror = function () { reject(new Error(t('err_network'))); };
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
    $('blocker-text').textContent = text || t('blocker');
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
    $('voice-title').textContent = t('voice_recording');
    $('voice-timer').textContent = mmss(0);
    $('voice-text').textContent = speakSupported() ? t('voice_listening') : '';
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
            t('voice_mic_denied');
          $('voice-text').className = 'voice-text bad';
        });
    } else {
      $('voice-text').textContent = t('voice_unsupported');
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
            $('voice-text').textContent = t('voice_heard', text);
            $('voice-text').className = 'voice-text ok';
            // همین حالا با نزدیک‌ترین نام در profiles تطبیق بده
            matchHeardName(text);
          }
        };
        speech.onerror = function (ev) {
          console.warn('speech error', ev.error);
          if (!state.voiceText) {
            $('voice-text').textContent = t('voice_heard_fail');
            $('voice-text').className = 'voice-text bad';
            showPicker(t('picker_no_stt'));
          }
        };
        speech.onend = function () { speech = null; };
        speech.start();
      } catch (e) {
        console.warn('speech start failed', e);
        speech = null;
      }
    } else {
      $('voice-text').textContent = t('voice_no_stt');
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
    $('voice-title').textContent = t('voice_stopped');
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
      $('voice-text').textContent = t('voice_saved');
      $('voice-text').className = 'voice-text';
    }
    // اگر تشخیص گفتار در دسترس نبود، فهرست انتخاب را باز کن
    if (!state.voiceHeard && !SpeechRec && state.voiceBlob) {
      showPicker(t('picker_no_stt'));
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
      (heard ? esc(t('resolved_heard', heard)) + '<br>' : '') +
      (student.student_no
        ? t('resolved_you_no', esc(student.name), esc(student.student_no))
        : t('resolved_you', esc(student.name)));
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
      if (!key || key.length < 3) { showPicker(t('picker_choose')); return null; }
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
      showPicker(t('picker_unsure'), heard);
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
        list.innerHTML = '<p class="name-empty">' + esc(t('picker_notfound')) + '</p>';
        return;
      }
      list.innerHTML = items.slice(0, 60).map(function (r) {
        return '<button class="name-item" type="button" data-pick="' + esc(r.id) + '">' +
          '<span>' + esc(r.name) + '</span>' +
          '<span class="ni-no">' + esc(r.student_id || '') + '</span></button>';
      }).join('') +
      (items.length > 60
        ? '<p class="name-empty">' + esc(t('picker_more', fa(items.length - 60))) + '</p>'
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
    showPicker(t('picker_pick_hint'));
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
    $('voice-title').textContent = t('voice_recording');
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
      (linked ? '<span style="color:#13774f">' + esc(t('who_linked')) + '</span>'
              : '<span style="color:#8a5600">' + esc(t('who_unlinked')) + '</span>') +
      (state.writer
        ? '<span>✍️ ' + esc(state.writer.agent_name) + '</span>'
        : '') +
      '<button class="link-btn" data-edit-id="1" type="button">' + esc(t('who_edit')) + '</button>';
  }

  function doIdentity() {
    var typed = normName($('in-name').value);
    var no = toEnDigits($('in-no').value).trim();

    // ۱) گفتن اسم الزامی است
    if (!state.voiceDone) {
      toast(t('toast_voice_first'));
      try { $('btn-mic').scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
      return;
    }

    // ۲) نام باید مشخص باشد: تطبیق خودکار، انتخاب از فهرست، یا نوشتن
    var chosen = state.matched;
    var name = chosen ? chosen.name : typed;
    if (!name || name.length < 3) {
      showPicker(t('picker_pick_hint'));
      toast(t('toast_pick_name'));
      return;
    }
    if (no && no.replace(/[^0-9A-Za-z]/g, '').length < 4) {
      toast(t('toast_bad_no'));
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
          box.innerHTML = t('match_ok', esc(res.name));
        } else {
          box.className = 'match-box match-warn';
          box.innerHTML = esc(t('match_warn')) +
            '<br><small>' + esc(t('match_warn_hint')) + '</small>';
        }
        show(box);
        haptic.ok();
        $('hero-title').textContent = t('welcome', name.split(' ')[0] || '');
        renderHeroPill();
        // مسیریابی: نویسندهٔ مربوط به این دانشجو
        if (state.identity.student_id) {
          resolveWriter(state.identity.student_id, name).then(function (w) {
            state.writer = w;
            renderWhoChip();
            if (w) {
              box.innerHTML += '<br>' + t('match_ok_writer', esc(w.agent_name));
            } else {
              box.innerHTML += '<br>' + esc(t('match_warn'));
            }
          });
        }
        setTimeout(revealForm, 800);
      })
      .catch(function (e) {
        haptic.err();
        toast(t('toast_identity_fail', e.message || e));
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
    if (state.identity && state.identity.student_id) bits.push(t('pill_linked'));
    else if (state.identity && state.identity.student_no) bits.push(t('pill_no', fa(state.identity.student_no)));
    pill.textContent = bits.length ? bits.join(' · ') : t('hero_pill');
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
    return t('k_' + (kind || 'other')) || t('k_other');
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
    if (rejected) toast(t('toast_files_rejected', fa(rejected), fa(MAX_FILE_BYTES / 1048576)));
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
        '<div class="q-info"><div class="q-name">' + esc(it.file.name || t('k_other')) + '</div>' +
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
      toast(t('toast_min_file'));
      return;
    }

    state.busy = true;
    $('btn-submit').disabled = true;
    blocker(t('blocker_preparing'));

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
        if (!requestId) throw new Error(t('err_no_request'));
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
          var fileName = sum.primaryName || t('file_default');
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
                uploaded_by_name: state.identity.name || t('uploader_student')
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
        if (sum.failed) toast(t('toast_many_failed', fa(sum.failed)));
      })
      .catch(function (e) {
        blocker(false);
        haptic.err();
        console.error(e);
        var msg = (e && e.message) ? e.message : String(e);
        if (/does not exist|schema cache|PGRST205/i.test(msg)) {
          msg = t('toast_migration');
        }
        toast(t('toast_send_failed', msg));
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
      blocker(t('blocker_uploading', fa(i + 1), fa(pending.length)));

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
  var STAGE_DEFS = [
    { key: 'new',         tkey: 'st_new',         emoji: '📥', field: 'submitted_at' },
    { key: 'started',     tkey: 'st_started',     emoji: '🚀', field: 'started_at' },
    { key: 'in_progress', tkey: 'st_in_progress', emoji: '✍️', field: null },
    { key: 'ready',       tkey: 'st_ready',       emoji: '🎁', field: 'ready_at' },
    { key: 'completed',   tkey: 'st_completed',   emoji: '✅', field: 'completed_at' }
  ];
  // عنوان‌ها با زبان جاری ساخته می‌شوند (هنگام تغییر زبان به‌روز می‌شوند)
  function stages() {
    return STAGE_DEFS.map(function (s) {
      return { key: s.key, title: t(s.tkey), emoji: s.emoji, field: s.field };
    });
  }
  function statusLabel(status) {
    return t('st_' + status) || status || '—';
  }

  function statusIndex(status) {
    var list = stages();
    for (var i = 0; i < list.length; i++) if (list[i].key === status) return i;
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
    state.lastReq = req;
    state.lastFiles = files || [];
    var list = stages();
    var idx = statusIndex(req.status);
    var rejected = req.status === 'rejected';
    var deliverables = files.filter(function (f) { return f.kind === 'deliverable'; });

    // نویسندهٔ درخواست — در سرتیتر کارت وضعیت
    if ($('status-sub')) {
      $('status-sub').textContent = (req.code ? t('code_label', fa(req.code)) : '') +
        (req.assigned_agent_name
          ? t('writer_label', req.assigned_agent_name)
          : t('waiting_writer'));
    }

    // ── کاشی‌های آماری ──
    $('stat-files').textContent = fa(req.files_count || files.length || 0);
    $('stat-status').textContent = statusLabel(req.status);
    $('stat-due').textContent = req.due_at ? jalaliDate(req.due_at) : t('not_set');
    $('stat-ready').textContent = fa(deliverables.length);

    // ── نوار پیشرفت (مثل نوار XP در طرح مرجع) ──
    var done = rejected ? 1 : Math.max(1, idx + 1);
    if ($('progress-fill')) {
      $('progress-fill').style.width = Math.round((done / list.length) * 100) + '%';
    }
    if ($('progress-value')) {
      $('progress-value').textContent = t('progress_of', fa(done), fa(list.length));
    }

    // ── فیلترهای قرصی مراحل (مراحل طي‌شده فعال‌اند) ──
    if ($('stage-pills')) {
      $('stage-pills').innerHTML = list.map(function (s, i) {
        var on = rejected ? (i === 0) : (i <= idx);
        return '<button class="pill' + (on ? ' on' : '') + '" type="button">' +
          '<span>' + s.emoji + ' ' + esc(s.title) + '</span></button>';
      }).join('');
    }

    // ── نمودار مراحل ──
    // مرحلهٔ وضعیت فعلی «انجام‌شده» و برجسته است؛ بقیه در انتظار.
    var html = '';
    list.forEach(function (stage, i) {
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
        '<div class="step-body"><div class="step-title" style="color:#9f1239">' + esc(t('st_rejected')) + '</div>' +
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
        var name = f.file_name || t('k_other');
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
          '" data-name="' + esc(name) + '" type="button">' + esc(t('deliv_download')) + '</button></div>';
      }).join('');
      show($('deliverables'));
    } else {
      hide($('deliverables'));
    }
  }

  function renderMiniHistory(rows) {
    if (!rows || rows.length < 2) { $('history-mini').innerHTML = ''; return; }
    $('history-mini').innerHTML =
      '<h3 class="deliverables-title" style="margin-top:14px">' + esc(t('history_title')) + '</h3>' +
      rows.slice(1, 6).map(function (r) {
        var st = r.status || 'new';
        return '<div class="hm-item"><span class="hm-date">' + esc(jalaliDate(r.created_at)) +
          ' — ' + fa(r.files_count || 0) + ' ' + esc(t('lbl_files_count')) + '</span>' +
          '<span class="hm-badge st-' + esc(st) + '">' + esc(statusLabel(st)) + '</span></div>';
      }).join('');
  }

  function download(path, name) {
    if (!path) return;
    toast(t('toast_preparing_link'), 'ok');
    sbSignedUrl(path, 3600).then(function (url) {
      if (!url) { toast(t('toast_no_link')); return; }
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

    // ── انتخاب زبان ──
    var langBox = $('lang-switch');
    if (langBox) {
      langBox.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('.lang-opt') : null;
        if (b) setLang(b.getAttribute('data-lang'));
      });
    }

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
      if (!state.identity) { toast(t('toast_first_identity')); return; }
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        addFiles(e.dataTransfer.files);
      }
    });
    on(dz, 'click', function () { $('file-any').click(); });
  }

  function boot() {
    console.log('📦 tadilat-app.js v' + APP_V + ' بارگذاری شد');

    // ── زبان: از ذخیرهٔ قبلی، یا زبان تلگرام، یا مرورگر ──
    currentLang = detectLang();
    applyI18n();

    // ── تلگرام: اسکریپتش async است، پس ممکن است دیرتر برسد.
    //    اپ هیچ‌وقت منتظر آن نمی‌ماند (روی موبایل حیاتی است).
    initTelegram();

    if (!sbReady()) {
      ready();
      toast(t('toast_no_config'));
      return;
    }

    bind();
    applyI18n();

    var saved = loadIdentity();
    if (saved && saved.name) {
      state.identity = saved;
      $('in-name').value = saved.name;
      $('in-no').value = saved.student_no || '';
      $('hero-title').textContent = t('welcome', saved.name.split(' ')[0] || '');
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
      if (u) $('hero-title').textContent = t('hello_named', u.first_name || '');
      renderHeroPill();
      showNameCard();
    }
    renderHeroPill();
    setTab(startTab());
    ready();
  }

  /** تب آغازین — از لینک‌های میان‌بر manifest (?tab=status) هم پشتیبانی می‌کند */
  function startTab() {
    try {
      var m = /[?&]tab=([a-z]+)/i.exec(location.search || '');
      if (m && ['send', 'status', 'help'].indexOf(m[1].toLowerCase()) !== -1) {
        return m[1].toLowerCase();
      }
    } catch (e) { /* نادیده */ }
    return 'send';
  }

  /** اپ آماده است → صفحهٔ بارگذاری برداشته شود */
  function ready() {
    window.__appReady = true;
    try {
      var bs = document.getElementById('boot-screen');
      if (bs) {
        bs.classList.add('gone');
        setTimeout(function () { try { bs.remove(); } catch (e) {} }, 500);
      }
    } catch (e) { /* نادیده */ }
    registerSW();
  }

  /** Service Worker فقط برای «نصب‌شدنی» بودن — هیچ کشی نمی‌کند */
  function registerSW() {
    try {
      if (!('serviceWorker' in navigator)) return;
      navigator.serviceWorker.register('sw-tadilat.js', { scope: './' })
        .catch(function (e) { console.warn('SW ثبت نشد (بی‌اهمیت):', e && e.message); });
    } catch (e) { /* نادیده */ }
  }

  /**
   * تلگرام را در پس‌زمینه پیدا می‌کند.
   * اگر telegram.org فیلتر/کند باشد، اسکریپت اصلاً نمی‌رسد — اپ باید
   * بدون آن هم کار کند (فقط بنر «بیرون از تلگرام» نمایش داده می‌شود).
   */
  function initTelegram() {
    var tries = 0;
    function activate(webApp) {
      TG = webApp;
      try {
        TG.ready();
        TG.expand();
        if (TG.setHeaderColor) { try { TG.setHeaderColor('secondary_bg_color'); } catch (e) {} }
        if (TG.disableVerticalSwipes) { try { TG.disableVerticalSwipes(); } catch (e) {} }
      } catch (e) { console.warn('Telegram init', e); }
      // اگر نام را از تلگرام گرفتیم، سرصفحه را تازه کن
      try {
        if (!state.identity) {
          var u = tgUser();
          if (u) {
            $('hero-title').textContent = t('hello_named', u.first_name || '');
            var inp = $('in-name');
            if (inp && !inp.value) {
              inp.value = [u.first_name, u.last_name].filter(Boolean).join(' ');
            }
          }
          renderHeroPill();
        }
      } catch (e) { /* نادیده */ }
    }

    if (TG) { activate(TG); return; }
    var timer = setInterval(function () {
      var w = window.Telegram && window.Telegram.WebApp;
      if (w) {
        clearInterval(timer);
        activate(w);
        return;
      }
      if (window.__TG_SCRIPT_FAILED || ++tries > 40) {   // ~۴ ثانیه
        clearInterval(timer);
        show($('browser-warning'));
      }
    }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
