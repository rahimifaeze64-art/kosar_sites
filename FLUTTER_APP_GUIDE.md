# راهنمای ساخت اپلیکیشن فلاتر

## مقدمه
این راهنما برای تبدیل وب‌اپلیکیشن فعلی به یک اپلیکیشن اندروید است که:
- فقط یک WebView ساده است
- به دامین شما متصل می‌شود
- قابلیت اشتراک‌گذاری فایل با تلگرام دارد
- می‌تواند فایل از تلگرام دریافت کند

---

## مرحله 1: نصب Flutter

### ویندوز:
```bash
# دانلود از https://docs.flutter.dev/get-started/install/windows
# یا با Chocolatey:
choco install flutter
```

### بررسی نصب:
```bash
flutter doctor
```

---

## مرحله 2: ساخت پروژه

### روش 1: استفاده از فایل‌های آماده (پیشنهادی)
فایل‌های موجود در پوشه `flutter_app/` را کپی کنید.

### روش 2: ساخت از صفر
```bash
flutter create edu_system_app
cd edu_system_app
```

سپس فایل‌های زیر را جایگزین کنید:
- `lib/main.dart`
- `lib/webview_screen.dart`
- `lib/file_sharing_handler.dart`
- `pubspec.yaml`
- `android/app/src/main/AndroidManifest.xml`

---

## مرحله 3: تنظیم دامین

فایل `lib/webview_screen.dart` را باز کنید و خط 21 را تغییر دهید:

```dart
static const String webAppUrl = 'https://your-domain.com';
```

به:

```dart
static const String webAppUrl = 'https://edu-system.vercel.app'; // دامین واقعی شما
```

---

## مرحله 4: نصب Dependencies

```bash
cd flutter_app
flutter pub get
```

---

## مرحله 5: اجرا روی گوشی

### اتصال گوشی:
1. Developer Options را فعال کنید
2. USB Debugging را فعال کنید
3. گوشی را به کامپیوتر وصل کنید

### اجرا:
```bash
flutter run
```

---

## مرحله 6: ساخت APK نهایی

### APK معمولی (حجم بیشتر):
```bash
flutter build apk --release
```

### APK بهینه (حجم کمتر):
```bash
flutter build apk --split-per-abi --release
```

فایل APK در:
```
build/app/outputs/flutter-apk/app-release.apk
```

---

## استفاده از قابلیت‌های اشتراک‌گذاری

### 1. اشتراک‌گذاری فایل از وب به تلگرام

در فایل JavaScript خود (مثلاً `js/archive.js`):

```javascript
// دکمه اشتراک‌گذاری
function shareFileWithTelegram(fileUrl) {
    // بررسی اینکه داخل اپ فلاتر هستیم
    if (typeof FlutterChannel !== 'undefined') {
        FlutterChannel.postMessage('share:' + fileUrl);
    } else {
        // Fallback برای مرورگر
        if (navigator.share) {
            navigator.share({
                title: 'فایل',
                url: fileUrl
            });
        } else {
            alert('اشتراک‌گذاری فقط در اپ موبایل امکان‌پذیر است');
        }
    }
}
```

### 2. دانلود فایل

```javascript
function downloadFileInApp(fileUrl) {
    if (typeof FlutterChannel !== 'undefined') {
        FlutterChannel.postMessage('download:' + fileUrl);
    } else {
        // Fallback برای مرورگر
        window.open(fileUrl, '_blank');
    }
}
```

### 3. دریافت فایل از تلگرام

```javascript
// این تابع وقتی فایلی از تلگرام به اپ ارسال می‌شود، فراخوانی می‌شود
window.onFlutterFileReceived = function(filePath) {
    console.log('فایل دریافت شد:', filePath);
    
    // نمایش نوتیفیکیشن
    alert('فایل با موفقیت دریافت شد');
    
    // رفرش لیست فایل‌ها
    location.reload();
};
```

---

## اضافه کردن دکمه‌های اشتراک‌گذاری به صفحه بایگانی

فایل `archive.html` را ویرایش کنید:

```html
<!-- در قسمت نمایش فایل‌ها -->
<div class="flex gap-2">
    <!-- دکمه دانلود -->
    <button @click="downloadFile(file)" 
            class="px-3 py-1 bg-blue-500 text-white rounded">
        <i class="fas fa-download"></i> دانلود
    </button>
    
    <!-- دکمه اشتراک‌گذاری -->
    <button onclick="shareFileWithTelegram(file.url)" 
            class="px-3 py-1 bg-green-500 text-white rounded">
        <i class="fas fa-share"></i> اشتراک
    </button>
</div>
```

---

## تنظیمات بک‌اند Django

### 1. اضافه کردن API آپلود فایل

فایل `backend/files/views.py`:

```python
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

@api_view(['POST'])
def upload_file(request):
    if 'file' not in request.FILES:
        return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
    
    file = request.FILES['file']
    category = request.data.get('category', 'shared')
    
    # ذخیره فایل
    # ... کد ذخیره‌سازی شما
    
    return Response({
        'success': True,
        'file_url': f'/media/files/{file.name}'
    }, status=status.HTTP_201_CREATED)
```

### 2. اضافه کردن URL

فایل `backend/api/urls.py`:

```python
from files.views import upload_file

urlpatterns = [
    # ...
    path('files/upload/', upload_file, name='upload_file'),
]
```

---

## تغییر آیکون اپ

1. آیکون خود را آماده کنید (1024x1024 PNG)
2. از سایت https://appicon.co استفاده کنید
3. فایل‌های تولید شده را در `android/app/src/main/res/` قرار دهید

---

## تغییر نام اپ

فایل `android/app/src/main/AndroidManifest.xml`:

```xml
<application
    android:label="سیستم مدیریت تحصیلی"
    ...>
```

---

## رفع مشکلات رایج

### 1. خطای "Cleartext HTTP traffic not permitted"
در `AndroidManifest.xml`:
```xml
android:usesCleartextTraffic="true"
```

### 2. مشکل مجوزها
در `AndroidManifest.xml` مجوزها را چک کنید.

### 3. خطای Build
```bash
flutter clean
flutter pub get
flutter build apk
```

---

## نکات امنیتی

1. برای production حتماً HTTPS استفاده کنید
2. `usesCleartextTraffic` را غیرفعال کنید
3. مجوزهای غیرضروری را حذف کنید

---

## مراحل بعدی (اختیاری)

1. اضافه کردن Splash Screen
2. اضافه کردن نوتیفیکیشن Push
3. اضافه کردن قابلیت آفلاین
4. انتشار در Google Play Store

---

## پشتیبانی

برای سوالات بیشتر:
- مستندات Flutter: https://flutter.dev/docs
- مستندات WebView: https://pub.dev/packages/webview_flutter
