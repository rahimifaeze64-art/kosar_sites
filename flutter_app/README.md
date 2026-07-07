# اپلیکیشن فلاتر - سیستم مدیریت تحصیلی

## نصب و راه‌اندازی

### 1. نصب Flutter
```bash
# دانلود از https://flutter.dev
flutter doctor
```

### 2. نصب Dependencies
```bash
cd flutter_app
flutter pub get
```

### 3. تنظیم دامین
فایل `lib/webview_screen.dart` را باز کنید و خط زیر را تغییر دهید:
```dart
static const String webAppUrl = 'https://your-domain.com';
```

### 4. اجرا روی اندروید
```bash
flutter run
```

### 5. ساخت APK
```bash
flutter build apk --release
```
فایل APK در: `build/app/outputs/flutter-apk/app-release.apk`

## قابلیت‌ها

✅ WebView کامل به دامین شما
✅ دریافت فایل از تلگرام و اپ‌های دیگر
✅ اشتراک‌گذاری فایل از اپ به تلگرام
✅ دانلود فایل از سرور
✅ آپلود فایل به سرور
✅ ارتباط دوطرفه JavaScript ↔ Flutter

## استفاده در JavaScript

### دریافت فایل از فلاتر:
```javascript
window.onFlutterFileReceived = function(filePath) {
  console.log('فایل دریافت شد:', filePath);
  // آپلود به سرور یا نمایش در UI
};
```

### ارسال درخواست به فلاتر:
```javascript
// اشتراک‌گذاری فایل
FlutterChannel.postMessage('share:https://domain.com/file.pdf');

// دانلود فایل
FlutterChannel.postMessage('download:https://domain.com/file.pdf');
```

## تنظیمات بک‌اند

API آپلود فایل باید در آدرس زیر باشد:
```
POST /api/files/upload/
```

با فرمت:
```
FormData: {
  file: [binary],
  category: 'shared'
}
```

## مجوزهای اندروید

اپ به مجوزهای زیر نیاز دارد:
- INTERNET (برای WebView)
- READ_EXTERNAL_STORAGE (برای خواندن فایل‌ها)
- WRITE_EXTERNAL_STORAGE (برای ذخیره فایل‌ها)

## نکات مهم

1. دامین را در `webview_screen.dart` تغییر دهید
2. آیکون اپ را در `android/app/src/main/res/` قرار دهید
3. برای HTTPS نیازی به تنظیم خاص نیست
4. برای HTTP باید `usesCleartextTraffic="true"` فعال باشد (در AndroidManifest.xml)
