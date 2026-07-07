# طراحی Workflow سیستم مدیریت تحصیلی

## 🔄 جریان کاری (Workflow) کامل

### مرحله 1: ایجاد سفارش
```
مدیر/کارمند → ایجاد سفارش جدید
↓
سفارش با وضعیت "pending" ایجاد می‌شود
↓
در لیست سفارشات نمایش داده می‌شود
```

### مرحله 2: تخصیص به عامل
```
مدیر/کارمند → مشاهده لیست سفارشات
↓
کلیک روی دکمه تخصیص (فلش) 🔄
↓
انتخاب عامل از لیست عاملها
↓
نوشتن توضیحات تخصیص
↓
سفارش به عامل تخصیص می‌یابد
```

### مرحله 3: کار عامل روی سفارش
```
عامل → مشاهده سفارشات تخصیص یافته
↓
ورود به صفحه جزئیات سفارش
↓
آپلود فایل‌ها (PDF, DOC, IMG, TXT)
↓
طرح سوالات در بخش Q&A
↓
به‌روزرسانی پیشرفت کار
```

### مرحله 4: تعامل مدیر و عامل
```
عامل → طرح سوال در سفارش
↓
مدیر → مشاهده سوال در صفحه سفارش
↓
مدیر → پاسخ به سوال
↓
عامل → مشاهده پاسخ و ادامه کار
```

### مرحله 5: تکمیل سفارش
```
عامل → تکمیل کار و آپلود فایل نهایی
↓
مدیر → بررسی و تایید نهایی
↓
سفارش به وضعیت "completed" تغییر می‌کند
```

## 🎨 طراحی UI Components

### 1. Order Card با دکمه تخصیص
```html
<div class="order-card">
  <div class="order-info">...</div>
  <div class="order-actions">
    <button class="assign-btn">🔄</button>
  </div>
</div>
```

### 2. Doctor Selection Modal
```html
<div class="doctor-selection-modal">
  <div class="doctors-grid">
    <div class="doctor-card">...</div>
  </div>
  <textarea placeholder="توضیحات تخصیص..."></textarea>
</div>
```

### 3. Order Detail Page
```html
<div class="order-detail-page">
  <div class="order-header">...</div>
  <div class="files-section">...</div>
  <div class="qa-section">...</div>
  <div class="progress-section">...</div>
</div>
```

### 4. File Upload Component
```html
<div class="file-upload">
  <input type="file" multiple>
  <div class="file-list">...</div>
</div>
```

### 5. Q&A Component
```html
<div class="qa-component">
  <div class="questions-list">...</div>
  <div class="ask-question">...</div>
</div>
```

## 📊 Data Structure

### Order Object (Enhanced)
```javascript
{
  id: 'ord001',
  studentName: 'احمد محمدی',
  type: 'نوشتن رساله',
  status: 'pending|assigned|in_progress|completed',
  assignedDoctor: null,
  assignmentNotes: '', // توضیحات تخصیص
  files: [],
  questions: [],
  progress: 0,
  createdAt: '2026-01-01',
  assignedAt: null,
  completedAt: null
}
```

### File Object
```javascript
{
  id: 'file001',
  orderId: 'ord001',
  name: 'chapter1.pdf',
  type: 'pdf',
  size: 1024000,
  uploadedBy: 'doc001',
  uploadedAt: '2026-01-01',
  url: 'path/to/file'
}
```

### Question Object
```javascript
{
  id: 'q001',
  orderId: 'ord001',
  question: 'چه تعدیلاتی باید انجام دهم؟',
  askedBy: 'doc001',
  askedAt: '2026-01-01',
  answer: 'لطفاً فصل اول را بازنویسی کنید',
  answeredBy: 'mgr001',
  answeredAt: '2026-01-02',
  status: 'pending|answered'
}
```

## 🎯 Implementation Plan

### Phase 1: Enhanced Order Management
- [ ] بهبود Order Cards با دکمه تخصیص
- [ ] Doctor Selection Modal
- [ ] Assignment functionality

### Phase 2: Order Detail Page
- [ ] صفحه جزئیات سفارش
- [ ] File Upload Component
- [ ] Progress Tracking

### Phase 3: Q&A System
- [ ] Question asking interface
- [ ] Answer interface for managers
- [ ] Real-time notifications

### Phase 4: Workflow Completion
- [ ] Status transitions
- [ ] Completion workflow
- [ ] Reporting and analytics

## 🔧 Technical Implementation

### 1. Enhanced Orders Module
```javascript
const OrdersModule = {
  assignOrder(orderId, doctorId, notes),
  uploadFile(orderId, file),
  askQuestion(orderId, question),
  answerQuestion(questionId, answer),
  updateProgress(orderId, progress)
}
```

### 2. File Management
```javascript
const FileManager = {
  uploadFile(file, orderId),
  downloadFile(fileId),
  deleteFile(fileId),
  getOrderFiles(orderId)
}
```

### 3. Q&A System
```javascript
const QASystem = {
  askQuestion(orderId, question),
  getQuestions(orderId),
  answerQuestion(questionId, answer),
  markAsRead(questionId)
}
```

---

**هدف**: ایجاد workflow کامل و تعاملی برای مدیریت سفارشات از ایجاد تا تکمیل