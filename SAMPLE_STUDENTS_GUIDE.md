# راهنمای ماژول دانشجویان نمونه

## معرفی
ماژول `SampleStudentsData` شامل 10 دانشجوی نمونه با اسامی عراقی و رشته‌های حقوقی است که برای تست و نمایش سیستم استفاده می‌شود.

## فایل
- **مسیر**: `js/sample-students.js`
- **نام ماژول**: `SampleStudentsData`

## رشته‌های تحصیلی
همه دانشجویان در یکی از رشته‌های زیر تحصیل می‌کنند:
- حقوق عمومی
- حقوق خصوصی
- حقوق بین‌الملل
- حقوق جنایی

## دانشگاه‌ها
- دانشگاه قم
- جامعه المصطفی
- دانشگاه کربلا
- دانشگاه بغداد
- دانشگاه نجف

## مقاطع تحصیلی
- کارشناسی
- کارشناسی ارشد
- دکتری

## لیست دانشجویان نمونه

### 1. حسن یاسر کرار حسینی
- **شناسه**: ST001
- **دانشگاه**: دانشگاه قم
- **رشته**: حقوق عمومی
- **مقطع**: کارشناسی ارشد
- **وضعیت**: فعال

### 2. قاسم محمود حسن بغدادی
- **شناسه**: ST002
- **دانشگاه**: جامعه المصطفی
- **رشته**: حقوق بین‌الملل
- **مقطع**: دکتری
- **وضعیت**: فعال (دفاع تکمیل شده)

### 3. علی عبدالله صالح نجفی
- **شناسه**: ST003
- **دانشگاه**: دانشگاه کربلا
- **رشته**: حقوق خصوصی
- **مقطع**: کارشناسی
- **وضعیت**: فعال

### 4. زینب حسین جاسم موسوی
- **شناسه**: ST004
- **دانشگاه**: جامعه المصطفی
- **رشته**: حقوق جنایی
- **مقطع**: کارشناسی ارشد
- **وضعیت**: فعال

### 5. محمد جواد کاظم عبدالرضا
- **شناسه**: ST005
- **دانشگاه**: دانشگاه بغداد
- **رشته**: حقوق عمومی
- **مقطع**: دکتری
- **وضعیت**: فعال

### 6. زینب حسین عبدالله سجادی
- **شناسه**: ST006
- **دانشگاه**: دانشگاه قم
- **رشته**: حقوق بین‌الملل
- **مقطع**: کارشناسی ارشد
- **وضعیت**: فعال

### 7. احمد صالح موسی الزبیدی
- **شناسه**: ST007
- **دانشگاه**: دانشگاه نجف
- **رشته**: حقوق خصوصی
- **مقطع**: کارشناسی
- **وضعیت**: فعال

### 8. مریم سعید جعفر البصری
- **شناسه**: ST008
- **دانشگاه**: جامعه المصطفی
- **رشته**: حقوق جنایی
- **مقطع**: کارشناسی ارشد
- **وضعیت**: فعال (دفاع تکمیل شده)

### 9. حسین علی محمد الکربلائی
- **شناسه**: ST009
- **دانشگاه**: دانشگاه کربلا
- **رشته**: حقوق بین‌الملل
- **مقطع**: دکتری
- **وضعیت**: فعال (دفاع و فارغ‌التحصیلی تکمیل شده)

### 10. سارا محمود رضا الموصلی
- **شناسه**: ST010
- **دانشگاه**: دانشگاه بغداد
- **رشته**: حقوق عمومی
- **مقطع**: کارشناسی
- **وضعیت**: فعال

## توابع موجود

### `getSampleStudents()`
دریافت لیست کامل دانشجویان نمونه

```javascript
const students = SampleStudentsData.getSampleStudents();
console.log(students.length); // 10
```

### `getStudentById(studentId)`
دریافت دانشجو بر اساس شناسه

```javascript
const student = SampleStudentsData.getStudentById('student001');
console.log(student.name); // حسن یاسر کرار حسینی
```

### `getStudentsByField(field)`
دریافت دانشجویان بر اساس رشته تحصیلی

```javascript
const lawStudents = SampleStudentsData.getStudentsByField('حقوق عمومی');
console.log(lawStudents.length); // 3
```

### `getStudentsByDegree(degree)`
دریافت دانشجویان بر اساس مقطع تحصیلی

```javascript
const masterStudents = SampleStudentsData.getStudentsByDegree('کارشناسی ارشد');
console.log(masterStudents.length); // 4
```

### `getActiveStudents()`
دریافت دانشجویان فعال

```javascript
const activeStudents = SampleStudentsData.getActiveStudents();
console.log(activeStudents.length); // 10
```

### `getStudentsCount()`
دریافت تعداد کل دانشجویان

```javascript
const count = SampleStudentsData.getStudentsCount();
console.log(count); // 10
```

## نحوه استفاده در employeeModule

ماژول `employeeModule` به صورت خودکار از `SampleStudentsData` استفاده می‌کند اگر `DataModule` موجود نباشد:

```javascript
getAllStudents() {
    // اول از DataModule استفاده می‌کند
    if (typeof DataModule !== 'undefined' && DataModule.getUsers) {
        const users = DataModule.getUsers().filter(u => u.role === 'student');
        if (users && users.length > 0) {
            return users;
        }
    }
    
    // اگر DataModule موجود نبود، از دانشجویان نمونه استفاده می‌کند
    if (typeof SampleStudentsData !== 'undefined') {
        return SampleStudentsData.getSampleStudents();
    }
    
    return [];
}
```

## بارگذاری در HTML

برای استفاده از این ماژول، فایل را قبل از `employee.js` بارگذاری کنید:

```html
<script src="js/sample-students.js"></script>
<script src="js/employee.js"></script>
```

## ویژگی‌های دانشجویان

هر دانشجو شامل اطلاعات زیر است:
- `id`: شناسه یکتا
- `name`: نام کامل (عراقی)
- `studentId`: شماره دانشجویی
- `email`: ایمیل
- `phone`: شماره تماس (عراق: +964)
- `university`: دانشگاه
- `field`: رشته تحصیلی (حقوقی)
- `degree`: مقطع تحصیلی
- `passportNumber`: شماره پاسپورت
- `birthDate`: تاریخ تولد
- `gender`: جنسیت
- `active`: وضعیت فعال بودن
- `registeredAt`: تاریخ ثبت‌نام
- `defenseCompleted`: وضعیت تکمیل دفاع
- `graduationCompleted`: وضعیت فارغ‌التحصیلی
- `defenseDate`: تاریخ دفاع
- `graduationDate`: تاریخ فارغ‌التحصیلی

## توزیع رشته‌ها
- حقوق عمومی: 3 نفر
- حقوق خصوصی: 2 نفر
- حقوق بین‌الملل: 3 نفر
- حقوق جنایی: 2 نفر

## توزیع مقاطع
- کارشناسی: 3 نفر
- کارشناسی ارشد: 4 نفر
- دکتری: 3 نفر

## توزیع جنسیت
- مرد: 6 نفر
- زن: 4 نفر

## وضعیت پیشرفت
- در حال تحصیل: 8 نفر
- دفاع تکمیل شده: 2 نفر
- فارغ‌التحصیل: 1 نفر
