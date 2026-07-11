// ============================================================
// registration.js  –  Supabase BaaS integration
// جایگزین کامل Django views.py + google_sheets_service.py
// ============================================================

import { supabase } from './supabase-client.js';

// ── ثوابت ──────────────────────────────────────────────────
const BUCKET_NAME = 'student-documents';

// ── کمک‌ها ──────────────────────────────────────────────────
function generateRegistrationId() {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `REG-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function showLoading(msg = 'جاري معالجة الطلب...') {
    const overlay = document.getElementById('loadingOverlay');
    const text    = document.getElementById('loadingText');
    if (overlay) { overlay.classList.add('active'); }
    if (text)    { text.textContent = msg; }
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.remove('active');
}

function showSuccess(msg) {
    const el = document.getElementById('successMessage');
    if (!el) return;
    const textEl = el.querySelector('.message-text');
    if (textEl) textEl.textContent = msg;
    el.classList.add('show');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function showError(msg) {
    const el = document.getElementById('errorMessage');
    if (!el) return;
    const textEl = el.querySelector('.message-text');
    if (textEl) textEl.textContent = msg;
    el.classList.add('show');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hideMessages() {
    document.getElementById('successMessage')?.classList.remove('show');
    document.getElementById('errorMessage')?.classList.remove('show');
}

// ── آپلود فایل به Supabase Storage ─────────────────────────
async function uploadFile(file, registrationId, fieldName) {
    if (!file) return null;

    const ext      = file.name.split('.').pop();
    const filePath = `${registrationId}/${fieldName}.${ext}`;

    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type
        });

    if (error) {
        console.error(`[Storage] خطأ في رفع ${fieldName}:`, error.message);
        throw new Error(`فشل رفع الملف: ${fieldName}`);
    }

    // برگرداندن path (برای دسترسی بعدی با getSignedUrl)
    return data.path;
}

// ── ذخیره رکورد در جدول student_registrations ──────────────
async function saveRegistration(formData, fileUrls, registrationId) {
    const record = {
        registration_id:        registrationId,
        middle_name:            formData.get('middle_name'),
        last_name:              formData.get('last_name'),
        religion:               formData.get('religion'),
        phone:                  formData.get('phone'),
        email:                  formData.get('email'),
        address_iraq:           formData.get('address_iraq'),
        job:                    formData.get('job'),
        marital_status:         formData.get('marital_status'),
        children_count:         formData.get('children_count') ? parseInt(formData.get('children_count')) : null,
        university_type:        formData.get('university_type'),
        degree:                 formData.get('degree'),
        major:                  formData.get('major'),
        previous_university:    formData.get('previous_university'),
        master_university:      formData.get('master_university') || null,
        bachelor_gpa:           formData.get('bachelor_gpa'),
        master_gpa:             formData.get('master_gpa') || null,
        // لینک‌های فایل
        passport_url:           fileUrls.passport            || null,
        personal_photo_url:     fileUrls.personal_photo      || null,
        transcript_url:         fileUrls.transcript          || null,
        master_transcript_url:  fileUrls.master_transcript   || null,
        master_certificate_url: fileUrls.master_certificate  || null,
        status:                 'pending'
    };

    const { data, error } = await supabase
        .from('student_registrations')
        .insert([record])
        .select('id, registration_id')
        .single();

    if (error) {
        console.error('[DB] خطأ في الحفظ:', error.message);
        throw new Error(error.message);
    }

    return data;
}

// ── Handler اصلی فرم ────────────────────────────────────────
async function handleFormSubmit(event) {
    event.preventDefault();
    hideMessages();

    const form       = event.target;
    const formData   = new FormData(form);
    const degree     = formData.get('degree');
    const regId      = generateRegistrationId();

    // استفاده از شماره کامل با کد کشور از intl-tel-input
    if (window.itiPhone) {
        formData.set('phone', window.itiPhone.getNumber());
    }

    // اعتبارسنجی فیلدهای اجباری
    const requiredFields = [
        ['middle_name',         'الاسم الثلاثي'],
        ['last_name',           'لقب العائلة'],
        ['religion',            'الديانة'],
        ['phone',               'رقم الهاتف'],
        ['email',               'البريد الإلكتروني'],
        ['address_iraq',        'العنوان في العراق'],
        ['job',                 'الوظيفة'],
        ['marital_status',      'الحالة الاجتماعية'],
        ['university_type',     'نوع الجامعة'],
        ['degree',              'المقطع الدراسي'],
        ['major',               'التخصص'],
        ['previous_university', 'الجامعة السابقة'],
        ['bachelor_gpa',        'معدل البكالوريوس'],
    ];

    const missing = requiredFields
        .filter(([field]) => !formData.get(field)?.trim())
        .map(([, label]) => label);

    if (degree === 'phd') {
        if (!formData.get('master_gpa')?.trim())        missing.push('معدل الماجستير');
        if (!formData.get('master_university')?.trim()) missing.push('جامعة الماجستير');
    }

    if (missing.length > 0) {
        showError(`الحقول المطلوبة مفقودة: ${missing.join('، ')}`);
        return;
    }

    // اعتبارسنجی فایل‌های اجباری
    const passport       = form.querySelector('input[name="passport"]')?.files[0];
    const personalPhoto  = form.querySelector('input[name="personal_photo"]')?.files[0];
    const transcript     = form.querySelector('input[name="transcript"]')?.files[0];

    if (!passport || !personalPhoto || !transcript) {
        showError('يرجى رفع الملفات المطلوبة: جواز السفر، الصورة الشخصية، كشف درجات البكالوريوس');
        return;
    }

    if (degree === 'phd') {
        const mt  = form.querySelector('input[name="master_transcript"]')?.files[0];
        const mc  = form.querySelector('input[name="master_certificate"]')?.files[0];
        if (!mt || !mc) {
            showError('للدكتوراه: يرجى رفع كشف وشهادة الماجستير');
            return;
        }
    }

    // شروع آپلود
    showLoading('جاري رفع الملفات...');

    try {
        // آپلود موازی فایل‌ها
        const [passportPath, photoPath, transcriptPath] = await Promise.all([
            uploadFile(passport,      regId, 'passport'),
            uploadFile(personalPhoto, regId, 'personal_photo'),
            uploadFile(transcript,    regId, 'transcript'),
        ]);

        let masterTranscriptPath  = null;
        let masterCertificatePath = null;

        if (degree === 'phd') {
            const mt = form.querySelector('input[name="master_transcript"]')?.files[0];
            const mc = form.querySelector('input[name="master_certificate"]')?.files[0];
            [masterTranscriptPath, masterCertificatePath] = await Promise.all([
                uploadFile(mt, regId, 'master_transcript'),
                uploadFile(mc, regId, 'master_certificate'),
            ]);
        }

        showLoading('جاري حفظ البيانات...');

        // ذخیره در دیتابیس
        const saved = await saveRegistration(formData, {
            passport:            passportPath,
            personal_photo:      photoPath,
            transcript:          transcriptPath,
            master_transcript:   masterTranscriptPath,
            master_certificate:  masterCertificatePath,
        }, regId);

        hideLoading();
        form.reset();
        // پاک کردن preview فایل‌ها
        document.querySelectorAll('.file-preview-container').forEach(c => c.innerHTML = '');
        // ریست شماره تلفن
        if (window.itiPhone) window.itiPhone.setNumber('');
        showSuccess(`تم إرسال طلبك بنجاح! رقم التسجيل: ${saved.registration_id}`);

    } catch (err) {
        hideLoading();
        console.error('[Submit] Error:', err);
        showError(err.message || 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.');
    }
}

// ── Initialize هنگام لود صفحه ────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('registrationForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
});
