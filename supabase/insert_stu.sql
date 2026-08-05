-- ============================================================
-- insert_stu.sql  —  درج دانشجویان در جدول profiles
-- ستون‌های موجود: id, name, username, role, email, phone,
--   active, department, university, student_id, field, degree,
--   passport_number, bachelor_field, specialization, created_at
-- بدون ستون password (در این جدول وجود ندارد)
-- ============================================================

-- ── مرحله ۱: RLS — اطمینان از دسترسی ─────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_profiles" ON public.profiles;
CREATE POLICY "allow_all_profiles"
    ON public.profiles FOR ALL
    USING (true)
    WITH CHECK (true);

-- ── مرحله ۲: گروه A — فارغ‌التحصیلی (دفاع+ملزومات کامل) ─
INSERT INTO public.profiles
    (id, name, username, role, email, phone, university, student_id, field, degree, active, created_at)
VALUES
    ('new001','هات محمد صبري صبري',                  'hat.sabri',        'student',NULL,NULL,'جامعه المصطفی','GRAD-N001','حقوق','masters',true,NOW()),
    ('new002','علي صالح ناصر ناصر',                  'ali.nasir',        'student',NULL,NULL,'جامعه المصطفی','GRAD-N002','حقوق','masters',true,NOW()),
    ('new003','مصطفی نجم العبادة',                   'mustafa.alabada',  'student',NULL,NULL,'جامعه المصطفی','GRAD-N003','حقوق','masters',true,NOW()),
    ('new004','ابراهیم عواد کاظم الجعباوي',           'ibrahim.aljabawi', 'student',NULL,NULL,'جامعه المصطفی','GRAD-N004','حقوق','masters',true,NOW()),
    ('new005','سلطان علي یاسر الصافي',               'sultan.alsafi',    'student',NULL,NULL,'جامعه المصطفی','GRAD-N005','حقوق','masters',true,NOW()),
    ('new006','مصطفی منعم صالح صالح',                'mustafa.salih',    'student',NULL,NULL,'جامعه المصطفی','GRAD-N006','حقوق','masters',true,NOW()),
    ('new007','کاظم حمد عزیز الغرابي',               'kazim.alghrabi',   'student',NULL,NULL,'جامعه المصطفی','GRAD-N007','حقوق','masters',true,NOW()),
    ('new008','رامي صادق کریم الربیعي',              'rami.alrabiee',    'student',NULL,NULL,'جامعه المصطفی','GRAD-N008','حقوق','masters',true,NOW()),
    ('new009','علي حمزه جواد العجیلي',               'ali.alajili',      'student',NULL,NULL,'جامعه المصطفی','GRAD-N009','حقوق','masters',true,NOW()),
    ('new010','مسلم علاء حاکم العبودي',              'muslim.alabudi',   'student',NULL,NULL,'جامعه المصطفی','GRAD-N010','حقوق','masters',true,NOW()),
    ('new011','ابتهاج عبدالستار عبدالرحیم عبدالرحیم','ibtihaj.abd',      'student',NULL,NULL,'جامعه المصطفی','GRAD-N011','حقوق','masters',true,NOW()),
    ('new012','غدیر عیسی خلیل خلیل',                'ghadir.khalil',    'student',NULL,NULL,'جامعه المصطفی','GRAD-N012','حقوق','masters',true,NOW()),
    ('new013','نور حیدر خیرالله خیرالله',             'noor.khairallah',  'student',NULL,NULL,'جامعه المصطفی','GRAD-N013','حقوق','masters',true,NOW()),
    ('new014','علي غني حبیب الغزي',                  'ali.alghazi',      'student',NULL,NULL,'جامعه المصطفی','GRAD-N014','حقوق','masters',true,NOW()),
    ('new015','علي احمد مهدي مهدي',                  'ali.mahdi',        'student',NULL,NULL,'جامعه المصطفی','GRAD-N015','حقوق','masters',true,NOW()),
    ('new016','علي محمود عبد عبد',                   'ali.abd',          'student',NULL,NULL,'جامعه المصطفی','GRAD-N016','حقوق','masters',true,NOW()),
    ('new017','عمار جبار کشاش الشرماني',             'ammar.alsharman',  'student',NULL,NULL,'جامعه المصطفی','GRAD-N017','حقوق','masters',true,NOW()),
    ('new018','علی منیر حمزه الجورانی',              'ali.aljurani',     'student',NULL,NULL,'جامعه المصطفی','GRAD-N018','حقوق','masters',true,NOW()),
    ('new019','احمد علی فلاح التمیمي',               'ahmad.altamimi',   'student',NULL,NULL,'جامعه المصطفی','GRAD-N019','حقوق','masters',true,NOW()),
    ('new020','یاسر خضیر عباس التمیمي',              'yaser.altamimi',   'student',NULL,NULL,'جامعه المصطفی','GRAD-N020','حقوق','masters',true,NOW()),
    ('new021','مصطفی جاسم محمد الیاسري',             'mustafa.alyasri',  'student',NULL,NULL,'جامعه المصطفی','GRAD-N021','حقوق','masters',true,NOW()),
    ('new022','عبدالله عبدالمنعم عاجل العمري',       'abdullah.alumri',  'student',NULL,NULL,'جامعه المصطفی','GRAD-N022','حقوق','masters',true,NOW()),
    ('new023','سجاد مصطفی محمد محمد',                'sajjad.muhamad',   'student',NULL,NULL,'جامعه المصطفی','GRAD-N023','حقوق','masters',true,NOW()),
    ('new024','محمد رائد محمود محمود',                'mohammad.mahmud',  'student',NULL,NULL,'جامعه المصطفی','GRAD-N024','حقوق','masters',true,NOW()),
    ('new025','محمد صبار سعید العباسي',              'mohammad.alabbasi','student',NULL,NULL,'جامعه المصطفی','GRAD-N025','حقوق','masters',true,NOW()),
    ('new026','عبدالله صلاح عبید الرماحي',           'abdullah.alrumahi','student',NULL,NULL,'جامعه المصطفی','GRAD-N026','حقوق','masters',true,NOW()),
    ('new027','احمد صائب زید الجنابي',               'ahmad.aljinabi',   'student',NULL,NULL,'جامعه المصطفی','GRAD-N027','حقوق','masters',true,NOW()),
    ('new028','یعقوب محمد یعقوب یعقوب',              'yaqoob.yaqoob',    'student',NULL,NULL,'جامعه المصطفی','GRAD-N028','حقوق','masters',true,NOW()),
    ('new029','فلاح مجیل محمد محمد',                 'falah.muhamad',    'student',NULL,NULL,'جامعه المصطفی','GRAD-N029','حقوق','masters',true,NOW()),
    ('new030','جعفر کریم سلمان سلمان',               'jafar.salman',     'student',NULL,NULL,'جامعه المصطفی','GRAD-N030','حقوق','masters',true,NOW()),
    ('new031','مصطفی احمد محسن الکبیسي',             'mustafa.alkabisi', 'student',NULL,NULL,'جامعه المصطفی','GRAD-N031','حقوق','masters',true,NOW()),
    ('new032','قسور بریر هاشم الورد',                'qasur.alward',     'student',NULL,NULL,'جامعه المصطفی','GRAD-N032','حقوق','masters',true,NOW()),
    ('new033','نور الدین فلاح حسین العود',           'nuruddin.alaud',   'student',NULL,NULL,'جامعه المصطفی','GRAD-N033','حقوق','masters',true,NOW()),
    ('new034','محمد جواد کاظم الشویل',               'mohammad.alshuail','student',NULL,NULL,'جامعه المصطفی','GRAD-N034','حقوق','masters',true,NOW()),
    ('new035','عباس صلال صاحب الشکري',               'abbas.alshakri',   'student',NULL,NULL,'جامعه المصطفی','GRAD-N035','حقوق','masters',true,NOW()),
    ('new036','بلسم کریم حسن حسن',                   'balsam.hasan',     'student',NULL,NULL,'جامعه المصطفی','GRAD-N036','حقوق','masters',true,NOW()),
    ('new037','احمد ماجد خلیف خلیف',                 'ahmad.khalif',     'student',NULL,NULL,'جامعه المصطفی','GRAD-N037','حقوق','masters',true,NOW()),
    ('new038','حیدر مکي محمدرضا الحضیري',            'haider.alhudhiri', 'student',NULL,NULL,'جامعه المصطفی','GRAD-N038','حقوق','masters',true,NOW()),
    ('new039','سجاد علي ثامر الخفاجي',               'sajjad.alkhafaji', 'student',NULL,NULL,'جامعه المصطفی','GRAD-N039','حقوق','masters',true,NOW()),
    ('new040','فاضل رحمن هاتف مرشدي',                'fadhel.murshidi',  'student',NULL,NULL,'جامعه المصطفی','GRAD-N040','حقوق','masters',true,NOW()),
    ('new041','واثق غني عبد الصالحی',                'wathiq.alsalihi',  'student',NULL,NULL,'جامعه المصطفی','GRAD-N041','حقوق','masters',true,NOW()),
    ('new042','حسین عباس فاضل المحمد',               'hussein.almuhammad','student',NULL,NULL,'جامعه المصطفی','GRAD-N042','حقوق','masters',true,NOW()),
    ('new043','جبار حمید حسین بیرماني',              'jabbar.bairumani', 'student',NULL,NULL,'جامعه المصطفی','GRAD-N043','حقوق','masters',true,NOW()),
    ('new044','مالک جبار فشاخ فشاخ',                 'malik.fashakh',    'student',NULL,NULL,'جامعه المصطفی','GRAD-N044','حقوق','masters',true,NOW()),
    ('new045','احمد حرز سکوت ال یاسر',               'ahmad.alyasir',    'student',NULL,NULL,'جامعه المصطفی','GRAD-N045','حقوق','masters',true,NOW()),
    ('new046','اخلاص عبدالامیر سوادي الغالب',        'ikhlас.alghalib',  'student',NULL,NULL,'جامعه المصطفی','GRAD-N046','حقوق','masters',true,NOW()),
    ('new047','حیدر راتب حمید حمید',                 'haider.hamid',     'student',NULL,NULL,'جامعه المصطفی','GRAD-N047','حقوق','masters',true,NOW()),
    ('new048','حیدر احسان عبد علي هيكل',             'haider.haikal',    'student',NULL,NULL,'جامعه المصطفی','GRAD-N048','حقوق','masters',true,NOW()),
    ('new049','احمد شعلان عدوان عدوان',               'ahmad.adwan',      'student',NULL,NULL,'جامعه المصطفی','GRAD-N049','حقوق','masters',true,NOW()),
    ('new050','غزوان فیصل هادي العوادي',             'ghazwan.alawadi',  'student',NULL,NULL,'جامعه المصطفی','GRAD-N050','حقوق','masters',true,NOW()),
    ('new051','حسین ابراهیم علي سواعد',              'hussein.sawaid',   'student',NULL,NULL,'جامعه المصطفی','GRAD-N051','حقوق','masters',true,NOW()),
    ('new052','حیدر طالب عباس عباس',                 'haider.abbas',     'student',NULL,NULL,'جامعه المصطفی','GRAD-N052','حقوق','masters',true,NOW())
ON CONFLICT (id) DO UPDATE SET
    name       = EXCLUDED.name,
    username   = EXCLUDED.username,
    role       = EXCLUDED.role,
    university = EXCLUDED.university,
    student_id = EXCLUDED.student_id,
    field      = EXCLUDED.field,
    degree     = EXCLUDED.degree,
    active     = EXCLUDED.active;

-- ── مرحله ۳: گروه B — گردش دفاع ──────────────────────────
INSERT INTO public.profiles
    (id, name, username, role, email, phone, university, student_id, field, degree, active, created_at)
VALUES
    ('new053','محمد طارق اسماعیل اسماعیل',           'mohammad.ismail',   'student',NULL,NULL,'جامعه المصطفی','DEF-N053','حقوق','masters',true,NOW()),
    ('new054','طیف حیدر نعومي نعومي',                 'tayf.nuaimi',       'student',NULL,NULL,'جامعه المصطفی','DEF-N054','حقوق','masters',true,NOW()),
    ('new055','اسماء حسن کاطع کاطع',                  'asmaa.katii',       'student',NULL,NULL,'جامعه المصطفی','DEF-N055','حقوق','masters',true,NOW()),
    ('new056','مهدي جاسم محمد الساعدي',               'mahdi.alsaadi',     'student',NULL,NULL,'جامعه المصطفی','DEF-N056','حقوق','masters',true,NOW()),
    ('new057','عارف حسیب محمد محمد',                  'aref.muhamad',      'student',NULL,NULL,'جامعه المصطفی','DEF-N057','حقوق','masters',true,NOW()),
    ('new058','فرهاد حسین علی ارکوازي',               'farhad.arkwazi',    'student',NULL,NULL,'جامعه المصطفی','DEF-N058','حقوق','masters',true,NOW()),
    ('new059','ذوالفقار ناصر غافل الفحام',             'dhulfiqar.alfuhum', 'student',NULL,NULL,'جامعه المصطفی','DEF-N059','حقوق','masters',true,NOW()),
    ('new060','محمد عبیس لعیبي النائلي',              'mohammad.alnaili',  'student',NULL,NULL,'جامعه المصطفی','DEF-N060','حقوق','masters',true,NOW()),
    ('new061','مرتضی غسان مجید محسن',                 'mortadha.muhsin',   'student',NULL,NULL,'جامعه المصطفی','DEF-N061','حقوق','masters',true,NOW()),
    ('new062','سیف علي اسود الحسین',                  'saif.alhussein',    'student',NULL,NULL,'جامعه المصطفی','DEF-N062','حقوق','masters',true,NOW()),
    ('new063','حسنین صبري شکر الجبوري',               'husanain.aljuburi', 'student',NULL,NULL,'جامعه المصطفی','DEF-N063','حقوق','masters',true,NOW()),
    ('new064','علي اتیلا اسماعیل الرفاعي',            'ali.alrifai',       'student',NULL,NULL,'جامعه المصطفی','DEF-N064','حقوق','masters',true,NOW()),
    ('new065','رسول محمد کاظم کاظم',                  'rasool.kazim',      'student',NULL,NULL,'جامعه المصطفی','DEF-N065','حقوق','masters',true,NOW()),
    ('new066','محمد حسین حسن الجعباوي',               'mohammad.aljabawi2','student',NULL,NULL,'جامعه المصطفی','DEF-N066','حقوق','masters',true,NOW()),
    ('new067','شفاء حمزة حسین الدحیدحاوي',            'shafaa.alduhaidah', 'student',NULL,NULL,'جامعه المصطفی','DEF-N067','حقوق','masters',true,NOW()),
    ('new068','حسین عبدالکریم عبدالامیر التمیمي',     'hussein.altamimi2', 'student',NULL,NULL,'جامعه المصطفی','DEF-N068','حقوق','masters',true,NOW()),
    ('new069','احمد محمد فلیح المجیلي',               'ahmad.almajili',    'student',NULL,NULL,'جامعه المصطفی','DEF-N069','حقوق','masters',true,NOW()),
    ('new070','ونس کاظم عبید المجبلي',                'wanas.almujabali',  'student',NULL,NULL,'جامعه المصطفی','DEF-N070','حقوق','masters',true,NOW()),
    ('new071','بکر محمود علوان المعموري',             'bakr.almamuri',     'student',NULL,NULL,'جامعه المصطفی','DEF-N071','حقوق','masters',true,NOW())
ON CONFLICT (id) DO UPDATE SET
    name       = EXCLUDED.name,
    username   = EXCLUDED.username,
    role       = EXCLUDED.role,
    university = EXCLUDED.university,
    student_id = EXCLUDED.student_id,
    field      = EXCLUDED.field,
    degree     = EXCLUDED.degree,
    active     = EXCLUDED.active;

-- ── تأیید ─────────────────────────────────────────────────
SELECT id, name, role, student_id
FROM public.profiles
WHERE id LIKE 'new%'
ORDER BY id;
