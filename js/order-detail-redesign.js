/**
 * order-detail-redesign.js — بازطراحی کامل صفحه جزئیات سفارش
 * تب‌ها: مشخصات | کار من (agent) | فایل‌ها | تاریخچه | مالی | تخصیص | کارمند
 * FIX: باگ تعریف user قبل از استفاده در show()
 */
const OrderDetailRedesign = (function () {
  'use strict';

  // ── ثابت‌ها ──────────────────────────────────────────────────
  const STATUS = {
    pending:     { label:'در انتظار',    cls:'bg-amber-100 text-amber-800 border border-amber-200',  icon:'fa-clock' },
    in_progress: { label:'در حال انجام', cls:'bg-blue-100 text-blue-800 border border-blue-200',    icon:'fa-spinner' },
    completed:   { label:'تکمیل شده',   cls:'bg-green-100 text-green-800 border border-green-200',  icon:'fa-check-circle' },
    cancelled:   { label:'لغو شده',     cls:'bg-red-100 text-red-800 border border-red-200',        icon:'fa-ban' },
    approved:    { label:'تایید شده',   cls:'bg-teal-100 text-teal-800 border border-teal-200',     icon:'fa-check-double' },
    rejected:    { label:'رد شده',      cls:'bg-rose-100 text-rose-800 border border-rose-200',     icon:'fa-ban' },
  };
  const PAYMENT_STATUS = {
    unpaid:  { label:'پرداخت نشده', cls:'bg-red-50 text-red-700',    icon:'fa-times-circle' },
    partial: { label:'پرداخت جزئی', cls:'bg-amber-50 text-amber-700', icon:'fa-adjust' },
    paid:    { label:'پرداخت کامل', cls:'bg-green-50 text-green-700', icon:'fa-check-circle' },
  };
  const FILE_TYPES = [
    'اولیه','ترجمه','تلخیص','تعدیل شده','تنضید قبل دفاع','تنضید بعد دفاع',
    'تنضید اولیه','تعدیل بعد دفاع','استلال عراقی بعد دفاع','تنضید ایرانداک','سایر'
  ];
  // وضعیت بررسی فایل
  const FILE_REVIEW_STATUS = {
    pending:   { label:'در انتظار بررسی', cls:'bg-gray-100 text-gray-600' },
    approved:  { label:'تأیید شد',        cls:'bg-green-100 text-green-700' },
    rejected:  { label:'نیاز به اصلاح',  cls:'bg-red-100 text-red-700' },
  };

  // state داخلی
  let _orderId = null;
  let _activeTab = 'overview';

  // ── توابع کمکی ───────────────────────────────────────────────
  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function fmt(n) { return (parseFloat(n)||0).toLocaleString('fa-IR'); }
  function fmtDate(iso) {
    if (!iso) return '---';
    try {
      if (typeof Jalali !== 'undefined') return Jalali.toJalaliDisplay(new Date(iso));
      return new Date(iso).toLocaleDateString('fa-IR');
    } catch(e) { return String(iso).slice(0,10); }
  }
  function fmtDeadline(dl) {
    if (!dl) return '<span class="text-gray-400">تعیین نشده</span>';
    try {
      const d = new Date(dl), now = new Date();
      const diff = Math.ceil((d - now) / 86400000);
      const ds = fmtDate(dl);
      if (diff < 0)  return `<span class="font-semibold text-red-600">${ds} <span class="text-xs">(${Math.abs(diff)} روز تأخیر)</span></span>`;
      if (diff === 0) return `<span class="font-semibold text-orange-500">${ds} <span class="text-xs">(امروز)</span></span>`;
      if (diff <= 3)  return `<span class="font-semibold text-amber-600">${ds} <span class="text-xs">(${diff} روز)</span></span>`;
      return `<span class="text-gray-700">${ds}</span>`;
    } catch(e) { return esc(dl); }
  }
  function statusBadge(status) {
    const s = STATUS[status] || { label:status||'---', cls:'bg-gray-100 text-gray-600 border border-gray-200', icon:'fa-circle' };
    return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.cls}">
      <i class="fas ${s.icon} text-[10px]"></i>${s.label}</span>`;
  }
  function progressRing(pct) {
    const p = Math.min(100, Math.max(0, parseInt(pct)||0));
    const r = 28, circ = 2 * Math.PI * r;
    const offset = circ - (p/100)*circ;
    const color = p < 30 ? '#ef4444' : p < 70 ? '#f59e0b' : '#22c55e';
    return `<div class="relative w-16 h-16 flex items-center justify-center">
      <svg class="absolute w-16 h-16 -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="${r}" fill="none" stroke="#e5e7eb" stroke-width="4"/>
        <circle cx="32" cy="32" r="${r}" fill="none" stroke="${color}" stroke-width="4"
          stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="round"/>
      </svg>
      <span class="text-sm font-bold" style="color:${color}">${p}%</span>
    </div>`;
  }
  function fileIcon(name) {
    const ext = (name||'').split('.').pop().toLowerCase();
    if (['jpg','jpeg','png','gif','webp'].includes(ext)) return 'fa-file-image text-pink-500';
    if (ext==='pdf') return 'fa-file-pdf text-red-500';
    if (['doc','docx'].includes(ext)) return 'fa-file-word text-blue-500';
    if (['xls','xlsx'].includes(ext)) return 'fa-file-excel text-green-500';
    return 'fa-file text-gray-400';
  }
  function fmtSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes/1024).toFixed(1) + ' KB';
    return (bytes/1048576).toFixed(1) + ' MB';
  }
  function canManage(role) { return role === 'manager' || role === 'employee'; }

  // ── data helpers ─────────────────────────────────────────────
  function getOrders() {
    if (typeof DataModule !== 'undefined') return DataModule.getOrders() || [];
    try {
      const k = (typeof CONFIG !== 'undefined' && CONFIG.STORAGE_KEYS?.ORDERS) || 'edu_system_orders';
      return JSON.parse(localStorage.getItem(k) || '[]');
    } catch(e) { return []; }
  }
  function saveOrders(orders) {
    if (typeof DataModule !== 'undefined') { DataModule.saveOrders(orders); return; }
    const k = (typeof CONFIG !== 'undefined' && CONFIG.STORAGE_KEYS?.ORDERS) || 'edu_system_orders';
    localStorage.setItem(k, JSON.stringify(orders));
  }
  function getUsers() {
    try {
      // ابتدا از DataModule بگیر
      let users = [];
      if (typeof DataModule !== 'undefined') {
        users = DataModule.getUsers() || [];
      }
      // اگه از HARDCODED_USERS کاربری داریم که در لیست نیست، اضافه کن
      if (typeof HARDCODED_USERS !== 'undefined' && HARDCODED_USERS.length) {
        const existingIds = new Set(users.map(u => u.id));
        HARDCODED_USERS.forEach(hu => { if (!existingIds.has(hu.id)) users.push(hu); });
      }
      return users;
    } catch(e) {
      return typeof HARDCODED_USERS !== 'undefined' ? HARDCODED_USERS : [];
    }
  }
  function currentUser() {
    if (typeof getCurrentUser === 'function') return getCurrentUser() || {};
    try { return JSON.parse(localStorage.getItem('currentUser') || '{}'); } catch(e) { return {}; }
  }
  function notify(msg, type) {
    if (typeof UTILS !== 'undefined' && UTILS.showNotification) UTILS.showNotification(msg, type);
  }

  // ── تب‌ها بر اساس نقش ────────────────────────────────────────
  const TABS = [
    { id:'overview',   icon:'fa-info-circle',  label:'مشخصات',     roles:['manager','employee','agent','student'] },
    { id:'mywork',     icon:'fa-tasks',         label:'کار من',     roles:['agent'] },
    { id:'files',      icon:'fa-paperclip',     label:'فایل‌ها',    roles:['manager','employee','agent'] },
    { id:'history',    icon:'fa-history',       label:'تاریخچه',    roles:['manager','employee','agent'] },
    { id:'financial',  icon:'fa-coins',         label:'مالی',       roles:['manager','employee'] },
    { id:'assignment', icon:'fa-user-tie',      label:'تخصیص',      roles:['manager','employee'] },
    { id:'addemployee',icon:'fa-user-plus',     label:'کارمند',     roles:['manager'] },
  ];

  // ── هدر ──────────────────────────────────────────────────────
  function renderHeader(order, userRole) {
    const agents = getUsers().filter(u => u.role==='agent');
    const agentObj = agents.find(a => a.id===(order.assignedDoctorId||order.assignedAgentId));
    const agentName = agentObj ? agentObj.name : (order.assignedDoctor||'');
    const currency = esc(order.currency||'تومان');
    const total = parseFloat(order.totalAmount||order.cost||0);
    const pst = PAYMENT_STATUS[order.paymentStatus] || PAYMENT_STATUS.unpaid;
    return `
    <div class="bg-gradient-to-l from-[#f3f9e8] via-white to-[#eef7ff] border-b border-gray-200 px-6 py-5">
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <div class="flex items-start gap-4">
          <div class="w-14 h-14 rounded-2xl bg-[#8FBF3F] text-white flex items-center justify-center text-2xl font-black shadow-sm flex-shrink-0">
            ${esc(order.studentName||'?').charAt(0)}
          </div>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h2 class="text-xl font-bold text-gray-900">${esc(order.studentName||'---')}</h2>
              ${statusBadge(order.status)}
            </div>
            <p class="text-sm text-gray-500 mt-0.5">
              ${esc(order.isCustomOrder?(order.title||order.type):order.type)||'---'}
              ${order.university?` — ${esc(order.university)}`:''}
            </p>
            <div class="flex items-center gap-3 mt-2 flex-wrap">
              <span class="text-xs text-gray-500 flex items-center gap-1">
                <i class="fas fa-hashtag text-[#8FBF3F]"></i>
                <code class="font-mono">${String(order.id).slice(-8).toUpperCase()}</code>
              </span>
              <span class="text-xs text-gray-500"><i class="fas fa-calendar-plus text-[#8FBF3F] ml-1"></i>${fmtDate(order.createdAt)}</span>
              ${order.deadline||order.deadlineDateTime?`
              <span class="text-xs flex items-center gap-1"><i class="fas fa-calendar-alt text-amber-500"></i>
              ${fmtDeadline(order.deadline||order.deadlineDateTime)}</span>`:''}
            </div>
          </div>
        </div>
        <div class="flex gap-3 flex-wrap">
          <div class="bg-white rounded-xl border border-gray-200 px-4 py-3 text-center shadow-sm min-w-[100px]">
            <p class="text-[10px] text-gray-400 mb-0.5">مبلغ کل</p>
            <p class="text-base font-black text-gray-800">${fmt(total)}</p>
            <p class="text-[10px] text-gray-500">${currency}</p>
          </div>
          <div class="rounded-xl border px-4 py-3 text-center shadow-sm min-w-[100px] ${pst.cls}">
            <p class="text-[10px] opacity-70 mb-0.5">پرداخت</p>
            <p class="text-base font-black">${fmt(order.paidAmount||0)}</p>
            <p class="text-[10px] opacity-80">${pst.label}</p>
          </div>
          ${agentName?`
          <div class="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-2 shadow-sm">
            <div class="w-8 h-8 rounded-full bg-[#8FBF3F] text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
              ${esc(agentName).charAt(0)}</div>
            <div><p class="text-[10px] text-gray-400">عامل</p><p class="text-xs font-semibold text-gray-800">${esc(agentName)}</p></div>
          </div>`:''}
        </div>
      </div>
      ${canManage(userRole)?`
      <div class="flex gap-2 mt-4 flex-wrap">
        ${order.status==='pending'?`<button onclick="OrderDetailRedesign.quickAction('${esc(order.id)}','in_progress')"
          class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5">
          <i class="fas fa-play text-[10px]"></i>شروع کار</button>`:''}
        ${order.status==='in_progress'?`<button onclick="OrderDetailRedesign.quickAction('${esc(order.id)}','completed')"
          class="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5">
          <i class="fas fa-check-double text-[10px]"></i>اعلام تکمیل</button>`:''}
        ${order.status!=='cancelled'&&order.status!=='completed'?`<button onclick="OrderDetailRedesign.quickAction('${esc(order.id)}','cancelled')"
          class="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5">
          <i class="fas fa-ban text-[10px]"></i>لغو</button>`:''}
        <button onclick="OrderDetailRedesign.printOrder('${esc(order.id)}')"
          class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5">
          <i class="fas fa-print text-[10px]"></i>چاپ</button>
      </div>`:''}
    </div>`;
  }

  // ── تب‌بار ────────────────────────────────────────────────────
  function renderTabBar(activeTab, userRole) {
    const visible = TABS.filter(t => !t.roles || t.roles.includes(userRole));
    return `
    <div class="flex border-b border-gray-200 bg-white overflow-x-auto px-4 flex-shrink-0" id="odr-tabbar">
      ${visible.map(t => `
        <button id="odr-tab-btn-${t.id}" onclick="OrderDetailRedesign.switchTab('${t.id}')"
          class="flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors
            ${t.id===activeTab?'border-[#8FBF3F] text-[#5a7a28]':'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}">
          <i class="fas ${t.icon} text-xs"></i>${t.label}
        </button>`).join('')}
    </div>`;
  }

  // ── تب ۱: مشخصات ─────────────────────────────────────────────
  function renderOverviewTab(order, userRole) {
    const row = (icon,label,val,cls='text-gray-800') => val?`
      <div class="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0">
        <i class="fas ${icon} text-sm text-[#8FBF3F] mt-0.5 w-4 text-center flex-shrink-0"></i>
        <span class="text-xs text-gray-400 w-24 flex-shrink-0 pt-0.5">${label}</span>
        <span class="text-sm font-medium ${cls} flex-1">${val}</span>
      </div>`:'';
    const degreeMap={masters:'ارشد',phd:'دکتری',bachelor:'کارشناسی'};
    return `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2"><i class="fas fa-user-graduate text-[#8FBF3F]"></i>اطلاعات دانشجو</h4>
        </div>
        <div class="px-4 py-1">
          ${row('fa-user','نام',esc(order.studentName||'---'),'text-gray-900 font-semibold')}
          ${row('fa-university','دانشگاه',esc(order.university||'---'))}
          ${row('fa-graduation-cap','رشته',esc(order.field||'---'))}
          ${row('fa-layer-group','مقطع',degreeMap[order.degree]||esc(order.degree||''))}
          ${row('fa-passport','پاسپورت',esc(order.passportNumber||'---'))}
          ${row('fa-phone','تلفن',esc(order.phone||'---'))}
        </div>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2"><i class="fas fa-clipboard-list text-[#8FBF3F]"></i>جزئیات سفارش</h4>
        </div>
        <div class="px-4 py-1">
          ${row('fa-tasks','نوع کار',esc(order.isCustomOrder?(order.title||order.type):order.type)||'---')}
          ${row('fa-circle','وضعیت',statusBadge(order.status))}
          ${row('fa-calendar-check','تاریخ ثبت',fmtDate(order.createdAt))}
          ${row('fa-calendar-alt','مهلت تحویل',fmtDeadline(order.deadline||order.deadlineDateTime))}
          ${order.stage?row('fa-map-marker-alt','مرحله',esc(order.stage)):''}
        </div>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2"><i class="fas fa-comment-alt text-[#8FBF3F]"></i>توضیحات</h4>
        </div>
        <div class="p-4">
          ${order.description?`<p class="text-sm text-gray-700 leading-relaxed">${esc(order.description)}</p>`
            :`<p class="text-sm text-gray-400 italic">توضیحاتی ثبت نشده</p>`}
        </div>
      </div>
    </div>`;
  }

  // ── تب فایل‌ها (بازبینی چندمرحله‌ای + ترجمه/تلخیص) ─────────
  function renderFilesTab(order, userRole) {
    const files = Array.isArray(order.files) ? order.files : [];
    const fileTypeOpts = FILE_TYPES.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');

    // فایل‌های ترجمه/تلخیص
    const transFiles = files.filter(f => f.fileType==='ترجمه'||f.fileType==='تلخیص');
    // بقیه فایل‌ها
    const otherFiles = files.filter(f => f.fileType!=='ترجمه'&&f.fileType!=='تلخیص');

    const fileRow = (f, showReview) => {
      const rv = FILE_REVIEW_STATUS[f.reviewStatus||'pending'];
      return `
      <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100 transition-colors group" id="frow-${esc(f.id)}">
        <i class="fas ${fileIcon(f.name)} text-2xl flex-shrink-0"></i>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-800 truncate">${esc(f.name||'')}</p>
          <div class="flex items-center gap-2 mt-0.5 flex-wrap">
            ${f.fileType?`<span class="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">${esc(f.fileType)}</span>`:''}
            ${f.size?`<span class="text-[10px] text-gray-400">${fmtSize(f.size)}</span>`:''}
            <span class="text-[10px] text-gray-400">${esc(f.uploadedByName||'')}</span>
            <span class="text-[10px] text-gray-400">${f.uploadedAt?fmtDate(f.uploadedAt):''}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded font-medium ${rv.cls}">${rv.label}</span>
            ${f.reviewVersion?`<span class="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">ویرایش ${f.reviewVersion}</span>`:''}
          </div>
          ${f.reviewComment?`<p class="text-xs text-red-600 mt-1 bg-red-50 rounded px-2 py-1"><i class="fas fa-comment-alt ml-1"></i>${esc(f.reviewComment)}</p>`:''}
        </div>
        <div class="flex gap-1 flex-shrink-0">
          ${f.url?`<a href="${esc(f.url)}" download="${esc(f.name)}"
            class="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100" title="دانلود">
            <i class="fas fa-download text-xs"></i></a>`:''}
          ${showReview&&canManage(userRole)?`
          <button onclick="OrderDetailRedesign.showFileReview('${esc(order.id)}','${esc(f.id)}')"
            class="p-2 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100" title="بررسی">
            <i class="fas fa-search text-xs"></i></button>`:''}
          ${canManage(userRole)?`
          <button onclick="OrderDetailRedesign.deleteFile('${esc(order.id)}','${esc(f.id)}')"
            class="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 opacity-0 group-hover:opacity-100" title="حذف">
            <i class="fas fa-trash text-xs"></i></button>`:''}
        </div>
      </div>`;
    };

    return `
    <div class="space-y-5">

      <!-- آپلود فایل جدید -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2">
            <i class="fas fa-upload text-[#8FBF3F]"></i>آپلود فایل جدید
          </h4>
        </div>
        <div class="p-4 space-y-3">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-gray-500 block mb-1">نوع فایل</label>
              <select id="file-type-sel" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#8FBF3F] outline-none">
                <option value="">انتخاب نوع فایل...</option>${fileTypeOpts}
              </select>
            </div>
            <div>
              <label class="text-xs text-gray-500 block mb-1">انتخاب فایل</label>
              <input type="file" id="file-input-odr" accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                class="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#8FBF3F] outline-none bg-white">
            </div>
          </div>
          <button onclick="OrderDetailRedesign.uploadFile('${esc(order.id)}')"
            class="w-full bg-[#8FBF3F] hover:bg-[#7aac2e] text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
            <i class="fas fa-cloud-upload-alt"></i>آپلود
          </button>
          <p class="text-xs text-gray-400"><i class="fas fa-info-circle ml-1"></i>فرمت‌های مجاز: PDF, DOC, DOCX, JPG, PNG — حداکثر ۱۰ مگابایت</p>
        </div>
      </div>

      <!-- فایل‌های ترجمه و تلخیص -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2">
            <i class="fas fa-language text-purple-500"></i>فایل‌های ترجمه و تلخیص
          </h4>
          <span class="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">${transFiles.length} فایل</span>
        </div>
        <div class="p-4">
          ${transFiles.length===0
            ?`<p class="text-sm text-gray-400 text-center py-6"><i class="fas fa-language text-3xl block mb-2 opacity-20"></i>فایل ترجمه یا تلخیص آپلود نشده</p>`
            :`<div class="space-y-2">${transFiles.map(f=>fileRow(f,true)).join('')}</div>`}
        </div>
      </div>

      <!-- سایر فایل‌ها با قابلیت بررسی -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2">
            <i class="fas fa-folder-open text-[#8FBF3F]"></i>سایر فایل‌های پروژه
          </h4>
          <span class="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">${otherFiles.length} فایل</span>
        </div>
        <div class="p-4" id="odr-files-list">
          ${otherFiles.length===0
            ?`<div class="flex flex-col items-center py-10 text-gray-400">
               <i class="fas fa-folder-open text-5xl opacity-20 mb-3"></i>
               <p class="text-sm">هنوز فایلی آپلود نشده</p></div>`
            :`<div class="space-y-2">${otherFiles.map(f=>fileRow(f,true)).join('')}</div>`}
        </div>
      </div>

      <!-- پنل بررسی فایل (توسط کارمند) -->
      <div id="file-review-panel" class="hidden bg-white rounded-xl border-2 border-amber-300 overflow-hidden shadow-md">
        <div class="bg-amber-50 px-4 py-3 border-b border-amber-200">
          <h4 class="text-sm font-bold text-amber-800 flex items-center gap-2">
            <i class="fas fa-search text-amber-600"></i>بررسی فایل — تعریف اصلاحات
          </h4>
        </div>
        <div class="p-4 space-y-3">
          <input type="hidden" id="review-file-id">
          <div>
            <label class="text-xs font-medium text-gray-600 block mb-1">وضعیت بررسی</label>
            <div class="flex gap-2">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="review-status" value="approved" class="accent-green-600">
                <span class="text-sm text-green-700 font-medium">تأیید شد</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="review-status" value="rejected" class="accent-red-600" checked>
                <span class="text-sm text-red-700 font-medium">نیاز به اصلاح</span>
              </label>
            </div>
          </div>
          <div>
            <label class="text-xs font-medium text-gray-600 block mb-1">توضیحات اصلاحات (برای عامل)</label>
            <textarea id="review-comment" rows="3" placeholder="مشخص کنید چه اصلاحاتی باید انجام شود..."
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 outline-none resize-none"></textarea>
          </div>
          <!-- بازگذاری فایل جدید -->
          <div class="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <label class="text-xs font-medium text-gray-600 block mb-2">
              <i class="fas fa-sync-alt ml-1 text-blue-500"></i>بازگذاری فایل (اختیاری)
            </label>
            <input type="file" id="review-reupload-file" accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
              class="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-400 outline-none">
            <p class="text-[10px] text-gray-400 mt-1">اگر نسخه جدید فایل آماده است، اینجا بارگذاری کنید</p>
          </div>
          <div class="flex gap-2">
            <button onclick="OrderDetailRedesign.submitFileReview('${esc(order.id)}')"
              class="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-lg text-sm font-medium">
              <i class="fas fa-paper-plane ml-1"></i>ثبت بررسی
            </button>
            <button onclick="document.getElementById('file-review-panel').classList.add('hidden')"
              class="bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-4 rounded-lg text-sm">
              انصراف
            </button>
          </div>
        </div>
      </div>

    </div>`;
  }

  // ── تب کار من (فقط عامل) ─────────────────────────────────────
  function renderMyWorkTab(order, userRole) {
    const user = currentUser();
    const prog = parseInt(order.progress)||0;
    const allFiles = Array.isArray(order.files) ? order.files : [];
    const myFiles  = allFiles.filter(f => f.uploadedBy === user.id || f.isAgentFile);
    const myNotes  = (Array.isArray(order.workLog)?order.workLog:[])
      .filter(l => l.type==='note' && (l.by===user.id||l.byName===user.name))
      .sort((a,b)=>new Date(b.timestamp||0)-new Date(a.timestamp||0));
    const fileTypeOpts = FILE_TYPES.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');

    // فایل‌هایی که نیاز به اصلاح دارند
    const needsRevision = allFiles.filter(f=>f.reviewStatus==='rejected'&&(f.uploadedBy===user.id||f.isAgentFile));

    return `
    <div class="space-y-5">

      <!-- اطلاعات سفارش -->
      <div class="bg-gradient-to-l from-[#f3f9e8] to-[#eaf4d6] rounded-xl border border-[#c5e08a] p-4">
        <div class="flex items-start gap-4">
          <div class="w-12 h-12 rounded-xl bg-[#8FBF3F] flex items-center justify-center flex-shrink-0">
            <i class="fas fa-clipboard-list text-white text-lg"></i>
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="font-bold text-gray-800">${esc(order.studentName||'---')}</h3>
            <p class="text-sm text-gray-600 mt-0.5">${esc(order.type||order.workType||'---')}</p>
            <div class="flex items-center gap-2 mt-2 flex-wrap">
              <span class="text-xs bg-white border border-[#c5e08a] text-[#5a7a28] px-2 py-0.5 rounded-full">
                ${esc(order.university||'---')}</span>
              ${order.deadline||order.deadlineDateTime?`
              <span class="text-xs bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded-full">
                <i class="fas fa-clock ml-1 text-[10px]"></i>مهلت: ${fmtDate(order.deadline||order.deadlineDateTime)}</span>`:''}
            </div>
          </div>
          <div class="flex-shrink-0"></div>
        </div>
      </div>

      <!-- هشدار فایل‌های نیاز به اصلاح -->
      ${needsRevision.length>0?`
      <div class="bg-red-50 border border-red-200 rounded-xl p-4">
        <h4 class="text-sm font-bold text-red-700 flex items-center gap-2 mb-3">
          <i class="fas fa-exclamation-triangle"></i>فایل‌های نیاز به اصلاح (${needsRevision.length})
        </h4>
        <div class="space-y-2">
          ${needsRevision.map(f=>`
          <div class="bg-white rounded-lg border border-red-200 p-3">
            <div class="flex items-center gap-2 mb-1">
              <i class="fas ${fileIcon(f.name)} text-lg"></i>
              <span class="text-sm font-medium text-gray-800">${esc(f.name)}</span>
            </div>
            <p class="text-xs text-red-600"><i class="fas fa-comment-alt ml-1"></i>${esc(f.reviewComment||'اصلاح مورد نیاز است')}</p>
            <p class="text-[10px] text-gray-400 mt-1">ویرایش ${f.reviewVersion||1} — ${fmtDate(f.uploadedAt)}</p>
          </div>`).join('')}
        </div>
      </div>`:''}

      <!-- آپلود فایل کار -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2">
            <i class="fas fa-upload text-[#8FBF3F]"></i>آپلود فایل کار
            ${needsRevision.length>0?`<span class="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
              ${needsRevision.length} فایل برای اصلاح</span>`:''}
          </h4>
          <span class="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">${allFiles.length} فایل کل</span>
        </div>
        <div class="p-4 space-y-3">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-gray-500 block mb-1">نوع فایل</label>
              <select id="mw-file-type" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#8FBF3F] outline-none">
                <option value="">انتخاب نوع...</option>${fileTypeOpts}
              </select>
            </div>
            <div>
              <label class="text-xs text-gray-500 block mb-1">انتخاب فایل</label>
              <input type="file" id="mw-file-input" accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                class="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#8FBF3F] outline-none bg-white">
            </div>
          </div>
          ${needsRevision.length>0?`
          <div>
            <label class="text-xs text-gray-500 block mb-1">در صورت آپلود اصلاح — فایل مرتبط</label>
            <select id="mw-revision-of" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#8FBF3F] outline-none">
              <option value="">بدون ارتباط (فایل جدید)</option>
              ${needsRevision.map(f=>`<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('')}
            </select>
          </div>`:''}
          <button onclick="OrderDetailRedesign.uploadMyFile('${esc(order.id)}')"
            class="w-full bg-[#8FBF3F] hover:bg-[#7aac2e] text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
            <i class="fas fa-cloud-upload-alt"></i>آپلود فایل
          </button>
        </div>
        ${myFiles.length>0?`
        <div class="border-t border-gray-100 p-4">
          <p class="text-xs font-semibold text-gray-500 mb-3">فایل‌های آپلود شده توسط من:</p>
          <div class="space-y-2">
            ${myFiles.map(f=>{const rv=FILE_REVIEW_STATUS[f.reviewStatus||'pending'];return`
            <div class="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg border border-gray-100 group">
              <i class="fas ${fileIcon(f.name)} text-xl flex-shrink-0"></i>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-800 truncate">${esc(f.name)}</p>
                <div class="flex items-center gap-2 flex-wrap">
                  ${f.fileType?`<span class="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">${esc(f.fileType)}</span>`:''}
                  <span class="text-[10px] px-1.5 py-0.5 rounded ${rv.cls}">${rv.label}</span>
                  ${f.reviewVersion?`<span class="text-[10px] text-purple-600">ویرایش ${f.reviewVersion}</span>`:''}
                </div>
                ${f.reviewComment?`<p class="text-xs text-red-600 mt-1">${esc(f.reviewComment)}</p>`:''}
              </div>
              ${f.url?`<a href="${esc(f.url)}" download="${esc(f.name)}"
                class="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 opacity-0 group-hover:opacity-100">
                <i class="fas fa-download text-xs"></i></a>`:''}
            </div>`;}).join('')}
          </div>
        </div>`:''}
      </div>

      <!-- یادداشت‌های من -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2">
            <i class="fas fa-sticky-note text-[#8FBF3F]"></i>یادداشت‌های من
          </h4>
        </div>
        <div class="p-4 space-y-3">
          <div class="flex gap-3">
            <textarea id="mw-note" rows="3" placeholder="گزارش پیشرفت یا یادداشت..."
              class="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#8FBF3F] outline-none resize-none"></textarea>
            <button onclick="OrderDetailRedesign.addMyNote('${esc(order.id)}')"
              class="bg-[#8FBF3F] hover:bg-[#7aac2e] text-white px-4 rounded-xl text-sm font-medium self-end py-2 flex-shrink-0">
              <i class="fas fa-plus"></i>
            </button>
          </div>
          ${myNotes.length>0?`
          <div class="space-y-2 max-h-48 overflow-y-auto">
            ${myNotes.map(n=>`
            <div class="bg-[#f9fdf0] border border-[#daf0a0] rounded-xl p-3">
              <p class="text-sm text-gray-700">${esc(n.message||'')}</p>
              <p class="text-[10px] text-gray-400 mt-1.5">${fmtDate(n.timestamp)}</p>
            </div>`).join('')}
          </div>`:`<p class="text-sm text-gray-400 text-center py-3">هنوز یادداشتی ثبت نشده</p>`}
        </div>
      </div>

      <!-- اعلام تکمیل -->
      ${order.status==='in_progress'?`
      <button onclick="OrderDetailRedesign.quickAction('${esc(order.id)}','completed')"
        class="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm">
        <i class="fas fa-check-double"></i>اعلام تکمیل کار
      </button>`:''}

    </div>`;
  }

  // ── تب تاریخچه ───────────────────────────────────────────────
  function renderHistoryTab(order, userRole) {
    const workLog = Array.isArray(order.workLog)?order.workLog:[];
    const rejH    = Array.isArray(order.rejectionHistory)?order.rejectionHistory:[];
    const allLogs = [
      ...workLog,
      ...rejH.map(r=>({id:r.date,type:'rejection',message:`رد شده: ${r.reason||''}`,timestamp:r.date,by:r.rejectedByName||''}))
    ].sort((a,b)=>new Date(b.timestamp||0)-new Date(a.timestamp||0));

    const logCfg = {
      assignment:   {icon:'fa-user-check',  color:'text-blue-500',  bg:'bg-blue-50'},
      payment:      {icon:'fa-coins',        color:'text-green-600', bg:'bg-green-50'},
      status_change:{icon:'fa-exchange-alt', color:'text-lime-600',  bg:'bg-lime-50'},
      note:         {icon:'fa-sticky-note',  color:'text-amber-500', bg:'bg-amber-50'},
      rejection:    {icon:'fa-ban',          color:'text-red-500',   bg:'bg-red-50'},
      file_upload:  {icon:'fa-paperclip',    color:'text-teal-500',  bg:'bg-teal-50'},
      file_review:  {icon:'fa-search',       color:'text-purple-500',bg:'bg-purple-50'},
      employee_added:{icon:'fa-user-plus',   color:'text-indigo-500',bg:'bg-indigo-50'},
      default:      {icon:'fa-circle',       color:'text-gray-400',  bg:'bg-gray-50'},
    };

    return `
    <div class="space-y-5">
      <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
        ${[['assignment','تخصیص'],['payment','پرداخت'],['status_change','وضعیت'],
           ['note','یادداشت'],['file_upload','فایل'],['file_review','بررسی']].map(([type,label])=>{
          const cnt=allLogs.filter(l=>l.type===type).length;
          const c=logCfg[type];
          return`<div class="${c.bg} rounded-xl p-3 text-center border border-gray-100">
            <i class="fas ${c.icon} ${c.color} text-lg mb-1 block"></i>
            <p class="text-lg font-black text-gray-800">${cnt}</p>
            <p class="text-[10px] text-gray-500">${label}</p>
          </div>`;}).join('')}
      </div>
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2">
            <i class="fas fa-stream text-[#8FBF3F]"></i>جدول زمانی فعالیت‌ها
          </h4>
          <span class="text-xs text-gray-400">${allLogs.length} رویداد</span>
        </div>
        <div class="p-4 max-h-96 overflow-y-auto">
          ${allLogs.length===0
            ?`<div class="flex flex-col items-center py-12 text-gray-400">
               <i class="fas fa-history text-5xl opacity-20 mb-3"></i><p class="text-sm">تاریخچه‌ای ثبت نشده</p></div>`
            :`<div class="relative pr-4">
               <div class="absolute right-1.5 top-0 bottom-0 w-0.5 bg-gray-200"></div>
               ${allLogs.map(l=>{const c=logCfg[l.type]||logCfg.default;return`
               <div class="relative flex gap-4 mb-4 last:mb-0">
                 <div class="absolute -right-2 top-1 w-4 h-4 rounded-full ${c.bg} border-2 border-white shadow flex items-center justify-center">
                   <i class="fas ${c.icon} ${c.color} text-[8px]"></i></div>
                 <div class="${c.bg} rounded-xl p-3 flex-1 mr-4 border border-gray-100">
                   <div class="flex items-start justify-between gap-2">
                     <p class="text-sm text-gray-800 font-medium leading-snug">${esc(l.message||'')}</p>
                     <span class="text-[10px] text-gray-400 flex-shrink-0 mt-0.5">${fmtDate(l.timestamp)}</span>
                   </div>
                   ${l.notes?`<p class="text-xs text-gray-500 mt-1">${esc(l.notes)}</p>`:''}
                   ${l.by?`<p class="text-[10px] text-gray-400 mt-1"><i class="fas fa-user text-[8px] ml-1"></i>${esc(l.by)}</p>`:''}
                 </div>
               </div>`;}).join('')}
             </div>`}
        </div>
      </div>
      ${(canManage(userRole)||userRole==='agent')?`
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2">
            <i class="fas fa-plus-circle text-[#8FBF3F]"></i>افزودن یادداشت
          </h4>
        </div>
        <div class="p-4 flex gap-3">
          <textarea id="hist-note" rows="2" placeholder="یادداشت جدید..."
            class="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#8FBF3F] outline-none resize-none"></textarea>
          <button onclick="OrderDetailRedesign.addNote('${esc(order.id)}')"
            class="bg-[#8FBF3F] hover:bg-[#7aac2e] text-white px-4 rounded-xl text-sm font-medium self-end py-2 flex-shrink-0">
            <i class="fas fa-plus"></i>
          </button>
        </div>
      </div>`:''}
    </div>`;
  }

  // ── تب مالی ──────────────────────────────────────────────────
  function renderFinancialTab(order, userRole) {
    const currency = esc(order.currency||'تومان');
    const total    = parseFloat(order.totalAmount||order.cost||0);
    const paid     = parseFloat(order.paidAmount||0);
    const remaining = Math.max(0,total-paid);
    const paidPct  = total>0?Math.min(100,Math.round(paid/total*100)):0;
    const agentPct = parseFloat(order.revenueAgentPercent||60);
    const mgrPct   = parseFloat(order.revenueManagerPercent||40);
    const pst = PAYMENT_STATUS[order.paymentStatus]||PAYMENT_STATUS.unpaid;
    const payLogs = (order.workLog||[]).filter(l=>l.type==='payment');

    return `
    <div class="space-y-5">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        ${[{label:'مبلغ کل',val:`${fmt(total)} ${currency}`,icon:'fa-coins',bg:'bg-gray-50',tc:'text-gray-800'},
           {label:'پرداخت شده',val:`${fmt(paid)} ${currency}`,icon:'fa-check-circle',bg:'bg-green-50',tc:'text-green-700'},
           {label:'مانده',val:`${fmt(remaining)} ${currency}`,icon:'fa-hourglass-half',bg:'bg-red-50',tc:'text-red-700'},
           {label:'وضعیت',val:pst.label,icon:'fa-credit-card',bg:pst.cls,tc:''},
          ].map(c=>`<div class="${c.bg} rounded-xl border border-gray-100 p-4 text-center shadow-sm">
            <i class="fas ${c.icon} text-xl mb-2 block ${c.tc||'text-gray-500'}"></i>
            <p class="text-xs text-gray-500 mb-1">${c.label}</p>
            <p class="text-sm font-black ${c.tc}">${c.val}</p>
          </div>`).join('')}
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div class="flex justify-between items-center mb-2">
          <span class="text-sm font-semibold text-gray-700">میزان پرداخت</span>
          <span class="text-sm font-bold text-[#5a7a28]">${paidPct}٪</span>
        </div>
        <div class="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div class="${paidPct>=100?'bg-green-500':paidPct>=50?'bg-amber-400':'bg-red-400'} h-3 rounded-full" style="width:${paidPct}%"></div>
        </div>
        <div class="flex justify-between text-xs text-gray-400 mt-1">
          <span>پرداخت: ${fmt(paid)} ${currency}</span>
          <span>مانده: ${fmt(remaining)} ${currency}</span>
        </div>
      </div>
      ${canManage(userRole)?`
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2"><i class="fas fa-plus-circle text-green-600"></i>ثبت پرداخت جدید</h4>
        </div>
        <div class="p-4">
          <div class="flex gap-2 flex-wrap">
            <input type="number" id="fin-pay-amount" placeholder="مبلغ پرداختی" min="0"
              class="flex-1 min-w-[140px] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8FBF3F] outline-none">
            <select id="fin-pay-currency" class="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#8FBF3F] outline-none">
              <option>تومان</option><option>دلار</option>
            </select>
            <input type="text" id="fin-pay-note" placeholder="یادداشت (اختیاری)"
              class="flex-1 min-w-[140px] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8FBF3F] outline-none">
            <button onclick="OrderDetailRedesign.addPayment('${esc(order.id)}')"
              class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
              <i class="fas fa-check"></i>ثبت</button>
          </div>
        </div>
      </div>`:''}
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2"><i class="fas fa-list-alt text-[#8FBF3F]"></i>تاریخچه پرداخت‌ها</h4>
        </div>
        <div class="p-4">
          ${payLogs.length===0
            ?`<p class="text-sm text-gray-400 text-center py-4">پرداختی ثبت نشده</p>`
            :`<div class="space-y-2">${payLogs.map(l=>`
            <div class="flex items-center gap-3 bg-green-50 border border-green-100 rounded-lg p-3">
              <i class="fas fa-coins text-green-500 text-sm flex-shrink-0"></i>
              <div class="flex-1"><p class="text-sm text-gray-800">${esc(l.message||'')}</p>
                ${l.notes?`<p class="text-xs text-gray-500">${esc(l.notes)}</p>`:''}</div>
              <span class="text-xs text-gray-400 flex-shrink-0">${fmtDate(l.timestamp)}</span>
            </div>`).join('')}</div>`}
        </div>
      </div>
    </div>`;
  }

  // ── تب تخصیص عامل ────────────────────────────────────────────
  function renderAssignmentTab(order, userRole) {
    const allUsers = getUsers();
    const agents = allUsers.filter(u=>u.role==='agent');
    const currentAgentId = order.assignedDoctorId||order.assignedAgentId||null;
    const currentAgent = agents.find(a=>a.id===currentAgentId);
    const currency = esc(order.currency||'تومان');
    const total = parseFloat(order.totalAmount||order.cost||0);
    const agentPct = parseFloat(order.revenueAgentPercent||60);
    const assignLogs = (order.workLog||[]).filter(l=>l.type==='assignment');

    const agentCard = (agent, isActive) => `
      <div onclick="${canManage(userRole)?`OrderDetailRedesign.assignAgent('${esc(order.id)}','${esc(agent.id)}')`:'return'}"
        class="flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${canManage(userRole)?'cursor-pointer':'cursor-default'}
          ${isActive?'border-[#8FBF3F] bg-[#f3f9e8] shadow-sm':'border-gray-200 bg-white hover:border-[#8FBF3F] hover:bg-[#f9fdf0]'}">
        <div class="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0 ${isActive?'bg-[#8FBF3F] text-white':'bg-gray-200 text-gray-600'}">
          ${esc(agent.name).charAt(0)}</div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-gray-800 truncate">${esc(agent.name)}</p>
          <p class="text-xs text-gray-400 truncate">${esc(agent.specialization||agent.department||'')}</p>
        </div>
        ${isActive?`<i class="fas fa-check-circle text-[#8FBF3F] text-lg flex-shrink-0"></i>`:''}
      </div>`;

    return `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2"><i class="fas fa-user-tie text-[#8FBF3F]"></i>عامل فعلی</h4>
        </div>
        <div class="p-4">
          ${currentAgent?`
          <div class="flex items-center gap-4 bg-[#f3f9e8] border border-[#d4edaa] rounded-xl p-4">
            <div class="w-14 h-14 rounded-full bg-[#8FBF3F] text-white flex items-center justify-center text-2xl font-black shadow-sm">
              ${esc(currentAgent.name).charAt(0)}</div>
            <div class="flex-1">
              <p class="text-base font-bold text-gray-800">${esc(currentAgent.name)}</p>
              ${currentAgent.specialization?`<p class="text-sm text-gray-500">${esc(currentAgent.specialization)}</p>`:''}
              <div class="mt-2 flex items-center gap-2">
                <span class="text-xs bg-white border border-[#8FBF3F] text-[#5a7a28] px-2 py-0.5 rounded-full">
                  سهم: ${fmt(total*agentPct/100)} ${currency}</span>
                <span class="text-xs bg-white border border-gray-200 text-gray-500 px-2 py-0.5 rounded-full">${agentPct}٪</span>
              </div>
            </div>
          </div>
          ${canManage(userRole)?`
          <button onclick="OrderDetailRedesign.assignAgent('${esc(order.id)}','')"
            class="mt-3 w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 py-2 rounded-lg text-xs font-medium">
            <i class="fas fa-user-minus ml-1"></i>حذف تخصیص</button>`:''}
          `:`
          <div class="flex flex-col items-center justify-center py-8 text-gray-400">
            <i class="fas fa-user-slash text-4xl mb-3 opacity-30"></i>
            <p class="text-sm">عاملی تخصیص نیافته</p>
          </div>`}
        </div>
      </div>
      ${canManage(userRole)?`
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2"><i class="fas fa-sticky-note text-[#8FBF3F]"></i>یادداشت تخصیص</h4>
        </div>
        <div class="p-4 space-y-3">
          <textarea id="asgn-notes" rows="4" placeholder="یادداشت یا توضیحات..."
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8FBF3F] outline-none resize-none">${esc(order.assignmentNotes||'')}</textarea>
          <button onclick="OrderDetailRedesign.saveAssignmentNotes('${esc(order.id)}')"
            class="w-full bg-[#8FBF3F] hover:bg-[#7aac2e] text-white py-2 rounded-lg text-sm font-medium">
            <i class="fas fa-save ml-1"></i>ذخیره یادداشت</button>
        </div>
      </div>
      <div class="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2"><i class="fas fa-users text-[#8FBF3F]"></i>انتخاب عامل</h4>
          <span class="text-xs text-gray-400">${agents.length} عامل</span>
        </div>
        <div class="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          ${agents.length===0
            ?`<p class="col-span-full text-center text-gray-400 text-sm py-4">عاملی تعریف نشده</p>`
            :agents.map(a=>agentCard(a,a.id===currentAgentId)).join('')}
        </div>
      </div>`:''}
      <div class="${canManage(userRole)?'':'lg:col-span-2'} bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2"><i class="fas fa-history text-[#8FBF3F]"></i>تاریخچه تخصیص</h4>
        </div>
        <div class="p-4 max-h-48 overflow-y-auto">
          ${assignLogs.length===0
            ?`<p class="text-sm text-gray-400 text-center py-4">تاریخچه‌ای موجود نیست</p>`
            :`<div class="space-y-2">${assignLogs.slice().reverse().map(l=>`
            <div class="flex items-start gap-2 text-sm">
              <i class="fas fa-user-check text-[#8FBF3F] mt-0.5 text-xs flex-shrink-0"></i>
              <div class="flex-1"><p class="text-gray-700">${esc(l.message||'')}</p>
                ${l.notes?`<p class="text-xs text-gray-400">${esc(l.notes)}</p>`:''}</div>
              <span class="text-xs text-gray-400 flex-shrink-0">${fmtDate(l.timestamp)}</span>
            </div>`).join('')}</div>`}
        </div>
      </div>
    </div>`;
  }

  // ── تب اضافه کردن کارمند به سفارش ────────────────────────────
  function renderAddEmployeeTab(order, userRole) {
    const allUsers = getUsers();
    const employees = allUsers.filter(u=>u.role==='employee'&&u.active!==false);
    const assignedEmps = Array.isArray(order.assignedEmployees) ? order.assignedEmployees : [];

    const empCard = (emp) => {
      const isAssigned = assignedEmps.some(e=>e.id===emp.id);
      return `
      <div class="flex items-center gap-3 p-3 rounded-xl border-2 transition-all
        ${isAssigned?'border-indigo-400 bg-indigo-50':'border-gray-200 bg-white hover:border-indigo-300'}">
        <div class="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0 ${isAssigned?'bg-indigo-500 text-white':'bg-gray-200 text-gray-600'}">
          ${esc(emp.name).charAt(0)}</div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-gray-800 truncate">${esc(emp.name)}</p>
          <p class="text-xs text-gray-400 truncate">${esc(emp.department||emp.email||'')}</p>
        </div>
        ${isAssigned
          ?`<button onclick="OrderDetailRedesign.removeEmployee('${esc(order.id)}','${esc(emp.id)}')"
              class="text-xs bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-2 py-1 rounded-lg flex-shrink-0">
              <i class="fas fa-minus ml-1"></i>حذف</button>`
          :`<button onclick="OrderDetailRedesign.addEmployee('${esc(order.id)}','${esc(emp.id)}')"
              class="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 px-2 py-1 rounded-lg flex-shrink-0">
              <i class="fas fa-plus ml-1"></i>اضافه</button>`}
      </div>`;
    };

    const empLogs = (order.workLog||[]).filter(l=>l.type==='employee_added'||l.type==='employee_removed');

    return `
    <div class="space-y-5">
      <!-- کارمندان تخصیص‌یافته -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2">
            <i class="fas fa-users text-indigo-500"></i>کارمندان این سفارش
          </h4>
          <span class="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">${assignedEmps.length} نفر</span>
        </div>
        <div class="p-4">
          ${assignedEmps.length===0
            ?`<p class="text-sm text-gray-400 text-center py-6"><i class="fas fa-users text-3xl block mb-2 opacity-20"></i>هنوز کارمندی اضافه نشده</p>`
            :`<div class="space-y-2">
               ${assignedEmps.map(e=>`
               <div class="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                 <div class="w-9 h-9 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold flex-shrink-0">
                   ${esc(e.name||'?').charAt(0)}</div>
                 <div class="flex-1 min-w-0">
                   <p class="text-sm font-semibold text-gray-800">${esc(e.name||'')}</p>
                   <p class="text-xs text-gray-500">${esc(e.role||'کارمند')} — اضافه شده: ${fmtDate(e.assignedAt)}</p>
                 </div>
                 <button onclick="OrderDetailRedesign.removeEmployee('${esc(order.id)}','${esc(e.id)}')"
                   class="text-xs bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-2 py-1 rounded-lg flex-shrink-0">
                   <i class="fas fa-user-minus ml-1"></i>حذف</button>
               </div>`).join('')}
             </div>`}
        </div>
      </div>

      <!-- لیست کارمندان برای انتخاب -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2">
            <i class="fas fa-user-plus text-[#8FBF3F]"></i>افزودن کارمند به سفارش
          </h4>
          <span class="text-xs text-gray-400">${employees.length} کارمند</span>
        </div>
        <div class="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          ${employees.length===0
            ?`<p class="col-span-full text-center text-gray-400 text-sm py-4">کارمندی تعریف نشده</p>`
            :employees.map(e=>empCard(e)).join('')}
        </div>
      </div>

      <!-- تاریخچه تغییرات کارمند -->
      ${empLogs.length>0?`
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2"><i class="fas fa-history text-[#8FBF3F]"></i>تاریخچه</h4>
        </div>
        <div class="p-4 space-y-2 max-h-48 overflow-y-auto">
          ${empLogs.slice().reverse().map(l=>`
          <div class="flex items-center gap-2 text-sm">
            <i class="fas fa-user-plus text-indigo-400 text-xs flex-shrink-0"></i>
            <p class="flex-1 text-gray-700">${esc(l.message||'')}</p>
            <span class="text-xs text-gray-400 flex-shrink-0">${fmtDate(l.timestamp)}</span>
          </div>`).join('')}
        </div>
      </div>`:''}
    </div>`;
  }

  // ── مودال اصلی ───────────────────────────────────────────────
  function getTabContent(order, userRole, tab) {
    switch(tab) {
      case 'overview':    return renderOverviewTab(order, userRole);
      case 'mywork':      return renderMyWorkTab(order, userRole);
      case 'files':       return renderFilesTab(order, userRole);
      case 'history':     return renderHistoryTab(order, userRole);
      case 'financial':   return renderFinancialTab(order, userRole);
      case 'assignment':  return renderAssignmentTab(order, userRole);
      case 'addemployee': return renderAddEmployeeTab(order, userRole);
      default:            return renderOverviewTab(order, userRole);
    }
  }

  function renderModal(order, userRole, activeTab) {
    return `
    <div id="odr-modal-overlay"
      class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3"
      onclick="if(event.target===this)OrderDetailRedesign.close()">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden">
        ${renderHeader(order, userRole)}
        ${renderTabBar(activeTab, userRole)}
        <div class="flex-1 overflow-y-auto p-5 bg-gray-50" id="odr-tab-content">
          ${getTabContent(order, userRole, activeTab)}
        </div>
        <div class="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-white flex-shrink-0">
          <div class="flex items-center gap-2 text-xs text-gray-400">
            <i class="fas fa-clock"></i>
            آخرین بروزرسانی: ${fmtDate(order.updatedAt||order.createdAt)}
          </div>
          <button onclick="OrderDetailRedesign.close()"
            class="bg-gray-200 hover:bg-gray-300 text-gray-700 px-5 py-2 rounded-xl text-sm font-medium transition-colors">
            <i class="fas fa-times ml-1"></i>بستن
          </button>
        </div>
      </div>
    </div>`;
  }

  // ── PUBLIC: show() — FIX: user حتماً قبل از استفاده تعریف می‌شود ──
  function show(orderId) {
    const user = currentUser();                          // ← FIX: اول تعریف
    const userRole = user.role || 'manager';
    const orders = getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) { notify('سفارش یافت نشد', 'error'); return; }

    _orderId   = orderId;
    _activeTab = (userRole === 'agent') ? 'mywork' : 'overview';  // ← FIX: حالا درست کار می‌کند

    const old = document.getElementById('odr-modal-overlay');
    if (old) old.remove();

    let container = document.getElementById('odr-modal-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'odr-modal-container';
      document.body.appendChild(container);
    }
    container.innerHTML = renderModal(order, userRole, _activeTab);

    document._odrEscHandler = (e) => { if(e.key==='Escape') close(); };
    document.addEventListener('keydown', document._odrEscHandler);
  }

  function close() {
    const overlay = document.getElementById('odr-modal-overlay');
    if (overlay) {
      overlay.style.transition = 'opacity 0.2s';
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 200);
    }
    if (document._odrEscHandler) {
      document.removeEventListener('keydown', document._odrEscHandler);
      delete document._odrEscHandler;
    }
  }

  function switchTab(tabId) {
    _activeTab = tabId;
    TABS.forEach(t => {
      const btn = document.getElementById(`odr-tab-btn-${t.id}`);
      if (!btn) return;
      btn.classList.remove('border-[#8FBF3F]','text-[#5a7a28]','border-transparent','text-gray-500','hover:text-gray-700','hover:border-gray-300');
      if (t.id === tabId) {
        btn.classList.add('border-[#8FBF3F]','text-[#5a7a28]');
      } else {
        btn.classList.add('border-transparent','text-gray-500','hover:text-gray-700','hover:border-gray-300');
      }
    });
    const contentEl = document.getElementById('odr-tab-content');
    if (!contentEl) return;
    const orders = getOrders();
    const order = orders.find(o=>o.id===_orderId);
    if (!order) return;
    const user = currentUser();
    contentEl.innerHTML = getTabContent(order, user.role||'manager', tabId);
  }

  function _reload() { if (_orderId) show(_orderId); }

  // ── توابع عملیاتی ────────────────────────────────────────────
  function quickAction(orderId, newStatus) {
    const labels = {in_progress:'شروع کار',completed:'تکمیل',cancelled:'لغو'};
    if (!confirm(`آیا از "${labels[newStatus]||newStatus}" اطمینان دارید؟`)) return;
    const orders = getOrders();
    const idx = orders.findIndex(o=>o.id===orderId);
    if (idx===-1) return;
    const user = currentUser();
    orders[idx] = {
      ...orders[idx], status: newStatus, updatedAt: new Date().toISOString(),
      ...(newStatus==='completed'?{progress:100,completedAt:new Date().toISOString()}:{}),
      workLog: [...(orders[idx].workLog||[]), {
        id: Date.now().toString(36), type:'status_change',
        message:`وضعیت به "${STATUS[newStatus]?.label||newStatus}" تغییر یافت`,
        timestamp: new Date().toISOString(), by: user.name||'',
      }],
    };
    saveOrders(orders);
    notify(`وضعیت تغییر کرد ✓`, 'success');
    _reload();
  }

  function updateProgress(orderId, value) {
    const pct = Math.min(100, Math.max(0, parseInt(value)||0));
    const orders = getOrders();
    const idx = orders.findIndex(o=>o.id===orderId);
    if (idx===-1) return;
    orders[idx].progress = pct;
    orders[idx].updatedAt = new Date().toISOString();
    saveOrders(orders);
    notify(`پیشرفت: ${pct}٪ ✓`, 'success');
  }

  function addPayment(orderId) {
    const amount = parseFloat(document.getElementById('fin-pay-amount')?.value);
    const currency = document.getElementById('fin-pay-currency')?.value||'تومان';
    const note = document.getElementById('fin-pay-note')?.value?.trim()||'';
    if (!amount||amount<=0) { notify('مبلغ معتبر وارد کنید','error'); return; }
    const orders = getOrders();
    const idx = orders.findIndex(o=>o.id===orderId);
    if (idx===-1) return;
    const newPaid = (parseFloat(orders[idx].paidAmount)||0) + amount;
    const total = parseFloat(orders[idx].totalAmount||orders[idx].cost)||0;
    const user = currentUser();
    orders[idx] = { ...orders[idx], paidAmount: newPaid,
      paymentStatus: newPaid>=total?'paid':'partial',
      updatedAt: new Date().toISOString(),
      workLog: [...(orders[idx].workLog||[]), {
        id: Date.now().toString(36), type:'payment',
        message:`پرداخت ${amount.toLocaleString('fa-IR')} ${currency} ثبت شد`,
        notes: note, timestamp: new Date().toISOString(), by: user.name||'',
      }],
    };
    saveOrders(orders);
    notify(`پرداخت ثبت شد ✓`, 'success');
    _reload();
  }

  function saveRevenueSplit(orderId) {
    const ap = parseFloat(document.getElementById('fin-agent-pct')?.value)||60;
    const mp = parseFloat(document.getElementById('fin-mgr-pct')?.value)||40;
    if (Math.abs(ap+mp-100)>0.01) { notify('جمع درصدها باید ۱۰۰ باشد','error'); return; }
    const orders = getOrders();
    const idx = orders.findIndex(o=>o.id===orderId);
    if (idx===-1) return;
    orders[idx] = { ...orders[idx], revenueAgentPercent:ap, revenueManagerPercent:mp, updatedAt:new Date().toISOString() };
    saveOrders(orders);
    notify('درصد تقسیم ذخیره شد ✓','success');
    _reload();
  }

  function assignAgent(orderId, agentId) {
    const orders = getOrders();
    const idx = orders.findIndex(o=>o.id===orderId);
    if (idx===-1) return;
    const agentObj = agentId ? getUsers().find(u=>u.id===agentId) : null;
    const user = currentUser();
    orders[idx] = { ...orders[idx],
      assignedDoctorId: agentId||null, assignedAgentId: agentId||null,
      assignedDoctor: agentObj?agentObj.name:null,
      assignedAt: agentId?new Date().toISOString():null,
      updatedAt: new Date().toISOString(),
      workLog: [...(orders[idx].workLog||[]), {
        id:Date.now().toString(36), type:'assignment',
        message: agentObj?`سفارش به ${agentObj.name} تخصیص داده شد`:'تخصیص عامل لغو شد',
        timestamp: new Date().toISOString(), by: user.name||'',
      }],
    };
    saveOrders(orders);
    notify(agentObj?`تخصیص به ${agentObj.name} ✓`:'تخصیص لغو شد','success');
    _reload();
  }

  function saveAssignmentNotes(orderId) {
    const notes = document.getElementById('asgn-notes')?.value?.trim()||'';
    const orders = getOrders();
    const idx = orders.findIndex(o=>o.id===orderId);
    if (idx===-1) return;
    orders[idx] = { ...orders[idx], assignmentNotes:notes, updatedAt:new Date().toISOString() };
    saveOrders(orders);
    notify('یادداشت ذخیره شد ✓','success');
  }

  function addNote(orderId) {
    const text = document.getElementById('hist-note')?.value?.trim();
    if (!text) { notify('یادداشت خالی است','error'); return; }
    const orders = getOrders();
    const idx = orders.findIndex(o=>o.id===orderId);
    if (idx===-1) return;
    const user = currentUser();
    orders[idx].workLog = [...(orders[idx].workLog||[]), {
      id:Date.now().toString(36), type:'note',
      message:text, timestamp:new Date().toISOString(), by:user.name||'',
    }];
    orders[idx].updatedAt = new Date().toISOString();
    saveOrders(orders);
    notify('یادداشت ثبت شد ✓','success');
    switchTab('history');
  }

  function addEmployee(orderId, empId) {
    const empObj = getUsers().find(u=>u.id===empId);
    if (!empObj) return;
    const orders = getOrders();
    const idx = orders.findIndex(o=>o.id===orderId);
    if (idx===-1) return;
    if (!orders[idx].assignedEmployees) orders[idx].assignedEmployees = [];
    if (orders[idx].assignedEmployees.some(e=>e.id===empId)) {
      notify('این کارمند قبلاً اضافه شده','warning'); return;
    }
    const user = currentUser();
    orders[idx].assignedEmployees.push({ id:empObj.id, name:empObj.name, role:'employee', assignedAt:new Date().toISOString() });
    orders[idx].workLog = [...(orders[idx].workLog||[]), {
      id:Date.now().toString(36), type:'employee_added',
      message:`کارمند "${empObj.name}" به سفارش اضافه شد`,
      timestamp:new Date().toISOString(), by:user.name||'',
    }];
    orders[idx].updatedAt = new Date().toISOString();
    saveOrders(orders);
    notify(`${empObj.name} اضافه شد ✓`,'success');
    switchTab('addemployee');
  }

  function removeEmployee(orderId, empId) {
    const orders = getOrders();
    const idx = orders.findIndex(o=>o.id===orderId);
    if (idx===-1) return;
    const emp = (orders[idx].assignedEmployees||[]).find(e=>e.id===empId);
    orders[idx].assignedEmployees = (orders[idx].assignedEmployees||[]).filter(e=>e.id!==empId);
    const user = currentUser();
    orders[idx].workLog = [...(orders[idx].workLog||[]), {
      id:Date.now().toString(36), type:'employee_removed',
      message:`کارمند "${emp?.name||empId}" از سفارش حذف شد`,
      timestamp:new Date().toISOString(), by:user.name||'',
    }];
    orders[idx].updatedAt = new Date().toISOString();
    saveOrders(orders);
    notify('کارمند حذف شد','warning');
    switchTab('addemployee');
  }

  // ── آپلود فایل (عمومی) ───────────────────────────────────────
  function uploadFile(orderId) {
    const fileInput = document.getElementById('file-input-odr');
    const fileType  = document.getElementById('file-type-sel')?.value;
    const file = fileInput?.files?.[0];
    if (!fileType) { notify('نوع فایل را انتخاب کنید','error'); return; }
    if (!file)     { notify('فایلی انتخاب نشده','error'); return; }
    if (file.size > 10*1024*1024) { notify('حجم فایل بیشتر از ۱۰ مگابایت','error'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const orders = getOrders();
      const idx = orders.findIndex(o=>o.id===orderId);
      if (idx===-1) return;
      const user = currentUser();
      const newFile = {
        id:'f_'+Date.now(), name:file.name, fileType, size:file.size,
        url:ev.target.result, uploadedBy:user.id, uploadedByName:user.name||'',
        uploadedAt:new Date().toISOString(), reviewStatus:'pending', reviewVersion:1,
      };
      if (!orders[idx].files) orders[idx].files = [];
      orders[idx].files.push(newFile);
      orders[idx].workLog = [...(orders[idx].workLog||[]), {
        id:Date.now().toString(36), type:'file_upload',
        message:`فایل "${file.name}" (${fileType}) آپلود شد`,
        timestamp:new Date().toISOString(), by:user.name||'',
      }];
      orders[idx].updatedAt = new Date().toISOString();
      saveOrders(orders);
      notify(`فایل "${file.name}" آپلود شد ✓`,'success');
      switchTab('files');
    };
    reader.readAsDataURL(file);
  }

  function handleFileDrop(event, orderId) {
    event.preventDefault();
    const dz = document.getElementById('file-drop-zone');
    if (dz) dz.classList.remove('border-[#8FBF3F]','bg-[#f9fdf0]');
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    const fi = document.getElementById('file-input-odr');
    if (fi) { const dt=new DataTransfer(); dt.items.add(file); fi.files=dt.files; }
    notify(`فایل "${file.name}" انتخاب شد — نوع را تعیین و آپلود کنید`,'info');
  }

  function deleteFile(orderId, fileId) {
    if (!confirm('آیا از حذف این فایل اطمینان دارید؟')) return;
    const orders = getOrders();
    const idx = orders.findIndex(o=>o.id===orderId);
    if (idx===-1) return;
    orders[idx].files = (orders[idx].files||[]).filter(f=>f.id!==fileId);
    orders[idx].updatedAt = new Date().toISOString();
    saveOrders(orders);
    notify('فایل حذف شد','warning');
    switchTab('files');
  }

  // ── بررسی فایل توسط کارمند ───────────────────────────────────
  function showFileReview(orderId, fileId) {
    document.getElementById('review-file-id').value = fileId;
    document.getElementById('review-comment').value = '';
    const panel = document.getElementById('file-review-panel');
    if (panel) { panel.classList.remove('hidden'); panel.scrollIntoView({behavior:'smooth',block:'nearest'}); }
  }

  function submitFileReview(orderId) {
    const fileId  = document.getElementById('review-file-id')?.value;
    const status  = document.querySelector('input[name="review-status"]:checked')?.value||'rejected';
    const comment = document.getElementById('review-comment')?.value?.trim()||'';
    if (status==='rejected'&&!comment) { notify('لطفاً توضیحات اصلاحات را بنویسید','error'); return; }
    const orders = getOrders();
    const idx = orders.findIndex(o=>o.id===orderId);
    if (idx===-1) return;
    const fileIdx = (orders[idx].files||[]).findIndex(f=>f.id===fileId);
    if (fileIdx===-1) return;
    const f = orders[idx].files[fileIdx];
    const user = currentUser();

    // بررسی آیا فایل جدیدی برای بازگذاری انتخاب شده
    const reuploadInput = document.getElementById('review-reupload-file');
    const reuploadFile  = reuploadInput?.files?.[0];

    const doSave = (reuploadUrl) => {
      orders[idx].files[fileIdx] = {
        ...f,
        reviewStatus:  status,
        reviewComment: comment,
        reviewedAt:    new Date().toISOString(),
        reviewedBy:    user.name||'',
        ...(reuploadUrl ? { url: reuploadUrl, name: reuploadFile.name, size: reuploadFile.size, reviewVersion: (f.reviewVersion||1) } : {}),
      };
      orders[idx].workLog = [...(orders[idx].workLog||[]), {
        id:Date.now().toString(36), type:'file_review',
        message:`فایل "${reuploadFile?reuploadFile.name:f.name}" ${status==='approved'?'تأیید شد':'نیاز به اصلاح دارد'}${comment?': '+comment:''}${reuploadUrl?' (فایل جدید جایگزین شد)':''}`,
        timestamp:new Date().toISOString(), by:user.name||'',
      }];
      orders[idx].updatedAt = new Date().toISOString();
      saveOrders(orders);
      if (reuploadInput) reuploadInput.value = '';
      notify(status==='approved'?'فایل تأیید شد ✓':'اصلاحات ثبت شد — عامل مطلع خواهد شد','success');
      switchTab('files');
    };

    if (reuploadFile) {
      if (reuploadFile.size > 10*1024*1024) { notify('حجم فایل بیشتر از ۱۰ مگابایت','error'); return; }
      const reader = new FileReader();
      reader.onload = ev => doSave(ev.target.result);
      reader.readAsDataURL(reuploadFile);
    } else {
      doSave(null);
    }
  }

  // ── آپلود فایل توسط عامل ─────────────────────────────────────
  function uploadMyFile(orderId) {
    const fileInput = document.getElementById('mw-file-input');
    const fileType  = document.getElementById('mw-file-type')?.value||'سایر';
    const revisionOf= document.getElementById('mw-revision-of')?.value||null;
    const file = fileInput?.files?.[0];
    if (!file) { notify('لطفاً فایل انتخاب کنید','error'); return; }
    if (file.size > 10*1024*1024) { notify('حجم فایل بیشتر از ۱۰ مگابایت','error'); return; }
    const user = currentUser();
    const reader = new FileReader();
    reader.onload = (ev) => {
      const orders = getOrders();
      const idx = orders.findIndex(o=>o.id===orderId);
      if (idx===-1) { notify('سفارش یافت نشد','error'); return; }

      // اگر این ویرایش فایل قبلی است، نسخه را افزایش بده
      let reviewVersion = 1;
      if (revisionOf) {
        const origFile = (orders[idx].files||[]).find(f=>f.id===revisionOf);
        if (origFile) reviewVersion = (origFile.reviewVersion||1) + 1;
      }

      const newFile = {
        id:'f_'+Date.now(), name:file.name, fileType, size:file.size,
        url:ev.target.result, uploadedBy:user.id, uploadedByName:user.name||'عامل',
        uploadedAt:new Date().toISOString(), isAgentFile:true,
        reviewStatus:'pending', reviewVersion, revisionOf:revisionOf||null,
      };
      orders[idx].files = [...(orders[idx].files||[]), newFile];
      orders[idx].workLog = [...(orders[idx].workLog||[]), {
        id:Date.now().toString(36), type:'file_upload',
        message:`فایل${revisionOf?` اصلاح شده (ویرایش ${reviewVersion})`:''}: ${file.name}`,
        by:user.id, byName:user.name||'عامل', timestamp:new Date().toISOString(),
      }];
      orders[idx].updatedAt = new Date().toISOString();
      saveOrders(orders);
      if (fileInput) fileInput.value='';
      notify('✅ فایل آپلود شد','success');
      switchTab('mywork');
    };
    reader.readAsDataURL(file);
  }

  function addMyNote(orderId) {
    const ta = document.getElementById('mw-note');
    const msg = ta?.value?.trim();
    if (!msg) { notify('یادداشت خالی است','error'); return; }
    const user = currentUser();
    const orders = getOrders();
    const idx = orders.findIndex(o=>o.id===orderId);
    if (idx===-1) return;
    orders[idx].workLog = [...(orders[idx].workLog||[]), {
      id:Date.now().toString(36), type:'note', message:msg,
      by:user.id, byName:user.name||'عامل', timestamp:new Date().toISOString(),
    }];
    orders[idx].updatedAt = new Date().toISOString();
    saveOrders(orders);
    if (ta) ta.value='';
    notify('✅ یادداشت ثبت شد','success');
    switchTab('mywork');
  }

  function printOrder(orderId) {
    const orders = getOrders();
    const order = orders.find(o=>o.id===orderId);
    if (!order) return;
    const currency = order.currency||'تومان';
    const win = window.open('','_blank');
    win.document.write(`<!DOCTYPE html><html dir="rtl" lang="fa">
    <head><meta charset="UTF-8"><title>سفارش ${String(orderId).slice(-8)}</title>
    <style>body{font-family:Tahoma,sans-serif;padding:30px;color:#333;direction:rtl}
    h1{font-size:20px;border-bottom:2px solid #8FBF3F;padding-bottom:8px;color:#5a7a28}
    table{width:100%;border-collapse:collapse;margin-top:16px}
    td{padding:8px 12px;border:1px solid #e5e7eb;font-size:13px}
    td:first-child{background:#f9fdf0;font-weight:600;width:30%}
    @media print{body{padding:10px}}</style></head><body>
    <h1>جزئیات سفارش</h1>
    <table>
      <tr><td>شماره</td><td><code>${String(orderId).slice(-8).toUpperCase()}</code></td></tr>
      <tr><td>نام دانشجو</td><td>${order.studentName||'---'}</td></tr>
      <tr><td>دانشگاه</td><td>${order.university||'---'}</td></tr>
      <tr><td>رشته</td><td>${order.field||'---'}</td></tr>
      <tr><td>نوع کار</td><td>${order.type||'---'}</td></tr>
      <tr><td>وضعیت</td><td>${STATUS[order.status]?.label||order.status||'---'}</td></tr>
      <tr><td>مبلغ</td><td>${(parseFloat(order.totalAmount||0)).toLocaleString('fa-IR')} ${currency}</td></tr>
      <tr><td>پرداخت</td><td>${(parseFloat(order.paidAmount||0)).toLocaleString('fa-IR')} ${currency}</td></tr>
      <tr><td>عامل</td><td>${order.assignedDoctor||'---'}</td></tr>
      <tr><td>مهلت</td><td>${order.deadline||'---'}</td></tr>
      <tr><td>تاریخ ثبت</td><td>${fmtDate(order.createdAt)}</td></tr>
      ${order.description?`<tr><td>توضیحات</td><td>${order.description}</td></tr>`:''}
    </table>
    <p style="margin-top:30px;font-size:11px;color:#999;text-align:center">
      تاریخ چاپ: ${new Date().toLocaleDateString('fa-IR')}</p>
    <script>window.onload=()=>window.print()<\/script>
    </body></html>`);
    win.document.close();
  }

  // ── Export ────────────────────────────────────────────────────
  return {
    show, close, switchTab,
    quickAction, updateProgress,
    addPayment, saveRevenueSplit,
    assignAgent, saveAssignmentNotes,
    addNote, addEmployee, removeEmployee,
    uploadFile, handleFileDrop, deleteFile,
    showFileReview, submitFileReview,
    uploadMyFile, addMyNote,
    printOrder,
  };

})();

// ── Patch روی OrderPagesModule ────────────────────────────────
(function patchOrderPages() {
  const patch = () => {
    if (typeof window.OrderPagesModule !== 'undefined') {
      window.OrderPagesModule.showOrderPage = (id) => OrderDetailRedesign.show(id);
      console.log('✅ OrderDetailRedesign: OrderPagesModule patched');
    }
    if (typeof window.OrdersRedesign !== 'undefined') {
      window.OrdersRedesign.openDetail = (id) => OrderDetailRedesign.show(id);
    }
    if (typeof window.OrdersModule !== 'undefined' && window.OrdersModule.viewDetails) {
      window.OrdersModule._origViewDetails = window.OrdersModule.viewDetails;
      window.OrdersModule.viewDetails = (id) => OrderDetailRedesign.show(id);
    }
  };
  if (document.readyState==='loading') {
    document.addEventListener('DOMContentLoaded', ()=>setTimeout(patch,150));
  } else {
    setTimeout(patch, 150);
  }
})();

window.OrderDetailRedesign = OrderDetailRedesign;
console.log('✅ order-detail-redesign.js بارگذاری شد — v2.0');
