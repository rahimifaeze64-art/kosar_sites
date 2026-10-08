/* ============================================================
   js/tadilat-app.js — منطق تلگرام «ارسال تعدیلات» (نسخهٔ ۲)

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
  var LS_LANG = 'tadilat_app_lang_v1';

  // ══════════════════════════════════════════════════════════
  // چندزبانه: فارسی + عربی  (هر دو راست‌به‌چپ)
  // ══════════════════════════════════════════════════════════
  var I18N = {
    fa: {
      // سرصفحه
      hero_hello: 'سلام! 👋', hero_pill: 'تعدیلاتت رو بفرست — شرکة الکوثر',
      aria_help: 'راهنما', aria_lang: 'انتخاب زبان', aria_mic: 'اسمت را بگو',
      browser_warn: '💡 بیرون از تلگرام باز شده. کار می‌کند، ولی از دکمهٔ منوی ربات بازش کنی بهتر است.',
      // باکس اسم
      name_title: 'خودت را معرّفی کن', name_sub: 'سه قدم کوتاه تا وصل شدن به پروفایلت',
      mic_hint: '🎤 بزن و اسمت را بگو <b>(الزامی)</b>',
      voice_recording: 'در حال ضبط…', btn_stop: 'تمام', btn_rerecord: 'ضبط دوباره',
      btn_not_my_name: 'اسم من این نیست',
      btn_yes_correct: 'بله، درسته', btn_no_write: 'نه، خودم می‌نویسم',
      tries_left: '{0} تلاش صوتی باقی مانده', tries_none: 'تلاش صوتی تمام شد — اسمت را بنویس',
      resolved_ask: 'اسمت <b>{0}</b> هست، درسته؟',
      resolved_confirmed: '✅ ثبت شد: <b>{0}</b>',
      manual_retry: 'متوجه نشدم. یک‌بار دیگر بزن و اسمت را بگو — یا خودت بنویس.',
      manual_no_tries: 'تعداد تلاش‌های صوتی تمام شد. اسمت را خودت بنویس.',
      toast_confirmed: '✅ اسمت ثبت شد',
      toast_no_tries: 'اسمت را خودت بنویس 🙂',
      // چت
      tab_chat: 'چت',
      chat_title: 'چت با کارشناسان',
      chat_sub: 'سؤالت را بپرس؛ کارشناس مربوطه پاسخ می‌دهد',
      chat_soon: 'این بخش به‌زودی فعال می‌شود — پیام‌هایت همین‌جا ذخیره می‌ماند تا ارسال شوند.',
      chat_empty: 'هنوز پیامی نداری — اولین پیامت را بنویس.',
      chat_ph: 'پیامت را بنویس…',
      chat_send: 'ارسال',
      chat_auto_reply: 'پیامت ثبت شد ✅ به‌محض فعال شدن چت، کارشناس مربوطه پاسخ می‌دهد.',
      picker_hint: 'از فهرست انتخاب کن یا خودت بنویس',
      ph_search: '🔍 جستجوی نام یا شمارهٔ دانشجویی…',
      label_write: 'یا اسمت را خودت بنویس',
      manual_hint: 'اسمت را کامل بنویس تا پیدایت کنیم.',
      manual_voice_or_type: 'اسمت را بگو یا خودت بنویس.',
      stt_busy: '🔎 در حال تشخیص نام…',
      stt_busy_hint: 'چند لحظه صبر کن',
      stt_not_setup: 'سرویس تشخیص گفتار روی سرور تنظیم نشده — اسمت را خودت بنویس.',
      manual_wrong: 'باشد، اسمت را خودت بنویس.',
      manual_no_stt: 'این مرورگر تشخیص گفتار ندارد؛ اسمت را بنویس (یا شمارهٔ دانشجویی را وارد کن).',
      manual_short: 'اسمت را کامل‌تر بگو یا بنویس.',
      manual_unsure: 'اسمت را دقیق پیدا نکردم. کامل بنویس، یا <b>شمارهٔ دانشجویی</b> را وارد کن تا دقیق وصل شویم.',
      manual_ambiguous: 'چند نام شبیه اسمت پیدا شد. <b>شمارهٔ دانشجویی</b> را وارد کن تا دقیق وصل شویم.',
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
      how1_t: 'اسمت را بگو', how1_s: 'با 🎤 اسمت را بگو تا تطبیق داده شود؛ اگر درست تشخیص داده نشد، خودت تایپش کن',
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
      voice_listening: '🎧 به عربی گوش می‌دهم…',
      voice_capturing: '🎤 صدایت را می‌شنوم…',
      // ── جریان شناسایی تازه ──
      step1_label: 'اسمت را بنویس',
      step2_label: 'حالا اسمت را برایمان بخوان',
      step2_hint: 'رفیق، لطفاً روی دکمه بزن و اسمت را بگو —    .',
      step3_label: 'شمارهٔ دانشجویی برای دقت بیشتر',
      step3_hint: 'روی کارت دانشجویی‌ات نوشته شده. اگر نداری، خالی بگذار.',
      btn_rec: 'ضبط ۶ ثانیه‌ای',
      rec_now: 'حالا اسمت را بگو…',
      rec_done: 'ویس ضبط شد ✓',
      rec_again: 'ضبط دوباره',
      rec_denied: 'دسترسی به میکروفن نشد — بدون ویس هم می‌توانی ادامه بدهی.',
      rec_no_support: 'این دستگاه ضبط صدا ندارد — بدون ویس ادامه بده.',
      live_found: '✅ پیدایت کردم: <b>{0}</b>',
      confirm_title: 'آیا تو این شخص هستی؟',
      confirm_hint: 'اگر پروفایلت همین است «بله» را بزن، وگرنه «نه».',
      btn_yes_me: 'بله، من هستم',
      btn_no_me: 'نه، من نیستم',
      notyou_title: 'پس تو کی هستی؟',
      notyou_hint: 'یکی از این دو را انتخاب کن:',
      notyou_new_t: 'دانشجوی جدیدم',
      notyou_new_s: 'تازه آمده‌ام و پروفایل ندارم — ادامه می‌دهم',
      notyou_old_t: 'دانشجوی شماییم',
      notyou_old_s: 'یک‌بار دیگر اسمم را دقیق می‌نویسم و می‌خوانم',
      rewrite_hint: 'اسمت را دقیق‌تر بنویس (نام، نام پدر، نام جد) و بعد برایمان بخوان.',
      rewrite_toast: 'اسمت را کامل‌تر بنویس و دوباره بخوان',
      mic_lang_note: '(تشخیص گفتار روی عربی)',
      voice_heard: '🗣 {0}',
      voice_unsupported: '⚠️ این دستگاه ضبط صدا را پشتیبانی نمی‌کند؛ نامت را تایپ کن.',
      voice_stopped: 'ضبط تمام شد',
      voice_no_stt: '🎤 ویس ضبط شد (این مرورگر تشخیص گفتار ندارد) — اسمت را از فهرست انتخاب کن.',
      voice_saved: '🎤 ویس اسمت ضبط شد و همراه درخواست ذخیره می‌شود.',
      voice_heard_fail: '🎤 نامت را کامل بگو یا خودت بنویس.',
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
      toast_voice_first: '🎤 اسمت را بگو یا خودت بنویس.',
      toast_pick_name: 'اسمت را کامل بنویس 🙂',
      toast_write_name: 'اسمت را کامل بنویس 🙂',
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
      hero_hello: 'مرحباً! 👋', hero_pill: 'أرسل تعديلاتك — شركة الكوثر',
      aria_help: 'مساعدة', aria_lang: 'اختيار اللغة', aria_mic: 'قل اسمك',
      browser_warn: '💡 تم فتحه خارج تلگرام. يعمل، لكن الأفضل فتحه من زر قائمة البوت.',
      name_title: 'عرّفنا بنفسك', name_sub: 'ثلاث خطوات قصيرة للاتصال بملفك',
      mic_hint: '🎤 اضغط وقل اسمك <b>(إلزامي)</b>',
      voice_recording: 'جارٍ التسجيل…', btn_stop: 'تم', btn_rerecord: 'إعادة التسجيل',
      btn_not_my_name: 'ليس اسمي',
      btn_yes_correct: 'نعم، صحيح', btn_no_write: 'لا، سأكتبه بنفسي',
      tries_left: 'بقيت {0} محاولات صوتية', tries_none: 'انتهت المحاولات الصوتية — اكتب اسمك',
      resolved_ask: 'اسمك <b>{0}</b>، صحيح؟',
      resolved_confirmed: '✅ تم التسجيل: <b>{0}</b>',
      manual_retry: 'لم أفهم. اضغط مرة أخرى وقل اسمك — أو اكتبه بنفسك.',
      manual_no_tries: 'انتهت المحاولات الصوتية. اكتب اسمك بنفسك.',
      toast_confirmed: '✅ تم تسجيل اسمك',
      toast_no_tries: 'اكتب اسمك بنفسك 🙂',
      // چت
      tab_chat: 'الدردشة',
      chat_title: 'الدردشة مع المختصين',
      chat_sub: 'اطرح سؤالك؛ سيجيبك المختص المعني',
      chat_soon: 'سيُفعَّل هذا القسم قريباً — تُحفظ رسائلك هنا حتى تُرسَل.',
      chat_empty: 'لا توجد رسائل بعد — اكتب رسالتك الأولى.',
      chat_ph: 'اكتب رسالتك…',
      chat_send: 'إرسال',
      chat_auto_reply: 'تم تسجيل رسالتك ✅ بمجرد تفعيل الدردشة سيجيبك المختص المعني.',
      picker_hint: 'اختر من القائمة أو اكتبه بنفسك',
      ph_search: '🔍 ابحث بالاسم أو برقم الطالب…',
      label_write: 'أو اكتب اسمك بنفسك',
      manual_hint: 'اكتب اسمك كاملاً لنبحث عنك.',
      manual_voice_or_type: 'قل اسمك أو اكتبه بنفسك.',
      stt_busy: '🔎 جارٍ التعرّف على الاسم…',
      stt_busy_hint: 'انتظر لحظة',
      stt_not_setup: 'خدمة التعرّف على الكلام غير مُهيّأة على الخادم — اكتب اسمك بنفسك.',
      manual_wrong: 'حسناً، اكتب اسمك بنفسك.',
      manual_no_stt: 'هذا المتصفح لا يتعرّف على الكلام؛ اكتب اسمك (أو رقم الطالب).',
      manual_short: 'قل اسمك كاملاً أو اكتبه.',
      manual_unsure: 'لم أجد اسمك بدقة. اكتبه كاملاً، أو أدخل <b>رقم الطالب</b> لربطك بدقة.',
      manual_ambiguous: 'وُجدت أسماء متشابهة. أدخل <b>رقم الطالب</b> لربطك بدقة.',
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
      how1_t: 'قل اسمك', how1_s: 'قل اسمك بصوتك 🎤 ليطابَق تلقائياً؛ وإن لم يُتعرَّف عليه بشكل صحيح، اكتبه بنفسك',
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
      voice_listening: '🎧 أستمع بالعربية…',
      voice_capturing: '🎤 أسمع صوتك…',
      // ── جریان شناسایی تازه ──
      step1_label: 'اكتب اسمك',
      step2_label: 'الآن اقرأ اسمك لنا',
      step2_hint: 'يا صديقي، اضغط الزر وقل اسمك — يُسجَّل ٦ ثوانٍ.',
      step3_label: 'رقم الطالب لدقة أكبر',
      step3_hint: 'مكتوب على بطاقة الطالب. إن لم تكن لديك، اتركه فارغاً.',
      btn_rec: 'تسجيل ٦ ثوانٍ',
      rec_now: 'الآن قل اسمك…',
      rec_done: 'تم تسجيل الصوت ✓',
      rec_again: 'إعادة التسجيل',
      rec_denied: 'لم يتم الوصول إلى الميكروفون — يمكنك المتابعة بدون صوت.',
      rec_no_support: 'هذا الجهاز لا يدعم التسجيل — تابع بدون صوت.',
      live_found: '✅ وجدتك: <b>{0}</b>',
      confirm_title: 'هل أنت هذا الشخص؟',
      confirm_hint: 'إن كان ملفك هو هذا فاضغط «نعم»، وإلا «لا».',
      btn_yes_me: 'نعم، أنا هو',
      btn_no_me: 'لا، لست أنا',
      notyou_title: 'إذن من أنت؟',
      notyou_hint: 'اختر أحدهما:',
      notyou_new_t: 'أنا طالب جديد',
      notyou_new_s: 'جديد ولا أملك ملفاً — سأتابع',
      notyou_old_t: 'أنا من طلابكم',
      notyou_old_s: 'سأكتب اسمي بدقة مرة أخرى وأقرأه',
      rewrite_hint: 'اكتب اسمك بدقة أكثر (الاسم، اسم الأب، اسم الجد) ثم اقرأه لنا.',
      rewrite_toast: 'اكتب اسمك كاملاً وأعد القراءة',
      mic_lang_note: '(التعرّف على الكلام بالعربية)',
      voice_heard: '🗣 {0}',
      voice_unsupported: '⚠️ هذا الجهاز لا يدعم التسجيل؛ اكتب اسمك.',
      voice_stopped: 'انتهى التسجيل',
      voice_no_stt: '🎤 سُجّل الصوت (هذا المتصفح لا يتعرّف على الكلام) — اختر اسمك من القائمة.',
      voice_saved: '🎤 تم تسجيل صوتك وسيُرفَق بالطلب.',
      voice_heard_fail: '🎤 قل اسمك كاملاً أو اكتبه بنفسك.',
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
      toast_voice_first: '🎤 قل اسمك أو اكتبه بنفسك.',
      toast_pick_name: 'اكتب اسمك كاملاً 🙂',
      toast_write_name: 'اكتب اسمك كاملاً 🙂',
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
      if (/^(fa|pe|per)/i.test(nav)) return 'fa';
    } catch (e) { /* نادیده */ }
    // همهٔ دانشجوها عرب‌زبان‌اند → پیش‌فرض عربی
    return 'ar';
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

  /**
   * فهرست دانشجوها فقط برای «تطبیق» در حافظهٔ همین صفحه نگه داشته می‌شود
   * و هیچ‌وقت به دانشجو نمایش داده نمی‌شود و در sessionStorage هم ذخیره
   * نمی‌شود (تا در ابزار توسعه‌دهنده قابل دیدن نباشد).
   */
  function loadStudents() {
    if (studentsCache) return Promise.resolve(studentsCache);
    return sbRest('GET', 'profiles?select=id,name,student_id&role=eq.student&limit=5000')
      .then(function (rows) {
        studentsCache = (rows || []).map(function (r) {
          return { id: r.id, name: r.name || '', key: normKey(r.name),
                   student_id: String(r.student_id || '').trim() };
        });
        return studentsCache;
      });
  }

  // ══════════════════════════════════════════════════════════
  // تطبیق نام — کلمه‌به‌کلمه روی ۳ کلمهٔ اول
  //
  // چرا؟ ۹۱٪ دانشجویان نام ۴ کلمه‌ای دارند (نام، نام پدر، نام جد، فامیل).
  // دانشجو معمولاً «۳ کلمهٔ اول» را می‌گوید؛ روش قبلی که کل رشته را
  // حرف‌به‌حرف مقایسه می‌کرد، این حالت را رد می‌کرد و در عوض نام‌های
  // نادرست را قبول می‌کرد. (آزمون روی ۳۵۱ دانشجوی واقعی: از ۲۲٪ به ۹۵٪)
  // ══════════════════════════════════════════════════════════
  var MATCH_FIRST_N = 3;      // فقط ۳ کلمهٔ اول مبناست
  var MATCH_ACCEPT  = 0.80;   // حد قبول
  var MATCH_MARGIN  = 0.06;   // باید از نفر دوم این‌قدر جلوتر باشد

  function nameTokens(v) {
    return normName(v).split(' ').filter(function (w) { return !!w; });
  }

  /** «ال» ابتدای فامیل نادیده گرفته می‌شود: المجبلي = مجبلي */
  function stripAl(w) {
    return (w.length > 4 && w.indexOf('ال') === 0) ? w.slice(2) : w;
  }

  /** شباهت دو کلمه (۰ تا ۱) با تحمل غلط‌های تشخیص گفتار */
  function tokSim(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (stripAl(a) === stripAl(b)) return 0.94;
    if (a.replace(/\s/g, '') === b || b.replace(/\s/g, '') === a) return 0.93;
    if (a.indexOf(b) !== -1 || b.indexOf(a) !== -1) {
      return 0.80 * (Math.min(a.length, b.length) / Math.max(a.length, b.length)) + 0.14;
    }
    return 2 * lcs(a, b) / (a.length + b.length);
  }

  /** امتیاز یک دانشجو در برابر نامِ گفته/نوشته‌شده */
  function nameScore(studentName, heard) {
    var rt = nameTokens(studentName);
    var ht = nameTokens(heard);
    if (!rt.length || !ht.length) return 0;
    var basis = rt.slice(0, MATCH_FIRST_N);
    var total = 0, j = 0;
    for (var x = 0; x < ht.length; x++) {
      var best = 0, besti = -1;
      for (var i = j; i < basis.length; i++) {
        var s = tokSim(basis[i], ht[x]);
        if (s > best) { best = s; besti = i; }
      }
      if (besti >= 0) j = besti + 1;   // ترتیب کلمات حفظ شود
      total += best;
    }
    var coverage = total / ht.length;    // چقدر از گفتهٔ دانشجو پوشش داده شد
    var precision = total / basis.length; // چقدر از نام کامل پوشش داده شد
    return coverage * 0.75 + precision * 0.25;
  }

  /**
   * بهترین تطبیق در میان دانشجوها.
   * خروجی: { row, score, second, reason }
   *   reason: 'short' | 'ambiguous' | 'weak' | 'ok'
   */
  function pickBestStudent(nameOrText) {
    var key = normKey(nameOrText);
    if (!key || key.length < 3) {
      return Promise.resolve({ row: null, score: 0, second: 0, reason: 'short' });
    }
    return loadStudents().then(function (rows) {
      var best = { row: null, score: 0 }, second = 0;
      for (var i = 0; i < rows.length; i++) {
        if (!rows[i].name) continue;
        var s = nameScore(rows[i].name, nameOrText);
        if (s > best.score) {
          second = best.score;
          best = { row: rows[i], score: s };
        } else if (s > second) {
          second = s;
        }
      }
      var reason = 'ok';
      if (!best.row) reason = 'weak';
      else if (best.score < MATCH_ACCEPT) reason = 'weak';
      else if ((best.score - second) < MATCH_MARGIN) reason = 'ambiguous';
      return { row: best.row, score: best.score, second: second, reason: reason };
    });
  }

  /** آیا این تطبیق به‌قدر کافی مطمئن است؟ */
  function isConfident(m) {
    return !!(m && m.row && m.reason === 'ok');
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

      var namePart = digits.replace(/\d+/g, ' ').trim();
      if (!normKey(namePart) || normKey(namePart).length < 4) {
        return { student_id: null, name: null, student_no: studentNo, reason: 'short' };
      }
      // همان الگوریتم دقیقِ صدا، برای نامِ نوشتاری هم
      return pickBestStudent(namePart).then(function (res) {
        if (isConfident(res)) {
          return { student_id: res.row.id, name: res.row.name,
                   student_no: studentNo || res.row.student_id || null, reason: 'ok' };
        }
        return { student_id: null, name: null, student_no: studentNo,
                 reason: res.reason, guess: res.row ? res.row.name : null };
      });
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
    writer: null,             // {agent_id, agent_name, order_id} — نویسندهٔ مربوطه
    candidate: null,          // {id, name, student_no} — دانشجوی تطبیق‌داده‌شده (زنده)
    candidateDefinitive: false, // از شمارهٔ دانشجویی آمده (قطعی)
    pending: null,            // در انتظار تأیید «آیا تو X هستی؟»
    voiceSkipped: false       // میکروفن نبود → بدون ویس ادامه بده
  };

  // ── تب‌ها: ارسال / وضعیت / چت ─────────────────────────────
  function setTab(name) {
    state.tab = name;
    ['send', 'status', 'chat'].forEach(function (t) {
      var view = $('view-' + t);
      if (view) { if (t === name) show(view); else hide(view); }
      var tab = $('tab-' + t);
      if (tab) tab.classList.toggle('tab-active', t === name);
    });
    updateSubmitBar();
    if (name === 'status') loadStatus();
    if (name === 'chat') renderChat();
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
  // ══════════════════════════════════════════════════════════
  // باکس ۱ — شناسایی دانشجو
  //
  // جریان:
  //   ۱) نامش را می‌نویسد → تطبیق زنده با profiles (سه کلمهٔ اول)
  //   ۲) نامش را می‌خواند → ضبط ۶ ثانیه‌ای (فقط برای گوش دادن نویسنده)
  //   ۳) شمارهٔ دانشجویی (اختیاری، برای دقت بیشتر)
  //   ۴) ۲ ثانیه بعد از آماده شدن نام+ویس → «آیا تو X هستی؟»
  //        بله → ادامه
  //        نه → «دانشجوی جدیدم» یا «دانشجوی شمایم → دوباره بنویس و بخوان»
  //
  // ⚠️ هیچ تشخیص گفتاری‌ای وجود ندارد. ضبط فقط برای این است که
  //    نویسنده/کارشناس صدای دانشجو را بشنود و مطمئن شود.
  // ══════════════════════════════════════════════════════════
  var REC_SECONDS = 6;          // مدت ضبط ویس نام
  var CONFIRM_DELAY = 2000;     // ۲ ثانیه بعد از آماده شدن، سؤال تأیید
  var MATCH_DEBOUNCE = 200;     // جستجوی سریع بعد از تایپ

  var mediaRecorder = null, mediaStream = null, chunks = [];
  var recTimer = null, recLeft = 0;
  var confirmTimer = null, matchTimer = null, askingTimer = null;

  /** طول بلندترین زیررشتهٔ مشترک (برای شباهت حرفی) */
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

  // ══════════════════════════════════════════════════════════
  // قدم ۲ — ضبط ۶ ثانیه‌ای ویس نام
  // ══════════════════════════════════════════════════════════
  function setRecFill(pct) {
    var f = $('rec-fill');
    if (f) f.style.width = Math.max(0, Math.min(100, pct)) + '%';
  }

  function startRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast(t('rec_no_support'));
      state.voiceSkipped = true;
      maybeAskConfirm();
      return;
    }
    clearVoice();
    hide($('rec-done'));
    show($('rec-live'));
    $('btn-rec').disabled = true;
    $('btn-rec').classList.add('recording');
    setRecFill(0);
    recLeft = REC_SECONDS;
    if ($('rec-count')) $('rec-count').textContent = fa(recLeft);

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(function (stream) {
        mediaStream = stream;
        chunks = [];
        var types = ['audio/webm;codecs=opus', 'audio/webm',
                     'audio/ogg;codecs=opus', 'audio/mp4', ''];
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
        mediaRecorder.ondataavailable = function (e) {
          if (e.data && e.data.size) chunks.push(e.data);
        };
        mediaRecorder.onstop = onRecDone;
        mediaRecorder.start();

        recTimer = setInterval(function () {
          recLeft--;
          if ($('rec-count')) $('rec-count').textContent = fa(Math.max(0, recLeft));
          setRecFill((REC_SECONDS - recLeft) / REC_SECONDS * 100);
          if (recLeft <= 0) stopRecording();
        }, 1000);
      })
      .catch(function (e) {
        console.warn('mic error', e);
        clearInterval(recTimer); recTimer = null;
        hide($('rec-live'));
        $('btn-rec').disabled = false;
        $('btn-rec').classList.remove('recording');
        toast(t('rec_denied'));
        // بدون میکروفن هم می‌تواند ادامه دهد
        state.voiceSkipped = true;
        maybeAskConfirm();
      });
  }

  function stopRecording() {
    clearInterval(recTimer);
    recTimer = null;
    var b = $('btn-rec');
    if (b) { b.classList.remove('recording'); b.disabled = false; }
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.stop(); } catch (e) { onRecDone(); }
    } else {
      onRecDone();
    }
  }

  function onRecDone() {
    if (mediaStream) {
      try { mediaStream.getTracks().forEach(function (tr) { tr.stop(); }); } catch (e) {}
      mediaStream = null;
    }
    hide($('rec-live'));
    var b = $('btn-rec');
    if (b) { b.classList.remove('recording'); b.disabled = false; }

    if (chunks.length) {
      state.voiceBlob = new Blob(chunks, { type: chunks[0].type || 'audio/webm' });
      if (state.voiceUrl) URL.revokeObjectURL(state.voiceUrl);
      state.voiceUrl = URL.createObjectURL(state.voiceBlob);
      var a = $('rec-audio');
      if (a) a.src = state.voiceUrl;
      show($('rec-done'));
      haptic.ok();
    }
    maybeAskConfirm();
  }

  function clearVoice() {
    if (state.voiceUrl) URL.revokeObjectURL(state.voiceUrl);
    state.voiceBlob = null;
    state.voiceUrl = null;
    state.voiceSkipped = false;
    hide($('rec-done'));
    hide($('rec-live'));
    var a = $('rec-audio');
    if (a) a.src = '';
    setRecFill(0);
  }

  // ══════════════════════════════════════════════════════════
  // تطبیق زندهٔ نام با پروفایل دانشجوها
  // الگوریتم: «سه کلمهٔ اول» (بیشتر دانشجوها چهار اسم دارند)
  // ══════════════════════════════════════════════════════════
  function scheduleLiveMatch() {
    clearTimeout(matchTimer);
    matchTimer = setTimeout(runLiveMatch, MATCH_DEBOUNCE);
  }

  function runLiveMatch() {
    var typed = normName($('in-name') ? $('in-name').value : '');
    var no = toEnDigits($('in-no') ? $('in-no').value : '').trim();

    // ۱) شمارهٔ دانشجویی، قطعی‌ترین راه است
    if (no && no.replace(/[^0-9A-Za-z]/g, '').length >= 4) {
      matchStudent(no).then(function (res) {
        if (res && res.student_id) {
          setCandidate({ id: res.student_id, name: res.name, student_no: no }, true);
        } else {
          matchByTypedName(typed);
        }
      });
      return;
    }
    matchByTypedName(typed);
  }

  function matchByTypedName(typed) {
    if (!typed || normKey(typed).length < 3) { setCandidate(null); return; }
    if (normKey(typed).length < 5) { setCandidate(null); return; }
    pickBestStudent(typed).then(function (res) {
      if (isConfident(res)) {
        setCandidate({
          id: res.row.id, name: res.row.name, student_no: res.row.student_id,
        }, false);
      } else {
        setCandidate(null);
      }
    });
  }

  function setCandidate(c, definitive) {
    state.candidate = c;
    state.candidateDefinitive = !!definitive;
    renderLiveMatch();
    maybeAskConfirm();
  }

  /** نشانگر کوچک زیر فیلد: «✓ پیدایت کردم: …» */
  function renderLiveMatch() {
    var box = $('identity-result');
    if (!box) return;
    if (!state.candidate) { hide(box); return; }
    box.className = 'match-box match-ok';
    box.innerHTML = t('live_found', esc(state.candidate.name));
    show(box);
  }

  // ══════════════════════════════════════════════════════════
  // سؤال تأیید: «آیا تو X هستی؟»
  // وقتی نام + ویس آماده شد، ۲ ثانیه بعد پرسیده می‌شود.
  // ══════════════════════════════════════════════════════════
  function maybeAskConfirm() {
    clearTimeout(confirmTimer);
    if (!state.candidate) return;
    if (state.identity) return;                       // قبلاً شناسایی شده
    if (!state.voiceBlob && !state.voiceSkipped) return;
    if ($('card-confirm') && !$('card-confirm').classList.contains('hidden')) return;

    confirmTimer = setTimeout(function () {
      if (!state.candidate || state.identity) return;
      if (!state.voiceBlob && !state.voiceSkipped) return;
      askConfirm(state.candidate);
    }, CONFIRM_DELAY);
  }

  function askConfirm(cand) {
    state.pending = cand;
    var el = $('confirm-name');
    if (el) el.textContent = cand.name;
    hide($('card-name'));
    hide($('card-notyou'));
    show($('card-confirm'));
    haptic.ok();
  }

  /** «بله، من هستم» */
  function confirmYes() {
    var c = state.pending || state.candidate;
    if (!c) { backToName(); return; }
    var no = toEnDigits($('in-no') ? $('in-no').value : '').trim();
    state.identity = {
      name: c.name,
      student_no: c.student_no || no || null,
      student_id: c.id || null,
      matched_name: c.name,
    };
    saveIdentity(state.identity);
    hide($('card-confirm'));
    $('hero-title').textContent = t('welcome', c.name.split(' ')[0] || '');
    renderHeroPill();
    haptic.ok();
    if (state.identity.student_id) {
      resolveWriter(state.identity.student_id, c.name).then(function (w) {
        state.writer = w;
        renderWhoChip();
      });
    }
    revealForm();
  }

  /** «نه، من نیستم» → دانشجوی جدید یا شماییم؟ */
  function confirmNo() {
    state.pending = null;
    hide($('card-confirm'));
    show($('card-notyou'));
  }

  /** «دانشجوی جدیدم» → با همان نام نوشته‌شده ادامه بده (پروفایلی وصل نمی‌شود) */
  function notYouNew() {
    var typed = normName($('in-name') ? $('in-name').value : '');
    var no = toEnDigits($('in-no') ? $('in-no').value : '').trim();
    state.identity = {
      name: typed || '—',
      student_no: no || null,
      student_id: null,
      matched_name: null,
      is_new: true,
    };
    saveIdentity(state.identity);
    hide($('card-notyou'));
    hide($('card-confirm'));
    $('hero-title').textContent = t('welcome', (typed || '').split(' ')[0] || '');
    renderHeroPill();
    haptic.tap();
    revealForm();
  }

  /** «دانشجوی شماییم» → پاک کن و دوباره بنویس و بخوان */
  function notYouExisting() {
    hide($('card-notyou'));
    hide($('card-confirm'));
    state.candidate = null;
    state.pending = null;
    clearVoice();
    setRecFill(0);
    if ($('in-name')) $('in-name').value = '';
    if ($('in-no')) $('in-no').value = '';
    var box = $('identity-result');
    if (box) {
      box.className = 'match-box match-warn';
      box.innerHTML = esc(t('rewrite_hint'));
      show(box);
    }
    show($('card-name'));
    toast(t('rewrite_toast'));
    try { $('in-name').focus(); } catch (e) {}
  }

  function backToName() {
    hide($('card-confirm'));
    hide($('card-notyou'));
    show($('card-name'));
  }

  // ══════════════════════════════════════════════════════════
  // هویت — ذخیره و بازیابی
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
    hide($('card-confirm'));
    hide($('card-notyou'));
    hide($('identity-result'));
    state.candidate = null;
    state.pending = null;
    state.voiceSkipped = false;
    clearVoice();
    updateSubmitBar();
  }

  function renderWhoChip() {
    var id = state.identity || {};
    var linked = !!id.student_id;
    $('who-chip').innerHTML =
      '<span>👤</span><b>' + esc(id.name || '—') + '</b>' +
      (linked ? '<span style="color:#13774f">' + esc(t('who_linked')) + '</span>'
              : '<span style="color:#8a5600">' + esc(t('who_unlinked')) + '</span>') +
      (state.writer ? '<span>✍️ ' + esc(state.writer.agent_name) + '</span>' : '') +
      '<button class="link-btn" data-edit-id="1" type="button">' + esc(t('who_edit')) + '</button>';
  }

  /**
   * دکمهٔ «ادامه».
   * اگر تطبیقی داشتیم → سؤال تأیید؛ وگرنه با نام نوشته‌شده ادامه بده
   * (کارشناسان بعداً به پروفایل وصلش می‌کنند).
   */
  function doIdentity() {
    var typed = normName($('in-name') ? $('in-name').value : '');
    if (!typed || typed.length < 3) {
      toast(t('toast_write_name'));
      try { $('in-name').focus(); } catch (e) {}
      return;
    }
    // ۱) اگر در profiles پیدا شد → سؤال تأیید «آیا تو X هستی؟»
    if (state.candidate) { askConfirm(state.candidate); return; }

    // ۲) پیدا نشد → قبل از ادامه معلوم کن دانشجوی جدید است یا قدیمی
    state.pending = null;
    hide($('card-name'));
    hide($('card-confirm'));
    show($('card-notyou'));
  }

  function revealForm() {
    hide($('card-name'));
    hide($('card-confirm'));
    hide($('card-notyou'));
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
      avatar.textContent = name ? name.trim().charAt(0) : (u && u.first_name ? u.first_name.charAt(0) : '؟');
    }
    if (!pill) return;
    var bits = [];
    if (u && u.username) bits.push('@' + u.username);
    if (state.identity && state.identity.student_id) bits.push(t('pill_linked'));
    else if (state.identity && state.identity.student_no) bits.push(t('pill_no', fa(state.identity.student_no)));
    pill.textContent = bits.length ? bits.join(' · ') : t('hero_pill');
  }

  function editIdentity() {
    if ($('in-name')) $('in-name').value = state.identity ? state.identity.name : '';
    if ($('in-no')) $('in-no').value = state.identity ? (state.identity.student_no || '') : '';
    state.identity = null;
    state.writer = null;
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

  // ══════════════════════════════════════════════════════════
  // چت با کارشناسان — فعلاً فقط فرانت‌اند
  //
  // پیام‌ها در localStorage همان دستگاه ذخیره می‌شوند تا وقتی
  // بک‌اند چت (اتصال به کارمندان) آماده شد، همین‌جا ارسال شوند.
  // ⚠️ هیچ پیامی واقعاً فرستاده نمی‌شود — این عمدی است.
  // ══════════════════════════════════════════════════════════
  var LS_CHAT = 'tadilat_app_chat_v1';

  function chatKey() {
    var id = state.identity || {};
    return (id.student_id || id.student_no || id.name || 'anon');
  }

  function loadChat() {
    try {
      var raw = localStorage.getItem(LS_CHAT);
      if (!raw) return [];
      var all = JSON.parse(raw);
      return all[chatKey()] || [];
    } catch (e) { return []; }
  }

  function saveChat(list) {
    try {
      var raw = localStorage.getItem(LS_CHAT);
      var all = raw ? JSON.parse(raw) : {};
      all[chatKey()] = list.slice(-80);   // حداکثر ۸۰ پیام
      localStorage.setItem(LS_CHAT, JSON.stringify(all));
    } catch (e) { /* حافظه پر */ }
  }

  function chatTime(ts) {
    try {
      var p = jalaliParts(new Date(ts).toISOString());
      if (currentLang !== 'ar' && p) return fa(p.jd) + ' ' + MONTHS[p.jm - 1];
      return new Date(ts).toLocaleDateString('ar-EG');
    } catch (e) { return ''; }
  }

  function renderChat() {
    var list = $('chat-list');
    if (!list) return;
    var msgs = loadChat();
    var empty = $('chat-empty');
    if (!msgs.length) {
      list.innerHTML = '';
      if (empty) show(empty);
      return;
    }
    if (empty) hide(empty);
    list.innerHTML = msgs.map(function (m) {
      var mine = m.from === 'me';
      return '<div class="chat-row ' + (mine ? 'me' : 'them') + '">' +
        '<div class="chat-bubble">' + esc(m.text) + '</div>' +
        '<div class="chat-time">' + esc(chatTime(m.at)) + '</div></div>';
    }).join('');
    // آخرین پیام دیده شود
    try { list.scrollTop = list.scrollHeight; } catch (e) { /* نادیده */ }
  }

  function sendChat() {
    var input = $('chat-input');
    if (!input) return;
    var text = String(input.value || '').trim();
    if (!text) return;
    var msgs = loadChat();
    msgs.push({ from: 'me', text: text, at: Date.now() });
    msgs.push({ from: 'them', text: t('chat_auto_reply'), at: Date.now() + 1 });
    saveChat(msgs);
    input.value = '';
    renderChat();
    haptic.tap();
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
    ['send', 'status', 'chat'].forEach(function (t) {
      on($('tab-' + t), 'click', function () { setTab(t); });
    });
    // ── قدم ۲: ضبط ۶ ثانیه‌ای ویس نام ──
    //    ⚠️ این ضبط فقط «نشانهٔ صدا» است تا نویسنده بشنود.
    //    هیچ تشخیص گفتاری‌ای انجام نمی‌شود.
    on($('btn-rec'), 'click', startRecording);
    on($('btn-rec-again'), 'click', startRecording);

    // ── سه قدم شناسایی: تطبیق زنده با هر تغییر ──
    on($('in-name'), 'input', function () {
      state.candidate = null;
      hide($('identity-result'));
      scheduleLiveMatch();
    });
    on($('in-no'), 'input', scheduleLiveMatch);

    // ── سؤال تأیید: «آیا تو X هستی؟» ──
    on($('btn-confirm-yes'), 'click', confirmYes);
    on($('btn-confirm-no'), 'click', confirmNo);
    // ── دانشجوی جدید یا قدیمی ──
    on($('btn-new-student'), 'click', notYouNew);
    on($('btn-existing-student'), 'click', notYouExisting);


    // ── تب چت ──
    on($('chat-send'), 'click', sendChat);
    on($('chat-input'), 'keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); sendChat(); }
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

  /** Service Worker: کش دارایی‌ها تا لود بعدی فوری باشد */
  function registerSW() {
    try {
      if (!('serviceWorker' in navigator)) return;
      navigator.serviceWorker.register('sw-tadilat.js', { scope: './' })
        .catch(function (e) { console.warn('SW ثبت نشد (بی‌اهمیت):', e && e.message); });
    } catch (e) { /* نادیده */ }
  }

  // ⚠️ همین ابتدا ثبت می‌شود (نه در ready) تا حتی اگر boot خطا داد،
  //    کش از کار نیفتد و دیدار بعدی سریع باشد.
  registerSW();

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
        /* بنر «بیرون از تلگرام» حذف شد */
      }
    }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
