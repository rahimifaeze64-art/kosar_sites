-- ============================================================
-- add_new_document_fields.sql
-- اضافه کردن فیلدهای جدید مدارک به جدول student_documents
-- ایمن برای اجرای مجدد (IF NOT EXISTS)
-- اجرا در: Supabase Dashboard → SQL Editor
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- فیلدهای جدید که در کد JS اضافه شدند ولی در جدول وجود ندارند
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.student_documents
    ADD COLUMN IF NOT EXISTS irandoc_resale   TEXT,  -- ایران داک رساله
    ADD COLUMN IF NOT EXISTS onvan_doc        TEXT,  -- عنوان پایان‌نامه
    ADD COLUMN IF NOT EXISTS onvan_result     TEXT,  -- نتیجه تایید عنوان
    ADD COLUMN IF NOT EXISTS savorg_form      TEXT,  -- برگه ثبت‌نام سائورگ
    ADD COLUMN IF NOT EXISTS mahzar_doc       TEXT,  -- محضر
    ADD COLUMN IF NOT EXISTS asalat_doc       TEXT,  -- اصالت
    ADD COLUMN IF NOT EXISTS tadil_doc        TEXT,  -- تعدیل
    ADD COLUMN IF NOT EXISTS tanzil_doc       TEXT,  -- تنزیل نمره گردش
    ADD COLUMN IF NOT EXISTS hatami_doc       TEXT,  -- حاتمی
    ADD COLUMN IF NOT EXISTS khatm_tajlid     TEXT,  -- ختم تجلید
    ADD COLUMN IF NOT EXISTS tarjome_ismaili  TEXT,  -- ترجمه به اسماعیلی
    ADD COLUMN IF NOT EXISTS ersal_doc        TEXT,  -- ارسال
    ADD COLUMN IF NOT EXISTS gardesh_doc      TEXT,  -- گردش
    ADD COLUMN IF NOT EXISTS dadgar_doc       TEXT,  -- دادگر
    ADD COLUMN IF NOT EXISTS sefaresh_tajlid  TEXT,  -- سفارش تجلید
    ADD COLUMN IF NOT EXISTS mohr_daneshgah   TEXT,  -- مهر دانشگاه
    ADD COLUMN IF NOT EXISTS mohr_sefarat     TEXT,  -- مهر سفارت
    ADD COLUMN IF NOT EXISTS qatei_doc        TEXT,  -- قطعی
    ADD COLUMN IF NOT EXISTS amr_edari        TEXT,  -- امر اداری
    ADD COLUMN IF NOT EXISTS molakhas_doc     TEXT,  -- ملخص
    ADD COLUMN IF NOT EXISTS alaqe_doc        TEXT,  -- علاقه (لجنه)
    ADD COLUMN IF NOT EXISTS lajna_doc        TEXT,  -- لجنه
    ADD COLUMN IF NOT EXISTS ostad_lajna      TEXT,  -- استاد (لجنه)
    ADD COLUMN IF NOT EXISTS tadilat_doc      TEXT,  -- تعدیلات
    ADD COLUMN IF NOT EXISTS tahvil_doc       TEXT;  -- تحویل

-- ════════════════════════════════════════════════════════════
-- کامنت‌گذاری برای مستندسازی
-- ════════════════════════════════════════════════════════════
COMMENT ON COLUMN public.student_documents.irandoc_resale   IS 'ایران داک رساله';
COMMENT ON COLUMN public.student_documents.onvan_doc        IS 'عنوان پایان‌نامه';
COMMENT ON COLUMN public.student_documents.onvan_result     IS 'نتیجه تایید عنوان';
COMMENT ON COLUMN public.student_documents.savorg_form      IS 'برگه ثبت‌نام سائورگ';
COMMENT ON COLUMN public.student_documents.mahzar_doc       IS 'محضر';
COMMENT ON COLUMN public.student_documents.asalat_doc       IS 'اصالت';
COMMENT ON COLUMN public.student_documents.tadil_doc        IS 'تعدیل';
COMMENT ON COLUMN public.student_documents.tanzil_doc       IS 'تنزیل نمره گردش';
COMMENT ON COLUMN public.student_documents.hatami_doc       IS 'حاتمی';
COMMENT ON COLUMN public.student_documents.khatm_tajlid     IS 'ختم تجلید';
COMMENT ON COLUMN public.student_documents.tarjome_ismaili  IS 'ترجمه به اسماعیلی';
COMMENT ON COLUMN public.student_documents.ersal_doc        IS 'ارسال';
COMMENT ON COLUMN public.student_documents.gardesh_doc      IS 'گردش';
COMMENT ON COLUMN public.student_documents.dadgar_doc       IS 'دادگر';
COMMENT ON COLUMN public.student_documents.sefaresh_tajlid  IS 'سفارش تجلید';
COMMENT ON COLUMN public.student_documents.mohr_daneshgah   IS 'مهر دانشگاه';
COMMENT ON COLUMN public.student_documents.mohr_sefarat     IS 'مهر سفارت';
COMMENT ON COLUMN public.student_documents.qatei_doc        IS 'قطعی';
COMMENT ON COLUMN public.student_documents.amr_edari        IS 'امر اداری';
COMMENT ON COLUMN public.student_documents.molakhas_doc     IS 'ملخص پایان‌نامه';
COMMENT ON COLUMN public.student_documents.alaqe_doc        IS 'علاقه / لجنه';
COMMENT ON COLUMN public.student_documents.lajna_doc        IS 'لجنه';
COMMENT ON COLUMN public.student_documents.ostad_lajna      IS 'استاد لجنه';
COMMENT ON COLUMN public.student_documents.tadilat_doc      IS 'تعدیلات';
COMMENT ON COLUMN public.student_documents.tahvil_doc       IS 'تحویل';

-- ════════════════════════════════════════════════════════════
-- تأیید — نمایش همه ستون‌های جدول student_documents
-- ════════════════════════════════════════════════════════════
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'student_documents'
ORDER BY ordinal_position;
