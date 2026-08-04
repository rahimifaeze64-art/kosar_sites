/**
 * orders-redesign.js
 * بازطراحی کامل مدیریت سفارشات — طراحی حرفه‌ای و امکانات کامل
 * سازگار با OrdersModule موجود — جایگزین UI قدیمی می‌شود
 */
const OrdersRedesign = (function () {
  'use strict';

  // ── ثابت‌ها ─────────────────────────────────────────────────
  const STATUS = {
    pending:     { label: 'در انتظار',    cls: 'bg-amber-100 text-amber-800 border border-amber-200',  icon: 'fa-clock',            dot: 'bg-amber-400' },
    in_progress: { label: 'در حال انجام', cls: 'bg-blue-100 text-blue-800 border border-blue-200',    icon: 'fa-spinner',          dot: 'bg-blue-400' },
    completed:   { label: 'تکمیل شده',   cls: 'bg-green-100 text-green-800 border border-green-200',  icon: 'fa-check-circle',     dot: 'bg-green-400' },
    cancelled:   { label: 'لغو شده',     cls: 'bg-red-100 text-red-800 border border-red-200',        icon: 'fa-times-circle',     dot: 'bg-red-400' },
    approved:    { label: 'تایید شده',   cls: 'bg-teal-100 text-teal-800 border border-teal-200',     icon: 'fa-check-double',     dot: 'bg-teal-400' },
    rejected:    { label: 'رد شده',      cls: 'bg-rose-100 text-rose-800 border border-rose-200',     icon: 'fa-ban',              dot: 'bg-rose-400' },
  };

  const PAYMENT_STATUS = {
    unpaid:   { label: 'پرداخت نشده', cls: 'text-red-600 bg-red-50',    icon: 'fa-times' },
    partial:  { label: 'پرداخت جزئی', cls: 'text-amber-600 bg-amber-50', icon: 'fa-minus' },
    paid:     { label: 'پرداخت شده',  cls: 'text-green-600 bg-green-50', icon: 'fa-check' },
  };

  const WORK_TYPES = [
    'عناوین رساله ارشد','عناوین رساله دکتری','عناوین مقاله',
    'پروپوزال رساله ارشد','پروپوزال رساله دکتری','پروپوزال مقاله',
    'رساله ارشد','رساله دکتری','تعدیل','تنضید','ترجمه',
    'استلال عراقی','استلال ایرانی','علاج استلال ایرانی','علاج استلال عراقی',
    'ترجمه و تصدیق مباشره','ترجمه و تصدیق قبول نهایی','ترجمه و تصدیق دانشنامه',
    'ترجمه مدرک','تجلید','همانند جویی',
    'ایران داک عنوان','ایران داک پروپوزال','ایران داک پایان نامه',
    'سائورگ','تلخیص متن','ساخت پاور پوینت',
    'تعقیب اجراعات قبل مباشره','تعقیب اجراعات بعد مباشره','تصدیق مجلدات',
    'تعقیب استماره 1','تعقیب پروپوزال','گرفتن امر اداری','تعقیب رساله',
    'تعقیب اجراعات روز مناقشه','سفارش سفارشی','سایر',
    'نوشتن رساله','نوشتن مقاله','ترجمه رساله','تلخیص','آماده‌سازی ارائه','تحقیق و بررسی'
  ];

  const AGENTS = () => {
    try {
      if (typeof HARDCODED_USERS !== 'undefined') {
        return HARDCODED_USERS.filter(u => u.role === 'agent' && u.active !== false);
      }
      if (typeof DataModule !== 'undefined') {
        return DataModule.getUsers().filter(u => u.role === 'agent');
      }
    } catch(e) {}
    return [];
  };

  // ── توابع کمکی ──────────────────────────────────────────────
  function esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function fmt(amount) {
    const n = parseFloat(amount) || 0;
    return n.toLocaleString('fa-IR');
  }

  function fmtDate(iso) {
    if (!iso) return '---';
    try {
      if (typeof Jalali !== 'undefined') return Jalali.toJalaliDisplay(new Date(iso));
      return new Date(iso).toLocaleDateString('fa-IR');
    } catch(e) { return iso; }
  }

  function fmtDeadline(deadline) {
    if (!deadline) return '---';
    try {
      const d = new Date(deadline);
      const now = new Date();
      const diff = Math.ceil((d - now) / 86400000);
      const dateStr = fmtDate(deadline);
      if (diff < 0)  return `<span class="text-red-600 font-medium">${dateStr} <span class="text-xs">(${Math.abs(diff)} روز تأخیر)</span></span>`;
      if (diff === 0) return `<span class="text-orange-600 font-medium">${dateStr} <span class="text-xs">(امروز!)</span></span>`;
      if (diff <= 3)  return `<span class="text-amber-600 font-medium">${dateStr} <span class="text-xs">(${diff} روز مانده)</span></span>`;
      return `<span class="text-gray-700">${dateStr}</span>`;
    } catch(e) { return deadline; }
  }

  function statusBadge(status) {
    const s = STATUS[status] || { label: status || '---', cls: 'bg-gray-100 text-gray-700 border border-gray-200', icon: 'fa-circle', dot: 'bg-gray-400' };
    return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${s.cls}">
      <i class="fas ${s.icon} text-[10px]"></i>${s.label}</span>`;
  }

  function progressBar(pct) {
    const p = Math.min(100, Math.max(0, parseInt(pct) || 0));
    const color = p < 30 ? 'bg-red-400' : p < 70 ? 'bg-amber-400' : 'bg-green-500';
    return `<div class="flex items-center gap-2">
      <div class="flex-1 bg-gray-200 rounded-full h-1.5">
        <div class="${color} h-1.5 rounded-full transition-all" style="width:${p}%"></div>
      </div>
      <span class="text-xs text-gray-600 w-8 text-left">${p}%</span>
    </div>`;
  }

  function getOrders() {
    if (typeof DataModule !== 'undefined') return DataModule.getOrders() || [];
    try {
      const key = (typeof CONFIG !== 'undefined' && CONFIG.STORAGE_KEYS && CONFIG.STORAGE_KEYS.ORDERS)
        ? CONFIG.STORAGE_KEYS.ORDERS : 'edu_system_orders';
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch(e) { return []; }
  }

  function saveOrders(orders) {
    if (typeof DataModule !== 'undefined') { DataModule.saveOrders(orders); return; }
    const key = (typeof CONFIG !== 'undefined' && CONFIG.STORAGE_KEYS && CONFIG.STORAGE_KEYS.ORDERS)
      ? CONFIG.STORAGE_KEYS.ORDERS : 'edu_system_orders';
    localStorage.setItem(key, JSON.stringify(orders));
  }

  function currentUser() {
    if (typeof getCurrentUser === 'function') return getCurrentUser();
    try { return JSON.parse(localStorage.getItem('currentUser') || '{}'); } catch(e) { return {}; }
  }

  function notify(msg, type) {
    if (typeof UTILS !== 'undefined' && UTILS.showNotification) UTILS.showNotification(msg, type);
    else console.log(`[${type}] ${msg}`);
  }

  function canManage(role) {
    return role === 'manager' || role === 'employee';
  }

  // ── مرحله ۲: Stats Bar ──────────────────────────────────────
  function renderStats(orders) {
    const counts = { total: orders.length, pending: 0, in_progress: 0, completed: 0, cancelled: 0 };
    let totalAmount = 0, paidAmount = 0;
    orders.forEach(o => {
      const s = o.status === 'approved' ? 'in_progress' : o.status === 'rejected' ? 'pending' : (o.status || 'pending');
      if (counts[s] !== undefined) counts[s]++;
      totalAmount += parseFloat(o.totalAmount || o.cost || 0);
      paidAmount  += parseFloat(o.paidAmount || 0);
    });
    const unpaid = totalAmount - paidAmount;
    const cards = [
      { label:'کل سفارشات',   val: counts.total,       icon:'fa-clipboard-list', color:'olive',  sub:'',                    id:'stat-total' },
      { label:'در انتظار',    val: counts.pending,      icon:'fa-clock',          color:'amber',  sub:'نیاز به بررسی',       id:'stat-pending' },
      { label:'در حال انجام', val: counts.in_progress,  icon:'fa-spinner',        color:'blue',   sub:'فعال',                id:'stat-progress' },
      { label:'تکمیل شده',    val: counts.completed,    icon:'fa-check-circle',   color:'green',  sub:'موفق',                id:'stat-completed' },
      { label:'مجموع مبلغ',   val: fmt(totalAmount),    icon:'fa-coins',          color:'teal',   sub:'تومان/دلار',          id:'stat-total-amount', raw:true },
      { label:'مانده پرداخت', val: fmt(unpaid),         icon:'fa-hourglass-half', color:'rose',   sub:'بدهکار',              id:'stat-unpaid',     raw:true },
    ];
    const colorMap = {
      olive:'border-[#8FBF3F] text-[#5a7a28]', amber:'border-amber-400 text-amber-700',
      blue:'border-blue-400 text-blue-700',     green:'border-green-400 text-green-700',
      teal:'border-teal-400 text-teal-700',     rose:'border-rose-400 text-rose-600',
    };
    const bgMap = {
      olive:'bg-[#f3f9e8]', amber:'bg-amber-50', blue:'bg-blue-50',
      green:'bg-green-50',  teal:'bg-teal-50',   rose:'bg-rose-50',
    };
    return `<div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-1">
      ${cards.map(c => `
        <div id="${c.id}" class="${bgMap[c.color]} border-r-4 ${colorMap[c.color]} rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow cursor-default">
          <div class="flex items-start justify-between mb-1">
            <i class="fas ${c.icon} text-lg ${colorMap[c.color].split(' ')[1]}"></i>
            <span class="text-2xl font-black ${colorMap[c.color].split(' ')[1]}">${c.val}</span>
          </div>
          <p class="text-xs font-semibold text-gray-700 mt-1">${c.label}</p>
          ${c.sub ? `<p class="text-[10px] text-gray-400">${c.sub}</p>` : ''}
        </div>`).join('')}
    </div>`;
  }

  // ── مرحله ۳: نوار فیلتر ─────────────────────────────────────
  function renderFilterBar(userRole) {
    const statusOpts = Object.entries(STATUS)
      .map(([v,s]) => `<option value="${v}">${s.label}</option>`).join('');
    const typeOpts = WORK_TYPES
      .map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
    return `
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
      <div class="flex flex-wrap gap-3 items-end">
        <div class="flex-1 min-w-[160px]">
          <label class="block text-xs text-gray-500 mb-1 font-medium">جستجو</label>
          <div class="relative">
            <i class="fas fa-search absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
            <input type="text" id="ord-search"
              class="w-full border border-gray-200 rounded-lg py-2 pr-8 pl-3 text-sm focus:ring-2 focus:ring-[#8FBF3F] focus:border-[#8FBF3F] outline-none"
              placeholder="نام دانشجو، دانشگاه، نوع کار...">
          </div>
        </div>
        <div class="min-w-[140px]">
          <label class="block text-xs text-gray-500 mb-1 font-medium">وضعیت</label>
          <select id="ord-status" class="w-full border border-gray-200 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-[#8FBF3F] outline-none bg-white">
            <option value="">همه وضعیت‌ها</option>${statusOpts}
          </select>
        </div>
        <div class="min-w-[160px]">
          <label class="block text-xs text-gray-500 mb-1 font-medium">نوع کار</label>
          <select id="ord-type" class="w-full border border-gray-200 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-[#8FBF3F] outline-none bg-white">
            <option value="">همه انواع</option>${typeOpts}
          </select>
        </div>
        <div class="min-w-[140px]">
          <label class="block text-xs text-gray-500 mb-1 font-medium">پرداخت</label>
          <select id="ord-payment" class="w-full border border-gray-200 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-[#8FBF3F] outline-none bg-white">
            <option value="">همه</option>
            <option value="unpaid">پرداخت نشده</option>
            <option value="partial">جزئی</option>
            <option value="paid">پرداخت شده</option>
          </select>
        </div>
        <div class="flex gap-2">
          <button onclick="OrdersRedesign.applyFilters()"
            class="bg-[#8FBF3F] hover:bg-[#7aac2e] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <i class="fas fa-filter text-xs"></i>اعمال
          </button>
          <button onclick="OrdersRedesign.clearFilters()"
            class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm transition-colors" title="پاک کردن فیلتر">
            <i class="fas fa-times"></i>
          </button>
          <button onclick="OrdersRedesign.exportCSV()"
            class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm transition-colors" title="دانلود CSV">
            <i class="fas fa-download"></i>
          </button>
        </div>
      </div>
    </div>`;
  }

  // ── مرحله ۴: جدول سفارشات ───────────────────────────────────
  function renderTableRow(order, userRole) {
    const sid = esc(order.id);
    const shortId = String(order.id).slice(-6).toUpperCase();
    const agentName = esc(order.assignedDoctor || '');
    const agents = AGENTS();
    const agentObj = agents.find(a => a.id === order.assignedDoctorId || a.id === order.assignedAgentId);
    const agentDisplay = agentObj ? esc(agentObj.name) : (agentName || '');
    const pst = PAYMENT_STATUS[order.paymentStatus] || PAYMENT_STATUS.unpaid;
    const currency = esc(order.currency || 'تومان');

    let actionBtns = `
      <button onclick="OrdersRedesign.openDetail('${sid}')"
        class="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 hover:text-blue-800 transition-colors" title="مشاهده جزئیات">
        <i class="fas fa-eye text-sm"></i>
      </button>`;

    if (canManage(userRole)) {
      actionBtns += `
        <button onclick="OrdersRedesign.openEdit('${sid}')"
          class="p-1.5 rounded-lg hover:bg-green-50 text-green-600 hover:text-green-800 transition-colors" title="ویرایش">
          <i class="fas fa-edit text-sm"></i>
        </button>`;

      if (order.status === 'pending') {
        actionBtns += `
          <button onclick="OrdersRedesign.changeStatus('${sid}','in_progress')"
            class="p-1.5 rounded-lg hover:bg-teal-50 text-teal-600 transition-colors" title="شروع کار">
            <i class="fas fa-play text-sm"></i>
          </button>`;
      }
      if (order.status === 'in_progress') {
        actionBtns += `
          <button onclick="OrdersRedesign.changeStatus('${sid}','completed')"
            class="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors" title="تکمیل">
            <i class="fas fa-check-double text-sm"></i>
          </button>`;
      }
    }
    if (userRole === 'manager') {
      actionBtns += `
        <button onclick="OrdersRedesign.deleteOrder('${sid}')"
          class="p-1.5 rounded-lg hover:bg-red-50 text-red-500 hover:text-red-700 transition-colors" title="حذف">
          <i class="fas fa-trash text-sm"></i>
        </button>`;
    }

    return `
    <tr class="hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0" id="ord-row-${sid}">
      <td class="px-4 py-3 text-right">
        <span class="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">#${shortId}</span>
        ${order.isCustomOrder ? '<span class="mr-1 text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">سفارشی</span>' : ''}
      </td>
      <td class="px-4 py-3">
        <div class="font-semibold text-gray-800 text-sm">${esc(order.studentName || '---')}</div>
        <div class="text-xs text-gray-400 mt-0.5">${esc(order.university || '')}</div>
      </td>
      <td class="px-4 py-3">
        <div class="text-sm text-gray-700">${esc(order.isCustomOrder ? (order.title || order.type) : order.type) || '---'}</div>
        <div class="text-xs text-gray-400">${esc(order.degree || '')}</div>
      </td>
      <td class="px-4 py-3">${statusBadge(order.status)}</td>
      <td class="px-4 py-3 min-w-[120px]">${progressBar(order.progress)}</td>
      <td class="px-4 py-3">
        <div class="text-sm font-semibold text-gray-800">${fmt(order.totalAmount || order.cost || 0)} ${currency}</div>
        <div class="text-xs mt-0.5">
          <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${pst.cls}">
            <i class="fas ${pst.icon} text-[8px]"></i>${pst.label}
          </span>
        </div>
      </td>
      <td class="px-4 py-3">
        ${agentDisplay
          ? `<div class="flex items-center gap-1.5">
              <div class="w-6 h-6 rounded-full bg-[#8FBF3F] text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                ${agentDisplay.charAt(0)}
              </div>
              <span class="text-xs text-gray-700">${agentDisplay}</span>
            </div>`
          : `<span class="text-xs text-gray-400 italic">تخصیص نشده</span>`}
      </td>
      <td class="px-4 py-3 text-xs text-gray-500">${fmtDeadline(order.deadline || order.deadlineDateTime)}</td>
      <td class="px-4 py-3">
        <div class="flex items-center gap-1">${actionBtns}</div>
      </td>
    </tr>`;
  }

  function renderTable(orders, userRole) {
    if (!orders.length) return `
      <tr><td colspan="9" class="py-16 text-center">
        <div class="flex flex-col items-center gap-3 text-gray-400">
          <i class="fas fa-inbox text-5xl opacity-30"></i>
          <p class="text-base font-medium">سفارشی یافت نشد</p>
          <p class="text-sm">فیلترها را تغییر دهید یا سفارش جدید ثبت کنید</p>
        </div>
      </td></tr>`;
    return orders.map(o => renderTableRow(o, userRole)).join('');
  }

  // ── مرحله ۵: صفحه اصلی ──────────────────────────────────────
  function filterOrders(orders, userRole, userId) {
    let result = [...orders];
    // فیلتر بر اساس نقش
    switch (userRole) {
      case 'student':
        result = result.filter(o => o.studentId === userId); break;
      case 'agent':
        result = result.filter(o => o.assignedDoctorId === userId || o.assignedAgentId === userId); break;
      case 'employee':
        result = result.filter(o => ['pending','in_progress','completed'].includes(o.status)); break;
      default: break;
    }
    return result;
  }

  function applyUIFilters(orders) {
    const search  = (document.getElementById('ord-search')?.value  || '').trim().toLowerCase();
    const status  =  document.getElementById('ord-status')?.value  || '';
    const type    =  document.getElementById('ord-type')?.value    || '';
    const payment =  document.getElementById('ord-payment')?.value || '';
    return orders.filter(o => {
      if (status  && o.status !== status)  return false;
      if (payment && o.paymentStatus !== payment) return false;
      if (type    && o.type !== type && !(o.isCustomOrder && (o.title === type || o.type === type))) return false;
      if (search) {
        const haystack = [o.studentName, o.university, o.type, o.title, o.description, o.assignedDoctor]
          .map(s => (s||'').toLowerCase()).join(' ');
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }

  function renderPage(orders, userRole) {
    const createBtn = canManage(userRole) || userRole === 'student'
      ? `<button onclick="OrdersRedesign.openCreate()"
           class="bg-[#8FBF3F] hover:bg-[#7aac2e] text-white px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 shadow-sm transition-colors">
           <i class="fas fa-plus-circle"></i>سفارش جدید
         </button>` : '';

    const viewToggle = `
      <div class="flex rounded-lg border border-gray-200 overflow-hidden">
        <button id="btn-view-table" onclick="OrdersRedesign.setView('table')"
          class="px-3 py-2 text-sm bg-[#8FBF3F] text-white transition-colors" title="نمای جدول">
          <i class="fas fa-table"></i>
        </button>
        <button id="btn-view-cards" onclick="OrdersRedesign.setView('cards')"
          class="px-3 py-2 text-sm bg-white text-gray-500 hover:bg-gray-50 transition-colors" title="نمای کارت">
          <i class="fas fa-th-large"></i>
        </button>
      </div>`;

    const tableHTML = `
      <div id="ord-view-table" class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-right">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-200">
                <th class="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">شماره</th>
                <th class="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">دانشجو</th>
                <th class="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">نوع کار</th>
                <th class="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">وضعیت</th>
                <th class="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">پیشرفت</th>
                <th class="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">مبلغ</th>
                <th class="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">عامل</th>
                <th class="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">مهلت</th>
                <th class="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">عملیات</th>
              </tr>
            </thead>
            <tbody id="ord-tbody">${renderTable(orders, userRole)}</tbody>
          </table>
        </div>
        <div class="px-4 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50">
          <span id="ord-count" class="text-xs text-gray-500">${orders.length} سفارش</span>
          <span class="text-xs text-gray-400">صفحه ۱</span>
        </div>
      </div>`;

    const cardsHTML = `<div id="ord-view-cards" class="hidden">
      <div id="ord-cards-grid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        ${renderCards(orders, userRole)}
      </div>
    </div>`;

    return `
    <div class="space-y-4 p-1" id="orders-redesign-root">
      <!-- Header -->
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 class="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span class="bg-[#f3f9e8] p-2 rounded-xl"><i class="fas fa-clipboard-list text-[#8FBF3F]"></i></span>
            مدیریت سفارشات
          </h2>
          <p class="text-xs text-gray-400 mt-0.5 mr-10">مجموع ${orders.length} سفارش</p>
        </div>
        <div class="flex gap-2 items-center">
          ${viewToggle}
          ${createBtn}
          <button onclick="OrdersRedesign.refresh()"
            class="bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-2.5 rounded-xl text-sm transition-colors" title="بازخوانی">
            <i class="fas fa-sync-alt"></i>
          </button>
        </div>
      </div>
      <!-- Stats -->
      ${renderStats(orders)}
      <!-- Filters -->
      ${renderFilterBar(userRole)}
      <!-- Table -->
      ${tableHTML}
      <!-- Cards -->
      ${cardsHTML}
      <!-- Detail Modal -->
      <div id="ord-detail-modal"></div>
      <!-- Create/Edit Modal -->
      <div id="ord-form-modal"></div>
    </div>`;
  }

  // ── مرحله ۶: نمای کارت ──────────────────────────────────────
  function renderCards(orders, userRole) {
    if (!orders.length) return `
      <div class="col-span-full py-16 text-center text-gray-400">
        <i class="fas fa-inbox text-5xl opacity-30 mb-3 block"></i>
        <p>سفارشی یافت نشد</p>
      </div>`;
    return orders.map(o => {
      const sid = esc(o.id);
      const s = STATUS[o.status] || STATUS.pending;
      const pst = PAYMENT_STATUS[o.paymentStatus] || PAYMENT_STATUS.unpaid;
      const agents = AGENTS();
      const agentObj = agents.find(a => a.id === o.assignedDoctorId || a.id === o.assignedAgentId);
      const agentName = agentObj ? esc(agentObj.name) : esc(o.assignedDoctor || '');
      const p = Math.min(100, parseInt(o.progress) || 0);
      const pcolor = p < 30 ? 'bg-red-400' : p < 70 ? 'bg-amber-400' : 'bg-green-500';
      const currency = esc(o.currency || 'تومان');
      return `
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
        <div class="h-1.5 w-full ${pcolor}" style="width:${p}%"></div>
        <div class="p-4 flex-1 space-y-3">
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
              <p class="font-bold text-gray-800 text-sm truncate">${esc(o.studentName || '---')}</p>
              <p class="text-xs text-gray-400 truncate">${esc(o.university || '')}</p>
            </div>
            ${statusBadge(o.status)}
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full truncate max-w-[180px]">
              ${esc(o.isCustomOrder ? (o.title||o.type) : o.type) || '---'}
            </span>
            ${o.degree ? `<span class="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">${esc(o.degree)}</span>` : ''}
          </div>
          <div class="space-y-1">
            <div class="flex justify-between text-xs text-gray-500">
              <span>پیشرفت</span><span>${p}%</span>
            </div>
            <div class="w-full bg-gray-100 rounded-full h-1.5">
              <div class="${pcolor} h-1.5 rounded-full transition-all" style="width:${p}%"></div>
            </div>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="font-semibold text-gray-800">${fmt(o.totalAmount||o.cost||0)} ${currency}</span>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-medium ${pst.cls}">
              <i class="fas ${pst.icon} ml-1 text-[8px]"></i>${pst.label}
            </span>
          </div>
          ${agentName ? `
          <div class="flex items-center gap-1.5 text-xs text-gray-500 border-t border-gray-100 pt-2">
            <div class="w-5 h-5 rounded-full bg-[#8FBF3F] text-white flex items-center justify-center text-[9px] font-bold">${agentName.charAt(0)}</div>
            <span>${agentName}</span>
          </div>` : ''}
          ${o.deadline || o.deadlineDateTime ? `
          <div class="text-xs border-t border-gray-100 pt-2">
            <i class="fas fa-calendar-alt text-gray-400 ml-1"></i>
            ${fmtDeadline(o.deadline || o.deadlineDateTime)}
          </div>` : ''}
        </div>
        <div class="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex gap-2">
          <button onclick="OrdersRedesign.openDetail('${sid}')"
            class="flex-1 text-center py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-medium transition-colors">
            <i class="fas fa-eye ml-1"></i>جزئیات
          </button>
          ${canManage(userRole) ? `
          <button onclick="OrdersRedesign.openEdit('${sid}')"
            class="flex-1 text-center py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 text-xs font-medium transition-colors">
            <i class="fas fa-edit ml-1"></i>ویرایش
          </button>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  // ── مرحله ۷: مودال جزئیات ───────────────────────────────────
  function renderDetailModal(order, userRole) {
    const sid = esc(order.id);
    const agents = AGENTS();
    const agentObj = agents.find(a => a.id === order.assignedDoctorId || a.id === order.assignedAgentId);
    const agentName = agentObj ? esc(agentObj.name) : esc(order.assignedDoctor || '');
    const pst = PAYMENT_STATUS[order.paymentStatus] || PAYMENT_STATUS.unpaid;
    const currency = esc(order.currency || 'تومان');
    const total = parseFloat(order.totalAmount || order.cost || 0);
    const paid  = parseFloat(order.paidAmount || 0);
    const remaining = total - paid;
    const agentPct = parseFloat(order.revenueAgentPercent || 60);
    const mgrPct   = parseFloat(order.revenueManagerPercent || 40);
    const agentShare = total * agentPct / 100;
    const mgrShare   = total * mgrPct / 100;
    const canEdit = canManage(userRole);

    const tabs = [
      { id:'overview',  icon:'fa-info-circle',    label:'مشخصات' },
      { id:'financial', icon:'fa-coins',           label:'مالی' },
      { id:'agent',     icon:'fa-user-tie',        label:'تخصیص' },
      { id:'log',       icon:'fa-history',         label:'تاریخچه' },
    ];

    const tabBtns = tabs.map((t,i) => `
      <button onclick="OrdersRedesign._switchTab('${t.id}')"
        id="dtab-btn-${t.id}"
        class="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
               ${i===0 ? 'border-[#8FBF3F] text-[#5a7a28]' : 'border-transparent text-gray-500 hover:text-gray-700'}">
        <i class="fas ${t.icon} text-xs"></i>${t.label}
      </button>`).join('');

    // Tab: مشخصات
    const overviewTab = `
      <div id="dtab-overview" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          ${[
            ['نام دانشجو',   esc(order.studentName||'---')],
            ['دانشگاه',      esc(order.university||'---')],
            ['رشته',         esc(order.field||'---')],
            ['مقطع',         esc(order.degree||'---')],
            ['نوع کار',      esc(order.isCustomOrder?(order.title||order.type):order.type)||'---'],
            ['وضعیت',        statusBadge(order.status)],
            ['تاریخ ثبت',    fmtDate(order.createdAt)],
            ['مهلت تحویل',   fmtDeadline(order.deadline||order.deadlineDateTime)],
            ['شماره پاسپورت',esc(order.passportNumber||'---')],
            ['تلفن',         esc(order.phone||'---')],
          ].map(([k,v]) => `
            <div class="flex flex-col gap-0.5 bg-gray-50 rounded-lg p-3">
              <span class="text-xs text-gray-400">${k}</span>
              <span class="text-sm font-medium text-gray-800">${v}</span>
            </div>`).join('')}
        </div>
        <div class="bg-gray-50 rounded-lg p-3 space-y-2">
          <div class="flex justify-between text-xs text-gray-500">
            <span>پیشرفت کار</span><span>${Math.min(100,parseInt(order.progress)||0)}%</span>
          </div>
          ${progressBar(order.progress)}
        </div>
        ${order.description ? `
        <div class="bg-blue-50 rounded-lg p-3">
          <p class="text-xs text-blue-600 font-medium mb-1"><i class="fas fa-comment-alt ml-1"></i>توضیحات</p>
          <p class="text-sm text-gray-700">${esc(order.description)}</p>
        </div>` : ''}
        ${order.attachmentName ? `
        <div class="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <i class="fas fa-paperclip text-yellow-500"></i>
          <span class="text-sm text-gray-700 flex-1">${esc(order.attachmentName)}</span>
          ${order.hasAttachment ? `
          <button onclick="window.downloadOrderFile && downloadOrderFile('${sid}','${esc(order.attachmentName)}')"
            class="text-xs bg-white border border-yellow-300 text-yellow-700 px-2 py-1 rounded hover:bg-yellow-50">
            <i class="fas fa-download ml-1"></i>دانلود
          </button>` : `<span class="text-xs text-gray-400">در دسترس نیست</span>`}
        </div>` : ''}
      </div>`;

    // Tab: مالی
    const financialTab = `
      <div id="dtab-financial" class="hidden space-y-4">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          ${[
            ['مبلغ کل',       `${fmt(total)} ${currency}`,      'text-gray-800', 'fa-coins',         'bg-gray-50'],
            ['پرداخت شده',    `${fmt(paid)} ${currency}`,       'text-green-700','fa-check-circle',   'bg-green-50'],
            ['مانده',         `${fmt(remaining)} ${currency}`,  'text-red-700',  'fa-hourglass-half', 'bg-red-50'],
            ['وضعیت پرداخت',  pst.label,                        pst.cls.split(' ')[0], 'fa-credit-card','bg-gray-50'],
          ].map(([k,v,tc,ic,bg]) => `
            <div class="${bg} rounded-xl p-3 text-center border border-gray-100">
              <i class="fas ${ic} ${tc} text-lg mb-1 block"></i>
              <p class="text-xs text-gray-500 mb-1">${k}</p>
              <p class="text-sm font-bold ${tc}">${v}</p>
            </div>`).join('')}
        </div>
        <div class="bg-gray-50 rounded-xl p-4">
          <p class="text-sm font-semibold text-gray-700 mb-3"><i class="fas fa-percent ml-2 text-[#8FBF3F]"></i>تقسیم درآمد</p>
          <div class="flex gap-4">
            <div class="flex-1 bg-white rounded-lg p-3 border border-gray-200 text-center">
              <p class="text-xs text-gray-500">سهم عامل (${agentPct}٪)</p>
              <p class="text-base font-bold text-[#5a7a28] mt-1">${fmt(agentShare)} ${currency}</p>
            </div>
            <div class="flex-1 bg-white rounded-lg p-3 border border-gray-200 text-center">
              <p class="text-xs text-gray-500">سهم مدیریت (${mgrPct}٪)</p>
              <p class="text-base font-bold text-blue-700 mt-1">${fmt(mgrShare)} ${currency}</p>
            </div>
          </div>
        </div>
        ${canEdit ? `
        <div class="bg-white rounded-xl border border-gray-200 p-4">
          <p class="text-sm font-semibold text-gray-700 mb-3"><i class="fas fa-plus-circle ml-2 text-green-600"></i>ثبت پرداخت جدید</p>
          <div class="flex gap-2">
            <input type="number" id="det-pay-amount" placeholder="مبلغ پرداختی"
              class="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8FBF3F] outline-none">
            <select id="det-pay-currency" class="border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white focus:ring-2 focus:ring-[#8FBF3F] outline-none">
              <option>تومان</option><option>دلار</option>
            </select>
            <button onclick="OrdersRedesign.addPayment('${sid}')"
              class="bg-[#8FBF3F] hover:bg-[#7aac2e] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              ثبت
            </button>
          </div>
        </div>` : ''}
      </div>`;

    // Tab: تخصیص
    const agentOpts = agents.map(a =>
      `<option value="${esc(a.id)}" ${(order.assignedDoctorId===a.id||order.assignedAgentId===a.id)?'selected':''}>
        ${esc(a.name)}${a.specialization?' — '+esc(a.specialization):''}
      </option>`).join('');

    const agentTab = `
      <div id="dtab-agent" class="hidden space-y-4">
        <div class="bg-gray-50 rounded-xl p-4">
          <p class="text-sm font-semibold text-gray-700 mb-3"><i class="fas fa-user-tie ml-2 text-[#8FBF3F]"></i>عامل فعلی</p>
          ${agentName
            ? `<div class="flex items-center gap-3 bg-white rounded-lg p-3 border border-gray-200">
                <div class="w-10 h-10 rounded-full bg-[#8FBF3F] text-white flex items-center justify-center text-base font-bold">${agentName.charAt(0)}</div>
                <div>
                  <p class="font-semibold text-gray-800">${agentName}</p>
                  ${agentObj?.specialization ? `<p class="text-xs text-gray-400">${esc(agentObj.specialization)}</p>` : ''}
                </div>
              </div>`
            : `<p class="text-sm text-gray-400 italic">هنوز عاملی تخصیص داده نشده</p>`}
        </div>
        ${canEdit ? `
        <div class="bg-white rounded-xl border border-gray-200 p-4">
          <p class="text-sm font-semibold text-gray-700 mb-3"><i class="fas fa-exchange-alt ml-2 text-blue-500"></i>تغییر عامل</p>
          <div class="space-y-3">
            <select id="det-agent-select" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#8FBF3F] outline-none">
              <option value="">— بدون تخصیص —</option>${agentOpts}
            </select>
            <textarea id="det-agent-notes" rows="2"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8FBF3F] outline-none"
              placeholder="یادداشت تخصیص (اختیاری)..."></textarea>
            <button onclick="OrdersRedesign.saveAssignment('${sid}')"
              class="w-full bg-[#8FBF3F] hover:bg-[#7aac2e] text-white py-2 rounded-lg text-sm font-medium transition-colors">
              <i class="fas fa-save ml-2"></i>ذخیره تخصیص
            </button>
          </div>
        </div>` : ''}
        <div class="bg-gray-50 rounded-xl p-4">
          <p class="text-sm font-semibold text-gray-700 mb-3"><i class="fas fa-sliders-h ml-2 text-yellow-500"></i>درصد تقسیم</p>
          ${canEdit ? `
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-gray-500 block mb-1">سهم عامل ٪</label>
              <input type="number" id="det-agent-pct" value="${agentPct}" min="0" max="100"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8FBF3F] outline-none"
                oninput="document.getElementById('det-mgr-pct').value = 100 - this.value">
            </div>
            <div>
              <label class="text-xs text-gray-500 block mb-1">سهم مدیریت ٪</label>
              <input type="number" id="det-mgr-pct" value="${mgrPct}" min="0" max="100"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8FBF3F] outline-none"
                oninput="document.getElementById('det-agent-pct').value = 100 - this.value">
            </div>
          </div>
          <button onclick="OrdersRedesign.saveRevenueSplit('${sid}')"
            class="mt-3 w-full bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded-lg text-sm font-medium transition-colors">
            <i class="fas fa-save ml-2"></i>ذخیره درصدها
          </button>` : `
          <div class="flex gap-4 text-sm">
            <span>عامل: <strong>${agentPct}٪</strong></span>
            <span>مدیریت: <strong>${mgrPct}٪</strong></span>
          </div>`}
        </div>
      </div>`;

    // Tab: تاریخچه
    const workLog = Array.isArray(order.workLog) ? order.workLog : [];
    const rejHistory = Array.isArray(order.rejectionHistory) ? order.rejectionHistory : [];
    const logItems = [...workLog, ...rejHistory.map(r => ({
      type:'rejection', message:`رد شده: ${r.reason||''}`, timestamp: r.date,
    }))].sort((a,b) => new Date(b.timestamp||0) - new Date(a.timestamp||0));

    const logTab = `
      <div id="dtab-log" class="hidden space-y-3">
        ${!logItems.length
          ? `<div class="text-center py-10 text-gray-400"><i class="fas fa-history text-3xl opacity-30 mb-2 block"></i><p class="text-sm">تاریخچه‌ای ثبت نشده</p></div>`
          : logItems.map(l => {
              const icon = l.type==='assignment' ? 'fa-user-plus text-blue-500'
                         : l.type==='rejection'  ? 'fa-ban text-red-500'
                         : 'fa-circle text-gray-400';
              return `
              <div class="flex gap-3 items-start bg-gray-50 rounded-lg p-3">
                <div class="mt-0.5 w-6 h-6 flex-shrink-0 flex items-center justify-center">
                  <i class="fas ${icon} text-sm"></i>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm text-gray-700">${esc(l.message||l.reason||'')}</p>
                  ${l.notes ? `<p class="text-xs text-gray-400 mt-0.5">${esc(l.notes)}</p>` : ''}
                  <p class="text-[10px] text-gray-400 mt-1">${fmtDate(l.timestamp||l.date)}</p>
                </div>
              </div>`;
            }).join('')}
        ${canEdit && order.status !== 'cancelled' ? `
        <div class="border-t border-gray-200 pt-3">
          <div class="flex gap-2">
            <textarea id="det-log-note" rows="2" placeholder="یادداشت جدید..."
              class="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8FBF3F] outline-none"></textarea>
            <button onclick="OrdersRedesign.addNote('${sid}')"
              class="bg-gray-700 hover:bg-gray-800 text-white px-3 py-2 rounded-lg text-sm self-end transition-colors">
              <i class="fas fa-plus"></i>
            </button>
          </div>
        </div>` : ''}
      </div>`;

    const statusActions = canEdit ? `
      <div class="flex gap-2 flex-wrap">
        ${order.status === 'pending' ? `
          <button onclick="OrdersRedesign.changeStatus('${sid}','in_progress');OrdersRedesign._closeDetail()"
            class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
            <i class="fas fa-play ml-1"></i>شروع کار
          </button>` : ''}
        ${order.status === 'in_progress' ? `
          <button onclick="OrdersRedesign.changeStatus('${sid}','completed');OrdersRedesign._closeDetail()"
            class="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
            <i class="fas fa-check-double ml-1"></i>تکمیل
          </button>` : ''}
        ${order.status !== 'cancelled' ? `
          <button onclick="OrdersRedesign.changeStatus('${sid}','cancelled');OrdersRedesign._closeDetail()"
            class="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
            <i class="fas fa-ban ml-1"></i>لغو
          </button>` : ''}
        <button onclick="OrdersRedesign.openEdit('${sid}');OrdersRedesign._closeDetail()"
          class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
          <i class="fas fa-edit ml-1"></i>ویرایش
        </button>
      </div>` : '';

    return `
    <div id="ord-detail-overlay"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onclick="if(event.target===this)OrdersRedesign._closeDetail()">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <!-- Header -->
        <div class="flex items-start justify-between p-5 border-b border-gray-100">
          <div>
            <h3 class="text-lg font-bold text-gray-800">${esc(order.studentName||'---')}</h3>
            <p class="text-sm text-gray-500 mt-0.5">${esc(order.isCustomOrder?(order.title||order.type):order.type)||'---'} — ${esc(order.university||'---')}</p>
          </div>
          <button onclick="OrdersRedesign._closeDetail()"
            class="text-gray-400 hover:text-gray-600 text-xl p-1 transition-colors">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <!-- Tabs -->
        <div class="flex border-b border-gray-100 overflow-x-auto px-5">${tabBtns}</div>
        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-5">
          ${overviewTab}${financialTab}${agentTab}${logTab}
        </div>
        <!-- Footer -->
        <div class="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50">
          ${statusActions}
          <button onclick="OrdersRedesign._closeDetail()"
            class="mr-auto bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm transition-colors">
            بستن
          </button>
        </div>
      </div>
    </div>`;
  }

  // ── مرحله ۸: فرم ایجاد/ویرایش ──────────────────────────────
  function renderFormModal(order, userRole) {
    const isEdit = !!order;
    const o = order || {};
    const sid = isEdit ? esc(o.id) : '';
    const agents = AGENTS();
    const agentOpts = agents.map(a =>
      `<option value="${esc(a.id)}" ${(o.assignedDoctorId===a.id||o.assignedAgentId===a.id)?'selected':''}>
        ${esc(a.name)}${a.specialization?' — '+esc(a.specialization):''}
      </option>`).join('');
    const typeOpts = WORK_TYPES.map(t =>
      `<option value="${esc(t)}" ${o.type===t?'selected':''}>${esc(t)}</option>`).join('');
    const deadlineVal = o.deadline
      ? (o.deadline.includes('T') ? o.deadline.split('T')[0] : o.deadline) : '';
    const deadlineTime = o.deadlineDateTime
      ? (o.deadlineDateTime.split('T')[1]||'').slice(0,5) : '';

    const field = (id, label, input, required=false) => `
      <div class="space-y-1">
        <label class="text-xs font-semibold text-gray-600" for="${id}">
          ${label}${required?'<span class="text-red-500 mr-1">*</span>':''}
        </label>
        ${input}
      </div>`;

    const inp = (id, type, val, ph='', extra='') =>
      `<input id="${id}" type="${type}" value="${esc(val)}" placeholder="${ph}" ${extra}
        class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8FBF3F] focus:border-[#8FBF3F] outline-none bg-white">`;

    return `
    <div id="ord-form-overlay"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onclick="if(event.target===this)OrdersRedesign._closeForm()">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between p-5 border-b border-gray-100 bg-gradient-to-l from-[#f3f9e8] to-white">
          <h3 class="text-lg font-bold text-gray-800 flex items-center gap-2">
            <span class="bg-[#8FBF3F] text-white w-8 h-8 rounded-lg flex items-center justify-center">
              <i class="fas ${isEdit?'fa-edit':'fa-plus'} text-sm"></i>
            </span>
            ${isEdit ? 'ویرایش سفارش' : 'ثبت سفارش جدید'}
          </h3>
          <button onclick="OrdersRedesign._closeForm()"
            class="text-gray-400 hover:text-gray-600 text-xl p-1 transition-colors">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <!-- Form body -->
        <div class="flex-1 overflow-y-auto p-5">
          <form id="ord-main-form" onsubmit="return false" class="space-y-5">

            <!-- بخش ۱: اطلاعات دانشجو -->
            <div class="bg-gray-50 rounded-xl p-4 space-y-3">
              <p class="text-xs font-bold text-gray-500 uppercase tracking-wide">
                <i class="fas fa-user-graduate ml-2 text-[#8FBF3F]"></i>اطلاعات دانشجو
              </p>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                ${field('frm-student-name','نام دانشجو',
                  inp('frm-student-name','text',o.studentName||'','نام و نام خانوادگی دانشجو'),true)}
                ${field('frm-phone','شماره تماس',
                  inp('frm-phone','text',o.phone||'','شماره تلفن'))}
                ${field('frm-passport','شماره پاسپورت',
                  inp('frm-passport','text',o.passportNumber||'','شماره پاسپورت'))}
                ${field('frm-university','دانشگاه',`
                  <select id="frm-university"
                    class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8FBF3F] outline-none bg-white"
                    onchange="document.getElementById('frm-university-custom').style.display=this.value==='سایر'?'block':'none'">
                    <option value="">انتخاب کنید...</option>
                    ${['دانشگاه قم','جامعه المصطفی','دانشگاه تهران','دانشگاه امیرکبیر','سایر']
                      .map(u=>`<option value="${esc(u)}" ${o.university===u?'selected':''}>${esc(u)}</option>`).join('')}
                  </select>
                  <input id="frm-university-custom" type="text" placeholder="نام دانشگاه..."
                    value="${esc(o.university||'')}"
                    style="display:${['دانشگاه قم','جامعه المصطفی','دانشگاه تهران','دانشگاه امیرکبیر',''].includes(o.university||'')?'none':'block'}"
                    class="w-full mt-2 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8FBF3F] outline-none bg-white">`,true)}
                ${field('frm-field','رشته تحصیلی',
                  inp('frm-field','text',o.field||'','مثال: حقوق عمومی'))}
                ${field('frm-degree','مقطع',`
                  <select id="frm-degree"
                    class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8FBF3F] outline-none bg-white">
                    <option value="">---</option>
                    ${[['masters','ارشد'],['phd','دکتری'],['bachelor','کارشناسی']]
                      .map(([v,l])=>`<option value="${v}" ${(o.degree===v)?'selected':''}>${l}</option>`).join('')}
                  </select>`)}
              </div>
            </div>

            <!-- بخش ۲: جزئیات سفارش -->
            <div class="bg-gray-50 rounded-xl p-4 space-y-3">
              <p class="text-xs font-bold text-gray-500 uppercase tracking-wide">
                <i class="fas fa-tasks ml-2 text-[#8FBF3F]"></i>جزئیات سفارش
              </p>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                ${field('frm-type','نوع کار',`
                  <select id="frm-type"
                    class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8FBF3F] outline-none bg-white">
                    <option value="">انتخاب نوع کار...</option>
                    ${typeOpts}
                  </select>`,true)}
                ${field('frm-status','وضعیت',`
                  <select id="frm-status"
                    class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8FBF3F] outline-none bg-white">
                    ${Object.entries(STATUS).map(([v,s])=>
                      `<option value="${v}" ${(o.status||'pending')===v?'selected':''}>${s.label}</option>`).join('')}
                  </select>`)}
                ${field('frm-deadline','مهلت تحویل (تاریخ)',
                  inp('frm-deadline','date',deadlineVal,''))}
                ${field('frm-deadline-time','مهلت تحویل (ساعت)',
                  inp('frm-deadline-time','time',deadlineTime,''))}
                ${field('frm-progress','درصد پیشرفت',`
                  <div class="flex items-center gap-3">
                    <input type="range" id="frm-progress" min="0" max="100"
                      value="${parseInt(o.progress)||0}"
                      class="flex-1 accent-[#8FBF3F]"
                      oninput="document.getElementById('frm-progress-val').textContent=this.value+'٪'">
                    <span id="frm-progress-val" class="text-sm font-semibold text-[#5a7a28] w-10 text-center">
                      ${parseInt(o.progress)||0}٪
                    </span>
                  </div>`)}
              </div>
              ${field('frm-description','توضیحات',`
                <textarea id="frm-description" rows="3" placeholder="توضیحات، الزامات و جزئیات سفارش..."
                  class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8FBF3F] outline-none bg-white">${esc(o.description||'')}</textarea>`)}
            </div>

            <!-- بخش ۳: مالی و تخصیص -->
            <div class="bg-gray-50 rounded-xl p-4 space-y-3">
              <p class="text-xs font-bold text-gray-500 uppercase tracking-wide">
                <i class="fas fa-coins ml-2 text-[#8FBF3F]"></i>مالی و تخصیص
              </p>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                ${field('frm-amount','مبلغ کل',`
                  <div class="flex gap-2">
                    ${inp('frm-amount','number',o.totalAmount||o.cost||'','مبلغ','min="0" step="0.01"')}
                    <select id="frm-currency"
                      class="border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white focus:ring-2 focus:ring-[#8FBF3F] outline-none">
                      <option ${(o.currency||'تومان')==='تومان'?'selected':''}>تومان</option>
                      <option ${o.currency==='دلار'?'selected':''}>دلار</option>
                    </select>
                  </div>`,true)}
                ${field('frm-paid','مبلغ پرداخت شده',
                  inp('frm-paid','number',o.paidAmount||'','','min="0" step="0.01"'))}
                ${field('frm-pay-status','وضعیت پرداخت',`
                  <select id="frm-pay-status"
                    class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8FBF3F] outline-none bg-white">
                    ${Object.entries(PAYMENT_STATUS).map(([v,s])=>
                      `<option value="${v}" ${(o.paymentStatus||'unpaid')===v?'selected':''}>${s.label}</option>`).join('')}
                  </select>`)}
                ${field('frm-agent','تخصیص به عامل',`
                  <select id="frm-agent"
                    class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8FBF3F] outline-none bg-white">
                    <option value="">— بدون تخصیص —</option>${agentOpts}
                  </select>`)}
                ${field('frm-agent-pct','سهم عامل ٪',`
                  <input type="number" id="frm-agent-pct" value="${parseFloat(o.revenueAgentPercent)||60}" min="0" max="100"
                    class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8FBF3F] outline-none bg-white"
                    oninput="document.getElementById('frm-mgr-pct').value=100-this.value">`)}
                ${field('frm-mgr-pct','سهم مدیریت ٪',`
                  <input type="number" id="frm-mgr-pct" value="${parseFloat(o.revenueManagerPercent)||40}" min="0" max="100"
                    class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8FBF3F] outline-none bg-white"
                    oninput="document.getElementById('frm-agent-pct').value=100-this.value">`)}
              </div>
            </div>

          </form>
        </div>
        <!-- Footer -->
        <div class="flex gap-3 p-4 border-t border-gray-100 bg-gray-50">
          <button onclick="OrdersRedesign.submitForm('${sid}')"
            class="flex-1 bg-[#8FBF3F] hover:bg-[#7aac2e] text-white py-2.5 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2">
            <i class="fas fa-save"></i>${isEdit ? 'ذخیره تغییرات' : 'ثبت سفارش'}
          </button>
          <button onclick="OrdersRedesign._closeForm()"
            class="px-5 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-medium transition-colors">
            انصراف
          </button>
        </div>
      </div>
    </div>`;
  }

  // ── مرحله ۹: Public API ─────────────────────────────────────
  // وضعیت داخلی ماژول
  let _currentOrders = [];
  let _currentRole   = 'manager';
  let _currentUserId = '';
  let _currentView   = 'table'; // 'table' | 'cards'

  function _getRoot()   { return document.getElementById('orders-redesign-root'); }
  function _getTbody()  { return document.getElementById('ord-tbody'); }
  function _getCards()  { return document.getElementById('ord-cards-grid'); }

  // بارگذاری و رندر کامل صفحه
  async function getOrdersContent(userRole, userId) {
    _currentRole   = userRole  || 'manager';
    _currentUserId = userId    || '';
    let orders = getOrders();
    orders = filterOrders(orders, _currentRole, _currentUserId);
    orders.sort((a, b) => new Date(b.createdAt||0) - new Date(a.createdAt||0));
    _currentOrders = orders;
    return renderPage(orders, _currentRole);
  }

  // اعمال فیلترها از نوار فیلتر
  function applyFilters() {
    const filtered = applyUIFilters(_currentOrders);
    const tbody = _getTbody();
    if (tbody) tbody.innerHTML = renderTable(filtered, _currentRole);
    const cards = _getCards();
    if (cards) cards.innerHTML = renderCards(filtered, _currentRole);
    const cnt = document.getElementById('ord-count');
    if (cnt) cnt.textContent = `${filtered.length} سفارش`;
    // live search — attach listeners
    _attachLiveSearch();
  }

  function clearFilters() {
    const ids = ['ord-search','ord-status','ord-type','ord-payment'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    applyFilters();
    notify('فیلترها پاک شدند', 'info');
  }

  function _attachLiveSearch() {
    const s = document.getElementById('ord-search');
    if (s && !s._reAttached) {
      s._reAttached = true;
      s.oninput = () => applyFilters();
    }
  }

  // تغییر نما
  function setView(view) {
    _currentView = view;
    const tableWrap = document.getElementById('ord-view-table');
    const cardsWrap = document.getElementById('ord-view-cards');
    const btnTable  = document.getElementById('btn-view-table');
    const btnCards  = document.getElementById('btn-view-cards');
    if (!tableWrap || !cardsWrap) return;
    if (view === 'table') {
      tableWrap.classList.remove('hidden');
      cardsWrap.classList.add('hidden');
      if (btnTable) { btnTable.classList.add('bg-[#8FBF3F]','text-white'); btnTable.classList.remove('bg-white','text-gray-500'); }
      if (btnCards) { btnCards.classList.remove('bg-[#8FBF3F]','text-white'); btnCards.classList.add('bg-white','text-gray-500'); }
    } else {
      tableWrap.classList.add('hidden');
      cardsWrap.classList.remove('hidden');
      if (btnCards) { btnCards.classList.add('bg-[#8FBF3F]','text-white'); btnCards.classList.remove('bg-white','text-gray-500'); }
      if (btnTable) { btnTable.classList.remove('bg-[#8FBF3F]','text-white'); btnTable.classList.add('bg-white','text-gray-500'); }
    }
    applyFilters();
  }

  // باز کردن جزئیات
  function openDetail(orderId) {
    const order = getOrders().find(o => o.id === orderId);
    if (!order) { notify('سفارش یافت نشد', 'error'); return; }
    // اگر OrderPagesModule موجود باشد — از آن استفاده کن
    if (typeof OrderPagesModule !== 'undefined') {
      OrderPagesModule.showOrderPage(orderId);
      return;
    }
    const container = document.getElementById('ord-detail-modal');
    if (!container) return;
    container.innerHTML = renderDetailModal(order, _currentRole);
    // فعال کردن live search بعد از رندر مودال
    setTimeout(() => _switchTab('overview'), 50);
  }

  function _closeDetail() {
    const overlay = document.getElementById('ord-detail-overlay');
    if (overlay) overlay.remove();
    const container = document.getElementById('ord-detail-modal');
    if (container) container.innerHTML = '';
  }

  // باز کردن فرم ایجاد
  function openCreate() {
    // اگر OrderWizardModule موجود باشد — از آن استفاده کن
    if (typeof OrderWizardModule !== 'undefined' && typeof ModalsModule !== 'undefined') {
      const app = ModalsModule.getAlpineData ? ModalsModule.getAlpineData() : null;
      if (app) { app.showModal = 'createProject'; return; }
    }
    const container = document.getElementById('ord-form-modal');
    if (!container) return;
    container.innerHTML = renderFormModal(null, _currentRole);
  }

  // باز کردن فرم ویرایش
  function openEdit(orderId) {
    const order = getOrders().find(o => o.id === orderId);
    if (!order) { notify('سفارش یافت نشد', 'error'); return; }
    const container = document.getElementById('ord-form-modal');
    if (!container) return;
    container.innerHTML = renderFormModal(order, _currentRole);
  }

  function _closeForm() {
    const overlay = document.getElementById('ord-form-overlay');
    if (overlay) overlay.remove();
    const container = document.getElementById('ord-form-modal');
    if (container) container.innerHTML = '';
  }

  // ثبت/ذخیره فرم
  function submitForm(orderId) {
    const isEdit = !!orderId;

    // خواندن مقادیر
    const studentName = document.getElementById('frm-student-name')?.value.trim();
    const type        = document.getElementById('frm-type')?.value;
    const uniSel      = document.getElementById('frm-university')?.value;
    const uniCustom   = document.getElementById('frm-university-custom')?.value.trim();
    const university  = uniSel === 'سایر' ? uniCustom : uniSel;

    if (!studentName) { notify('نام دانشجو الزامی است', 'error'); return; }
    if (!type)        { notify('نوع کار را انتخاب کنید', 'error'); return; }
    if (!university)  { notify('دانشگاه را وارد کنید', 'error'); return; }
    const totalAmount = parseFloat(document.getElementById('frm-amount')?.value) || 0;
    if (!totalAmount) { notify('مبلغ سفارش الزامی است', 'error'); return; }

    const deadlineDate = document.getElementById('frm-deadline')?.value || '';
    const deadlineTime = document.getElementById('frm-deadline-time')?.value || '00:00';
    const deadline     = deadlineDate ? `${deadlineDate}T${deadlineTime}` : '';
    const agentId      = document.getElementById('frm-agent')?.value || null;
    const agentObj     = agentId ? AGENTS().find(a => a.id === agentId) : null;
    const agentPct     = parseFloat(document.getElementById('frm-agent-pct')?.value) || 60;
    const mgrPct       = parseFloat(document.getElementById('frm-mgr-pct')?.value)   || 40;

    const updates = {
      studentName,
      type,
      university,
      field:                 document.getElementById('frm-field')?.value.trim() || '',
      degree:                document.getElementById('frm-degree')?.value || '',
      status:                document.getElementById('frm-status')?.value || 'pending',
      deadline,
      deadlineDateTime:      deadline,
      description:           document.getElementById('frm-description')?.value.trim() || '',
      totalAmount,
      cost:                  totalAmount,
      currency:              document.getElementById('frm-currency')?.value || 'تومان',
      paidAmount:            parseFloat(document.getElementById('frm-paid')?.value) || 0,
      paymentStatus:         document.getElementById('frm-pay-status')?.value || 'unpaid',
      assignedDoctorId:      agentId,
      assignedAgentId:       agentId,
      assignedDoctor:        agentObj ? agentObj.name : null,
      revenueAgentPercent:   agentPct,
      revenueManagerPercent: mgrPct,
      phone:                 document.getElementById('frm-phone')?.value.trim() || '',
      passportNumber:        document.getElementById('frm-passport')?.value.trim() || '',
      progress:              parseInt(document.getElementById('frm-progress')?.value) || 0,
      updatedAt:             new Date().toISOString(),
    };

    const orders = getOrders();
    if (isEdit) {
      const idx = orders.findIndex(o => o.id === orderId);
      if (idx === -1) { notify('سفارش یافت نشد', 'error'); return; }
      orders[idx] = { ...orders[idx], ...updates };
      saveOrders(orders);
      notify('سفارش ویرایش شد ✓', 'success');
    } else {
      const newOrder = {
        id: 'ORD-' + Date.now(),
        ...updates,
        createdAt:  new Date().toISOString(),
        workLog:    [],
        tasks:      [],
        files:      [],
        rejectionHistory: [],
        isCustomOrder: false,
      };
      orders.unshift(newOrder);
      saveOrders(orders);
      notify('سفارش ثبت شد ✓', 'success');
    }
    _closeForm();
    refresh();
  }

  // تغییر وضعیت سفارش
  function changeStatus(orderId, newStatus) {
    if (!confirm(`آیا از تغییر وضعیت به "${STATUS[newStatus]?.label || newStatus}" اطمینان دارید؟`)) return;
    const orders = getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) { notify('سفارش یافت نشد', 'error'); return; }
    const user = currentUser();
    const logEntry = {
      id: Date.now().toString(36),
      type: 'status_change',
      message: `وضعیت از "${STATUS[orders[idx].status]?.label || orders[idx].status}" به "${STATUS[newStatus]?.label || newStatus}" تغییر کرد`,
      timestamp: new Date().toISOString(),
      by: user.name || user.id || '',
    };
    orders[idx] = {
      ...orders[idx],
      status: newStatus,
      updatedAt: new Date().toISOString(),
      ...(newStatus === 'completed' ? { progress: 100, completedAt: new Date().toISOString() } : {}),
      workLog: [...(orders[idx].workLog || []), logEntry],
    };
    saveOrders(orders);
    notify(`وضعیت سفارش به "${STATUS[newStatus]?.label}" تغییر کرد`, 'success');
    _refreshRow(orderId, orders[idx]);
    refresh();
  }

  // حذف سفارش
  function deleteOrder(orderId) {
    if (!confirm('آیا از حذف این سفارش اطمینان دارید؟ این عمل غیرقابل بازگشت است.')) return;
    const orders = getOrders().filter(o => o.id !== orderId);
    saveOrders(orders);
    _currentOrders = _currentOrders.filter(o => o.id !== orderId);
    notify('سفارش حذف شد', 'warning');
    // حذف ردیف از جدول بدون reload کامل
    const row = document.getElementById(`ord-row-${esc(orderId)}`);
    if (row) {
      row.style.transition = 'opacity 0.3s';
      row.style.opacity = '0';
      setTimeout(() => { row.remove(); _updateCount(); }, 300);
    } else {
      refresh();
    }
  }

  // ثبت پرداخت جدید از مودال جزئیات
  function addPayment(orderId) {
    const amount = parseFloat(document.getElementById('det-pay-amount')?.value);
    if (!amount || amount <= 0) { notify('مبلغ معتبر وارد کنید', 'error'); return; }
    const orders = getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) { notify('سفارش یافت نشد', 'error'); return; }

    const newPaid = (parseFloat(orders[idx].paidAmount) || 0) + amount;
    const total   = parseFloat(orders[idx].totalAmount || orders[idx].cost) || 0;
    const payStatus = newPaid >= total ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';
    const user = currentUser();
    const logEntry = {
      id: Date.now().toString(36),
      type: 'payment',
      message: `پرداخت ${fmt(amount)} ${document.getElementById('det-pay-currency')?.value || 'تومان'} ثبت شد`,
      timestamp: new Date().toISOString(),
      by: user.name || '',
    };
    orders[idx] = {
      ...orders[idx],
      paidAmount: newPaid,
      paymentStatus: payStatus,
      updatedAt: new Date().toISOString(),
      workLog: [...(orders[idx].workLog || []), logEntry],
    };
    saveOrders(orders);
    notify(`پرداخت ${fmt(amount)} ثبت شد ✓`, 'success');
    _closeDetail();
    refresh();
  }

  // ذخیره تخصیص عامل از مودال جزئیات
  function saveAssignment(orderId) {
    const agentId = document.getElementById('det-agent-select')?.value || null;
    const notes   = document.getElementById('det-agent-notes')?.value.trim() || '';
    const orders  = getOrders();
    const idx     = orders.findIndex(o => o.id === orderId);
    if (idx === -1) { notify('سفارش یافت نشد', 'error'); return; }

    const agentObj = agentId ? AGENTS().find(a => a.id === agentId) : null;
    const user = currentUser();
    const logEntry = {
      id: Date.now().toString(36),
      type: 'assignment',
      message: agentObj
        ? `سفارش به ${agentObj.name} تخصیص داده شد`
        : 'تخصیص عامل لغو شد',
      notes,
      timestamp: new Date().toISOString(),
      by: user.name || '',
    };
    orders[idx] = {
      ...orders[idx],
      assignedDoctorId: agentId,
      assignedAgentId:  agentId,
      assignedDoctor:   agentObj ? agentObj.name : null,
      assignedAt:       agentId ? new Date().toISOString() : null,
      assignmentNotes:  notes,
      updatedAt:        new Date().toISOString(),
      workLog: [...(orders[idx].workLog || []), logEntry],
    };
    saveOrders(orders);
    notify(agentObj ? `سفارش به ${agentObj.name} تخصیص یافت ✓` : 'تخصیص لغو شد', 'success');
    _closeDetail();
    refresh();
  }

  // ذخیره درصد تقسیم از مودال جزئیات
  function saveRevenueSplit(orderId) {
    const agentPct = parseFloat(document.getElementById('det-agent-pct')?.value) || 60;
    const mgrPct   = parseFloat(document.getElementById('det-mgr-pct')?.value)   || 40;
    if (Math.abs(agentPct + mgrPct - 100) > 0.01) {
      notify('جمع درصدها باید ۱۰۰ باشد', 'error'); return;
    }
    const orders = getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) { notify('سفارش یافت نشد', 'error'); return; }
    orders[idx] = {
      ...orders[idx],
      revenueAgentPercent:   agentPct,
      revenueManagerPercent: mgrPct,
      updatedAt: new Date().toISOString(),
    };
    saveOrders(orders);
    notify('درصد تقسیم ذخیره شد ✓', 'success');
    _closeDetail();
    refresh();
  }

  // افزودن یادداشت به تاریخچه
  function addNote(orderId) {
    const text = document.getElementById('det-log-note')?.value.trim();
    if (!text) { notify('یادداشت خالی است', 'error'); return; }
    const orders = getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) return;
    const user = currentUser();
    const logEntry = {
      id: Date.now().toString(36),
      type: 'note',
      message: text,
      timestamp: new Date().toISOString(),
      by: user.name || '',
    };
    orders[idx].workLog = [...(orders[idx].workLog || []), logEntry];
    orders[idx].updatedAt = new Date().toISOString();
    saveOrders(orders);
    notify('یادداشت ثبت شد ✓', 'success');
    // بروزرسانی لیست لاگ بدون بستن مودال
    const input = document.getElementById('det-log-note');
    if (input) input.value = '';
    const logTab = document.getElementById('dtab-log');
    if (logTab) {
      const allLogs = (orders[idx].workLog || [])
        .slice().reverse()
        .map(l => {
          const icon = l.type==='assignment' ? 'fa-user-plus text-blue-500'
                     : l.type==='rejection'  ? 'fa-ban text-red-500'
                     : l.type==='payment'    ? 'fa-coins text-green-500'
                     : 'fa-circle text-gray-400';
          return `<div class="flex gap-3 items-start bg-gray-50 rounded-lg p-3">
            <i class="fas ${icon} text-sm mt-0.5"></i>
            <div class="flex-1"><p class="text-sm text-gray-700">${esc(l.message||'')}</p>
              <p class="text-[10px] text-gray-400 mt-1">${fmtDate(l.timestamp)} ${l.by?'— '+esc(l.by):''}</p>
            </div></div>`;
        }).join('');
      const existingItems = logTab.querySelector('.space-y-3 > div:not(.border-t)');
      const itemsContainer = logTab.querySelector('.space-y-3');
      if (itemsContainer) {
        const borderDiv = itemsContainer.querySelector('.border-t');
        itemsContainer.innerHTML = allLogs + (borderDiv ? borderDiv.outerHTML : '');
      }
    }
  }

  // دانلود CSV
  function exportCSV() {
    const filtered = applyUIFilters(_currentOrders);
    const headers = ['شماره','دانشجو','دانشگاه','نوع کار','وضعیت','پیشرفت','مبلغ','پرداخت شده','وضعیت پرداخت','عامل','مهلت','تاریخ ثبت'];
    const rows = filtered.map(o => [
      o.id, o.studentName||'', o.university||'', o.type||'',
      STATUS[o.status]?.label||o.status||'',
      (o.progress||0)+'%',
      (o.totalAmount||o.cost||0), (o.paidAmount||0),
      PAYMENT_STATUS[o.paymentStatus]?.label||'',
      o.assignedDoctor||'',
      o.deadline||'', o.createdAt||'',
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `orders_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    notify('فایل CSV دانلود شد ✓', 'success');
  }

  // تابع داخلی: بروزرسانی تعداد نمایشی
  function _updateCount() {
    const cnt = document.getElementById('ord-count');
    if (cnt) {
      const rows = document.querySelectorAll('#ord-tbody tr[id^="ord-row-"]').length;
      cnt.textContent = `${rows} سفارش`;
    }
  }

  // تابع داخلی: بروزرسانی یک ردیف جدول بدون reload
  function _refreshRow(orderId, updatedOrder) {
    const row = document.getElementById(`ord-row-${esc(orderId)}`);
    if (row) {
      const tmp = document.createElement('tbody');
      tmp.innerHTML = renderTableRow(updatedOrder, _currentRole);
      row.replaceWith(tmp.firstElementChild);
    }
  }

  // تابع داخلی: سوئیچ تب در مودال جزئیات
  function _switchTab(tabId) {
    const tabs = ['overview','financial','agent','log'];
    tabs.forEach(t => {
      const content = document.getElementById(`dtab-${t}`);
      const btn     = document.getElementById(`dtab-btn-${t}`);
      if (content) content.classList.toggle('hidden', t !== tabId);
      if (btn) {
        btn.classList.toggle('border-[#8FBF3F]', t === tabId);
        btn.classList.toggle('text-[#5a7a28]',   t === tabId);
        btn.classList.toggle('border-transparent', t !== tabId);
        btn.classList.toggle('text-gray-500',      t !== tabId);
      }
    });
  }

  // بازخوانی کامل صفحه
  async function refresh() {
    // اگر UIRefresh موجود باشد
    if (typeof UIRefresh !== 'undefined') { await UIRefresh.orders(); return; }
    // یا از طریق Alpine app controller
    try {
      const appEl = document.querySelector('[x-data]');
      if (appEl) {
        const alpineData = appEl.__x?.$data || (typeof Alpine !== 'undefined' ? Alpine.$data(appEl) : null);
        if (alpineData && typeof alpineData.loadOrdersPageWithRetry === 'function') {
          await alpineData.loadOrdersPageWithRetry();
          return;
        }
      }
    } catch(e) {}
    // fallback: بروزرسانی فقط tbody و cards
    const newOrders = getOrders();
    _currentOrders = filterOrders(newOrders, _currentRole, _currentUserId)
      .sort((a,b) => new Date(b.createdAt||0) - new Date(a.createdAt||0));
    applyFilters();
  }

  // ── بستن IIFE و export ──────────────────────────────────────
  return {
    // public interface
    getOrdersContent,
    applyFilters,
    clearFilters,
    setView,
    openDetail,
    openCreate,
    openEdit,
    submitForm,
    changeStatus,
    deleteOrder,
    addPayment,
    saveAssignment,
    saveRevenueSplit,
    addNote,
    exportCSV,
    refresh,
    // internal helpers exposed for HTML onclick
    _switchTab,
    _closeDetail,
    _closeForm,
  };

})();

// ── اتصال به OrdersModule (جایگزین شفاف) ───────────────────
// اگر OrdersModule قبلاً تعریف شده، getOrdersContent آن را override می‌کنیم
// تا app.js بدون تغییر کار کند
(function patchOrdersModule() {
  const patch = () => {
    if (typeof window.OrdersModule !== 'undefined') {
      window.OrdersModule.getOrdersContent = OrdersRedesign.getOrdersContent.bind(OrdersRedesign);
      window.OrdersModule.filterOrders    = OrdersRedesign.applyFilters.bind(OrdersRedesign);
      window.OrdersModule.clearFilters    = OrdersRedesign.clearFilters.bind(OrdersRedesign);
      window.OrdersModule.viewDetails     = OrdersRedesign.openDetail.bind(OrdersRedesign);
      window.OrdersModule.editOrder       = OrdersRedesign.openEdit.bind(OrdersRedesign);
      window.OrdersModule.deleteOrder     = OrdersRedesign.deleteOrder.bind(OrdersRedesign);
      window.OrdersModule.completeOrder   = (id) => OrdersRedesign.changeStatus(id, 'completed');
      window.OrdersModule.refreshOrders   = OrdersRedesign.refresh.bind(OrdersRedesign);
      window.OrdersModuleReady = true;
      console.log('✅ OrdersRedesign: OrdersModule patched successfully');
    }
  };
  // اگر قبلاً لود شده
  if (typeof window.OrdersModule !== 'undefined') { patch(); return; }
  // منتظر DOM آماده شدن
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(patch, 100));
  } else {
    setTimeout(patch, 100);
  }
})();

// global دسترسی مستقیم از HTML onclick
window.OrdersRedesign = OrdersRedesign;
console.log('✅ orders-redesign.js بارگذاری شد');
