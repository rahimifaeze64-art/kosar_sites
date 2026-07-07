# 📱 راهنمای تغییر آیکون اپلیکیشن Flutter

## ✅ تغییرات انجام شده

1. ✅ نام اپلیکیشن به "الکوثر" تغییر کرد
2. ✅ لوگو کپی شد به `flutter_app/assets/icon.png`
3. ✅ pubspec.yaml به‌روز شد

## 🎨 تغییر آیکون اپلیکیشن (دستی)

برای تغییر آیکون اپلیکیشن، باید تصویر لوگو را در سایزهای مختلف تولید کنید:

### سایزهای مورد نیاز برای Android:

```
mipmap-mdpi/ic_launcher.png      (48x48 px)
mipmap-hdpi/ic_launcher.png      (72x72 px)
mipmap-xhdpi/ic_launcher.png     (96x96 px)
mipmap-xxhdpi/ic_launcher.png    (144x144 px)
mipmap-xxxhdpi/ic_launcher.png   (192x192 px)
```

### مسیر فایل‌ها:
```
flutter_app/android/app/src/main/res/
├── mipmap-mdpi/
│   └── ic_launcher.png
├── mipmap-hdpi/
│   └── ic_launcher.png
├── mipmap-xhdpi/
│   └── ic_launcher.png
├── mipmap-xxhdpi/
│   └── ic_launcher.png
└── mipmap-xxxhdpi/
    └── ic_launcher.png
```

## 🚀 روش آسان: استفاده از flutter_launcher_icons

### مرحله 1: نصب پکیج

```bash
cd flutter_app
flutter pub add dev:flutter_launcher_icons
```

### مرحله 2: تنظیمات در pubspec.yaml

```yaml
flutter_launcher_icons:
  android: true
  ios: false
  image_path: "assets/icon.png"
  adaptive_icon_background: "#FFFFFF"
  adaptive_icon_foreground: "assets/icon.png"
```

### مرحله 3: تولید آیکون‌ها

```bash
flutter pub run flutter_launcher_icons
```

## 📋 دستورات کامل

```bash
# 1. رفتن به پوشه اپ
cd flutter_app

# 2. نصب پکیج
flutter pub add dev:flutter_launcher_icons

# 3. تولید آیکون‌ها
flutter pub run flutter_launcher_icons

# 4. build کردن APK
flutter build apk --release
```

## ✅ وضعیت فعلی

- ✅ نام اپ: "الکوثر"
- ✅ Package: com.alkawsar.edu_system
- ✅ لوگو آماده: assets/logooo.png
- ⚠️ آیکون: هنوز باید تولید شود (از روش بالا استفاده کنید)

## 🎯 مرحله بعدی

1. نصب flutter_launcher_icons
2. تولید آیکون‌ها
3. Build کردن APK

یا می‌توانید با آیکون پیش‌فرض فعلی APK بسازید و بعداً آیکون را تغییر دهید.

---

**تاریخ:** 2026-02-28  
**نسخه:** 1.0.0
