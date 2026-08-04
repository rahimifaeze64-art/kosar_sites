/**
 * order-detail-redesign.js
 * بازطراحی کامل صفحه جزئیات سفارش
 * جایگزین OrderPagesModule و OrderTabsModule می‌شود
 */
const OrderDetailRedesign = (function () {
  'use strict';

  // ── ثابت‌ها ─────────────────────────────────────────────────
  const STATUS = {
    pending:     { label:'در انتظار',    cls:'bg-amber-100 text-amber-800 border border-amber-200',  icon:'fa-clock',        dot:'bg-amber-400' },
    in_progress: { label:'در حال انجام', cls:'bg-blue-100 text-blue-800 border border-blue-200',    icon:'fa-spinner',      dot:'bg-blue-500' },
    completed:   { label:'تکمیل شده',   cls:'bg-green-100 text-green-800 border border-green-200',  icon:'fa-check-circle', dot:'bg-green-500' },
    cancelled:   { label:'لغو شده',     cls:'bg-red-100 text-red-800 border border-red-200',        icon:'fa-ban',          dot:'bg-red-500' },
    approved:    { label:'تایید شده',   cls:'bg-teal-100 text-teal-800 border border-teal-200',     icon:'fa-check-double', dot:'bg-teal-500' },
    rejected:    { label:'رد شده',      cls:'bg-rose-100 text-rose-800 border border-rose-200',     icon:'fa-ban',          dot:'bg-rose-500' },
  };

  const PAYMENT_STATUS = {
    unpaid:  { label:'پرداخت نشده', cls:'bg-red-50 text-red-700',    icon:'fa-times-circle' },
    partial: { label:'پرداخت جزئی', cls:'bg-amber-50 text-amber-700', icon:'fa-adjust' },
    paid:    { label:'پرداخت کامل', cls:'bg-green-50 text-green-700', icon:'fa-check-circle' },
  };

  const FILE_TYPES = [
    'اولیه','تعدیل شده','تنضید قبل دفاع','تنضید بعد دفاع',
    'تنضید اولیه','تعدیل بعد دفاع','استلال عراقی بعد دفاع',
    'تنضید ایرانداک','سایر'
  ];

  // ── توابع کمکی ──────────────────────────────────────────────
  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function fmt(n) {
    return (parseFloat(n) || 0).toLocaleString('fa-IR');
  }

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
    const s = STATUS[status] || { label: status||'---', cls:'bg-gray-100 text-gray-600 border border-gray-200', icon:'fa-circle' };
    return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.cls}">
      <i class="fas ${s.icon} text-[10px]"></i>${s.label}</span>`;
  }

  function progressRing(pct) {
    const p = Math.min(100, Math.max(0, parseInt(pct) || 0));
    const r = 28, circ = 2 * Math.PI * r;
    const offset = circ - (p / 100) * circ;
    const color = p < 30 ? '#ef4444' : p < 70 ? '#f59e0b' : '#22c55e';
    return `<div class="relative w-16 h-16 flex items-center justify-center">
      <svg class="absolute w-16 h-16 -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="${r}" fill="none" stroke="#e5e7eb" stroke-width="4"/>
        <circle cx="32" cy="32" r="${r}" fill="none" stroke="${color}" stroke-width="4"
          stroke-dasharray="${circ}" stroke-dashoffset="${offset}"
          stroke-linecap="round" style="transition:stroke-dashoffset 0.6s ease"/>
      </svg>
      <span class="text-sm font-bold" style="color:${color}">${p}%</span>
    </div>`;
  }

  function getOrders() {
    if (typeof DataModule !== 'undefined') return DataModule.getOrders() || [];
    try {
      const k = typeof CONFIG !== 'undefined' ? CONFIG.STORAGE_KEYS?.ORDERS : 'edu_system_orders';
      return JSON.parse(localStorage.getItem(k || 'edu_system_orders') || '[]');
    } catch(e) { return []; }
  }

  function saveOrders(orders) {
    if (typeof DataModule !== 'undefined') { DataModule.saveOrders(orders); return; }
    const k = typeof CONFIG !== 'undefined' ? CONFIG.STORAGE_KEYS?.ORDERS : 'edu_system_orders';
    localStorage.setItem(k || 'edu_system_orders', JSON.stringify(orders));
  }

  function getUsers() {
    try {
      if (typeof DataModule !== 'undefined') return DataModule.getUsers() || [];
      if (typeof HARDCODED_USERS !== 'undefined') return HARDCODED_USERS;
    } catch(e) {}
    return [];
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

  // state داخلی مودال
  let _orderId = null;
  let _activeTab = 'overview';

  // ── هدر سفارش ───────────────────────────────────────────────
  function renderHeader(order, userRole) {
    const agents = getUsers().filter(u => u.role === 'agent');
    const agentObj = agents.find(a => a.id === (order.assignedDoctorId || order.assignedAgentId));
    const agentName = agentObj ? agentObj.name : (order.assignedDoctor || '');
    const currency = esc(order.currency || 'تومان');
    const total = parseFloat(order.totalAmount || order.cost || 0);
    const pst = PAYMENT_STATUS[order.paymentStatus] || PAYMENT_STATUS.unpaid;

    return `
    <div class="bg-gradient-to-l from-[#f3f9e8] via-white to-[#eef7ff] border-b border-gray-200 px-6 py-5">
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <!-- اطلاعات اصلی -->
        <div class="flex items-start gap-4">
          <div class="w-14 h-14 rounded-2xl bg-[#8FBF3F] text-white flex items-center justify-center text-2xl font-black shadow-sm flex-shrink-0">
            ${esc(order.studentName || '?').charAt(0)}
          </div>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h2 class="text-xl font-bold text-gray-900">${esc(order.studentName || '---')}</h2>
              ${statusBadge(order.status)}
            </div>
            <p class="text-sm text-gray-500 mt-0.5">
              ${esc(order.isCustomOrder ? (order.title || order.type) : order.type) || '---'}
              ${order.university ? ` — ${esc(order.university)}` : ''}
              ${order.degree ? ` — ${esc(order.degree)}` : ''}
            </p>
            <div class="flex items-center gap-3 mt-2 flex-wrap">
              <span class="text-xs text-gray-500 flex items-center gap-1">
                <i class="fas fa-hashtag text-[#8FBF3F]"></i>
                <code class="font-mono">${String(order.id).slice(-8).toUpperCase()}</code>
              </span>
              <span class="text-xs text-gray-500 flex items-center gap-1">
                <i class="fas fa-calendar-plus text-[#8FBF3F]"></i>
                ${fmtDate(order.createdAt)}
              </span>
              ${order.deadline || order.deadlineDateTime ? `
              <span class="text-xs flex items-center gap-1">
                <i class="fas fa-calendar-alt text-amber-500"></i>
                ${fmtDeadline(order.deadline || order.deadlineDateTime)}
              </span>` : ''}
            </div>
          </div>
        </div>

        <!-- کارت‌های آماری -->
        <div class="flex gap-3 flex-wrap">
          <!-- مبلغ -->
          <div class="bg-white rounded-xl border border-gray-200 px-4 py-3 text-center shadow-sm min-w-[100px]">
            <p class="text-[10px] text-gray-400 mb-0.5">مبلغ کل</p>
            <p class="text-base font-black text-gray-800">${fmt(total)}</p>
            <p class="text-[10px] text-gray-500">${currency}</p>
          </div>
          <!-- پرداخت -->
          <div class="rounded-xl border px-4 py-3 text-center shadow-sm min-w-[100px] ${pst.cls}">
            <p class="text-[10px] opacity-70 mb-0.5">پرداخت</p>
            <p class="text-base font-black">${fmt(order.paidAmount || 0)}</p>
            <p class="text-[10px] opacity-80">${pst.label}</p>
          </div>
          <!-- پیشرفت -->
          <div class="bg-white rounded-xl border border-gray-200 px-4 py-2 flex items-center justify-center shadow-sm">
            ${progressRing(order.progress)}
          </div>
          <!-- عامل -->
          ${agentName ? `
          <div class="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-2 shadow-sm">
            <div class="w-8 h-8 rounded-full bg-[#8FBF3F] text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
              ${esc(agentName).charAt(0)}
            </div>
            <div>
              <p class="text-[10px] text-gray-400">عامل</p>
              <p class="text-xs font-semibold text-gray-800">${esc(agentName)}</p>
            </div>
          </div>` : ''}
        </div>
      </div>

      <!-- نوار اکشن‌های سریع -->
      ${canManage(userRole) ? `
      <div class="flex gap-2 mt-4 flex-wrap">
        ${order.status === 'pending' ? `
        <button onclick="OrderDetailRedesign.quickAction('${esc(order.id)}','in_progress')"
          class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5">
          <i class="fas fa-play text-[10px]"></i>شروع کار
        </button>` : ''}
        ${order.status === 'in_progress' ? `
        <button onclick="OrderDetailRedesign.quickAction('${esc(order.id)}','completed')"
          class="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5">
          <i class="fas fa-check-double text-[10px]"></i>اعلام تکمیل
        </button>` : ''}
        ${order.status !== 'cancelled' && order.status !== 'completed' ? `
        <button onclick="OrderDetailRedesign.quickAction('${esc(order.id)}','cancelled')"
          class="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 border border-red-200">
          <i class="fas fa-ban text-[10px]"></i>لغو سفارش
        </button>` : ''}
        <button onclick="OrderDetailRedesign.openEdit('${esc(order.id)}')"
          class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5">
          <i class="fas fa-edit text-[10px]"></i>ویرایش
        </button>
        <button onclick="OrderDetailRedesign.printOrder('${esc(order.id)}')"
          class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5">
          <i class="fas fa-print text-[10px]"></i>چاپ
        </button>
      </div>` : ''}
    </div>`;
  }

  // ── تب‌بار ───────────────────────────────────────────────────
  const TABS = [
    { id:'overview',    icon:'fa-info-circle',    label:'مشخصات'       },
    { id:'financial',   icon:'fa-coins',          label:'مالی'         },
    { id:'assignment',  icon:'fa-user-tie',       label:'تخصیص'        },
    { id:'files',       icon:'fa-paperclip',      label:'فایل‌ها'      },
    { id:'history',     icon:'fa-history',        label:'تاریخچه'      },
  ];

  function renderTabBar(activeTab) {
    return `
    <div class="flex border-b border-gray-200 bg-white overflow-x-auto px-4 flex-shrink-0" id="odr-tabbar">
      ${TABS.map(t => `
        <button id="odr-tab-btn-${t.id}"
          onclick="OrderDetailRedesign.switchTab('${t.id}')"
          class="flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors
            ${t.id === activeTab
              ? 'border-[#8FBF3F] text-[#5a7a28]'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}">
          <i class="fas ${t.icon} text-xs"></i>${t.label}
        </button>`).join('')}
    </div>`;
  }

  // ── تب ۱: مشخصات کلی ────────────────────────────────────────
  function renderOverviewTab(order, userRole) {
    const infoRow = (icon, label, val, colorCls='text-gray-800') =>
      val ? `<div class="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0">
        <i class="fas ${icon} text-sm text-[#8FBF3F] mt-0.5 w-4 text-center flex-shrink-0"></i>
        <span class="text-xs text-gray-400 w-24 flex-shrink-0 pt-0.5">${label}</span>
        <span class="text-sm font-medium ${colorCls} flex-1">${val}</span>
      </div>` : '';

    const degreeMap = { masters:'ارشد', phd:'دکتری', bachelor:'کارشناسی' };
    const degreeLabel = degreeMap[order.degree] || esc(order.degree || '');

    return `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">

      <!-- کارت اطلاعات دانشجو -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2">
            <i class="fas fa-user-graduate text-[#8FBF3F]"></i>اطلاعات دانشجو
          </h4>
        </div>
        <div class="px-4 py-1">
          ${infoRow('fa-user', 'نام', esc(order.studentName || '---'), 'text-gray-900 font-semibold')}
          ${infoRow('fa-university', 'دانشگاه', esc(order.university || '---'))}
          ${infoRow('fa-graduation-cap', 'رشته', esc(order.field || '---'))}
          ${infoRow('fa-layer-group', 'مقطع', degreeLabel)}
          ${infoRow('fa-passport', 'پاسپورت', esc(order.passportNumber || '---'))}
          ${infoRow('fa-phone', 'تلفن', esc(order.phone || '---'))}
        </div>
      </div>

      <!-- کارت جزئیات سفارش -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2">
            <i class="fas fa-clipboard-list text-[#8FBF3F]"></i>جزئیات سفارش
          </h4>
        </div>
        <div class="px-4 py-1">
          ${infoRow('fa-tasks', 'نوع کار', esc(order.isCustomOrder ? (order.title||order.type) : order.type) || '---')}
          ${infoRow('fa-circle', 'وضعیت', statusBadge(order.status))}
          ${infoRow('fa-calendar-check', 'تاریخ ثبت', fmtDate(order.createdAt))}
          ${infoRow('fa-calendar-alt', 'مهلت تحویل', fmtDeadline(order.deadline || order.deadlineDateTime))}
          ${order.stage ? infoRow('fa-map-marker-alt', 'مرحله', esc(order.stage)) : ''}
          ${infoRow('fa-user-check', 'ثبت کننده', esc(order.createdBy || '---'))}
        </div>
      </div>

      <!-- پیشرفت کار -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2">
            <i class="fas fa-chart-line text-[#8FBF3F]"></i>پیشرفت کار
          </h4>
          <span class="text-sm font-bold text-[#5a7a28]">${Math.min(100,parseInt(order.progress)||0)}%</span>
        </div>
        <div class="p-4 space-y-3">
          <div class="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            ${(() => {
              const p = Math.min(100, parseInt(order.progress) || 0);
              const color = p < 30 ? 'bg-red-400' : p < 70 ? 'bg-amber-400' : 'bg-green-500';
              return `<div class="${color} h-3 rounded-full transition-all duration-700" style="width:${p}%"></div>`;
            })()}
          </div>
          ${canManage(userRole) ? `
          <div class="flex items-center gap-3 mt-2">
            <label class="text-xs text-gray-500 flex-shrink-0">بروزرسانی:</label>
            <input type="range" min="0" max="100" value="${parseInt(order.progress)||0}"
              class="flex-1 accent-[#8FBF3F]"
              oninput="document.getElementById('odr-prog-val').textContent=this.value+'%'"
              onchange="OrderDetailRedesign.updateProgress('${esc(order.id)}',this.value)">
            <span id="odr-prog-val" class="text-xs font-bold text-[#5a7a28] w-10 text-center">
              ${parseInt(order.progress)||0}%
            </span>
          </div>` : ''}
        </div>
      </div>

      <!-- توضیحات -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2">
            <i class="fas fa-comment-alt text-[#8FBF3F]"></i>توضیحات
          </h4>
        </div>
        <div class="p-4">
          ${order.description
            ? `<p class="text-sm text-gray-700 leading-relaxed">${esc(order.description)}</p>`
            : `<p class="text-sm text-gray-400 italic">توضیحاتی ثبت نشده</p>`}
          ${order.attachmentName ? `
          <div class="mt-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
            <i class="fas fa-paperclip text-amber-500 text-sm"></i>
            <span class="text-sm text-gray-700 flex-1 truncate">${esc(order.attachmentName)}</span>
            ${order.hasAttachment
              ? `<button onclick="window.downloadOrderFile && downloadOrderFile('${esc(order.id)}','${esc(order.attachmentName)}')"
                   class="text-xs bg-white border border-amber-300 text-amber-700 px-2 py-1 rounded hover:bg-amber-50 flex-shrink-0">
                   <i class="fas fa-download ml-1"></i>دانلود
                 </button>`
              : `<span class="text-xs text-gray-400">در دسترس نیست</span>`}
          </div>` : ''}
        </div>
      </div>

    </div>`;
  }

  // ── تب ۲: مالی ──────────────────────────────────────────────
  function renderFinancialTab(order, userRole) {
    const currency = esc(order.currency || 'تومان');
    const total    = parseFloat(order.totalAmount || order.cost || 0);
    const paid     = parseFloat(order.paidAmount || 0);
    const remaining = Math.max(0, total - paid);
    const paidPct  = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
    const agentPct = parseFloat(order.revenueAgentPercent  || 60);
    const mgrPct   = parseFloat(order.revenueManagerPercent || 40);
    const agentShare = total * agentPct / 100;
    const mgrShare   = total * mgrPct  / 100;
    const pst = PAYMENT_STATUS[order.paymentStatus] || PAYMENT_STATUS.unpaid;

    // تاریخچه پرداخت‌ها از workLog
    const payLogs = (order.workLog || []).filter(l => l.type === 'payment');

    return `
    <div class="space-y-5">

      <!-- کارت‌های خلاصه مالی -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        ${[
          { label:'مبلغ کل',       val:`${fmt(total)} ${currency}`,      icon:'fa-coins',          bg:'bg-gray-50',     tc:'text-gray-800' },
          { label:'پرداخت شده',    val:`${fmt(paid)} ${currency}`,       icon:'fa-check-circle',   bg:'bg-green-50',    tc:'text-green-700' },
          { label:'مانده',         val:`${fmt(remaining)} ${currency}`,  icon:'fa-hourglass-half', bg:'bg-red-50',      tc:'text-red-700' },
          { label:'وضعیت',         val:pst.label,                         icon:'fa-credit-card',    bg:pst.cls,          tc:'' },
        ].map(c => `
          <div class="${c.bg} rounded-xl border border-gray-100 p-4 text-center shadow-sm">
            <i class="fas ${c.icon} text-xl mb-2 block ${c.tc || 'text-gray-500'}"></i>
            <p class="text-xs text-gray-500 mb-1">${c.label}</p>
            <p class="text-sm font-black ${c.tc}">${c.val}</p>
          </div>`).join('')}
      </div>

      <!-- نوار پیشرفت پرداخت -->
      <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div class="flex justify-between items-center mb-2">
          <span class="text-sm font-semibold text-gray-700">میزان پرداخت</span>
          <span class="text-sm font-bold text-[#5a7a28]">${paidPct}٪</span>
        </div>
        <div class="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div class="${paidPct >= 100 ? 'bg-green-500' : paidPct >= 50 ? 'bg-amber-400' : 'bg-red-400'} h-3 rounded-full transition-all duration-700"
               style="width:${paidPct}%"></div>
        </div>
        <div class="flex justify-between text-xs text-gray-400 mt-1">
          <span>پرداخت: ${fmt(paid)} ${currency}</span>
          <span>مانده: ${fmt(remaining)} ${currency}</span>
        </div>
      </div>

      <!-- تقسیم درآمد -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2">
            <i class="fas fa-percent text-[#8FBF3F]"></i>تقسیم درآمد
          </h4>
        </div>
        <div class="p-4">
          <div class="grid grid-cols-2 gap-3 mb-4">
            <div class="bg-[#f3f9e8] rounded-xl p-4 text-center border border-[#d4edaa]">
              <p class="text-xs text-gray-500 mb-1">سهم عامل (${agentPct}٪)</p>
              <p class="text-xl font-black text-[#5a7a28]">${fmt(agentShare)}</p>
              <p class="text-xs text-gray-400 mt-0.5">${currency}</p>
            </div>
            <div class="bg-blue-50 rounded-xl p-4 text-center border border-blue-100">
              <p class="text-xs text-gray-500 mb-1">سهم مدیریت (${mgrPct}٪)</p>
              <p class="text-xl font-black text-blue-700">${fmt(mgrShare)}</p>
              <p class="text-xs text-gray-400 mt-0.5">${currency}</p>
            </div>
          </div>
          <!-- نوار تقسیم بصری -->
          <div class="w-full h-2.5 rounded-full overflow-hidden flex">
            <div class="bg-[#8FBF3F] h-full transition-all" style="width:${agentPct}%"></div>
            <div class="bg-blue-400 h-full transition-all" style="width:${mgrPct}%"></div>
          </div>
          <div class="flex justify-between text-[10px] text-gray-400 mt-1">
            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-[#8FBF3F] inline-block"></span>عامل ${agentPct}٪</span>
            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-blue-400 inline-block"></span>مدیریت ${mgrPct}٪</span>
          </div>
          ${canManage(userRole) ? `
          <div class="mt-4 pt-4 border-t border-gray-100 space-y-3">
            <p class="text-xs font-semibold text-gray-600">تغییر درصدها</p>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-xs text-gray-500 block mb-1">سهم عامل ٪</label>
                <input type="number" id="fin-agent-pct" value="${agentPct}" min="0" max="100"
                  class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8FBF3F] outline-none"
                  oninput="document.getElementById('fin-mgr-pct').value=100-this.value">
              </div>
              <div>
                <label class="text-xs text-gray-500 block mb-1">سهم مدیریت ٪</label>
                <input type="number" id="fin-mgr-pct" value="${mgrPct}" min="0" max="100"
                  class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8FBF3F] outline-none"
                  oninput="document.getElementById('fin-agent-pct').value=100-this.value">
              </div>
            </div>
            <button onclick="OrderDetailRedesign.saveRevenueSplit('${esc(order.id)}')"
              class="w-full bg-[#8FBF3F] hover:bg-[#7aac2e] text-white py-2 rounded-lg text-sm font-medium transition-colors">
              <i class="fas fa-save ml-1"></i>ذخیره درصدها
            </button>
          </div>` : ''}
        </div>
      </div>

      <!-- ثبت پرداخت جدید -->
      ${canManage(userRole) ? `
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2">
            <i class="fas fa-plus-circle text-green-600"></i>ثبت پرداخت جدید
          </h4>
        </div>
        <div class="p-4">
          <div class="flex gap-2 flex-wrap">
            <input type="number" id="fin-pay-amount" placeholder="مبلغ پرداختی" min="0"
              class="flex-1 min-w-[140px] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8FBF3F] outline-none">
            <select id="fin-pay-currency"
              class="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#8FBF3F] outline-none">
              <option>تومان</option><option>دلار</option>
            </select>
            <input type="text" id="fin-pay-note" placeholder="یادداشت (اختیاری)"
              class="flex-1 min-w-[140px] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8FBF3F] outline-none">
            <button onclick="OrderDetailRedesign.addPayment('${esc(order.id)}')"
              class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
              <i class="fas fa-check"></i>ثبت
            </button>
          </div>
        </div>
      </div>` : ''}

      <!-- تاریخچه پرداخت‌ها -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2">
            <i class="fas fa-list-alt text-[#8FBF3F]"></i>تاریخچه پرداخت‌ها
          </h4>
        </div>
        <div class="p-4">
          ${payLogs.length === 0
            ? `<p class="text-sm text-gray-400 text-center py-4">پرداختی ثبت نشده است</p>`
            : `<div class="space-y-2">
                ${payLogs.map(l => `
                  <div class="flex items-center gap-3 bg-green-50 border border-green-100 rounded-lg p-3">
                    <i class="fas fa-coins text-green-500 text-sm flex-shrink-0"></i>
                    <div class="flex-1">
                      <p class="text-sm text-gray-800">${esc(l.message||'')}</p>
                      ${l.notes ? `<p class="text-xs text-gray-500">${esc(l.notes)}</p>` : ''}
                    </div>
                    <span class="text-xs text-gray-400 flex-shrink-0">${fmtDate(l.timestamp)}</span>
                  </div>`).join('')}
              </div>`}
        </div>
      </div>

    </div>`;
  }

  // ── تب ۳: تخصیص عامل ────────────────────────────────────────
  function renderAssignmentTab(order, userRole) {
    const allUsers = getUsers();
    const agents = allUsers.filter(u => u.role === 'agent');
    const currentAgentId = order.assignedDoctorId || order.assignedAgentId || null;
    const currentAgent = agents.find(a => a.id === currentAgentId);
    const currency = esc(order.currency || 'تومان');
    const total = parseFloat(order.totalAmount || order.cost || 0);
    const agentPct = parseFloat(order.revenueAgentPercent || 60);

    const agentCard = (agent, isActive) => {
      const share = total * agentPct / 100;
      return `
      <div onclick="${canManage(userRole) ? `OrderDetailRedesign.assignAgent('${esc(order.id)}','${esc(agent.id)}')` : ''}"
        class="flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer
          ${isActive
            ? 'border-[#8FBF3F] bg-[#f3f9e8] shadow-sm'
            : canManage(userRole) ? 'border-gray-200 bg-white hover:border-[#8FBF3F] hover:bg-[#f9fdf0]' : 'border-gray-200 bg-white'}">
        <div class="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0 ${isActive ? 'bg-[#8FBF3F] text-white' : 'bg-gray-200 text-gray-600'}">
          ${esc(agent.name).charAt(0)}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-gray-800 truncate">${esc(agent.name)}</p>
          <p class="text-xs text-gray-400 truncate">${esc(agent.specialization || agent.department || '')}</p>
        </div>
        ${isActive ? `
          <div class="flex-shrink-0 text-center">
            <i class="fas fa-check-circle text-[#8FBF3F] text-lg"></i>
          </div>` : ''}
      </div>`;
    };

    const assignLogs = (order.workLog || []).filter(l => l.type === 'assignment');

    return `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">

      <!-- عامل فعلی -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2">
            <i class="fas fa-user-tie text-[#8FBF3F]"></i>عامل فعلی
          </h4>
        </div>
        <div class="p-4">
          ${currentAgent ? `
          <div class="flex items-center gap-4 bg-[#f3f9e8] border border-[#d4edaa] rounded-xl p-4">
            <div class="w-14 h-14 rounded-full bg-[#8FBF3F] text-white flex items-center justify-center text-2xl font-black shadow-sm">
              ${esc(currentAgent.name).charAt(0)}
            </div>
            <div class="flex-1">
              <p class="text-base font-bold text-gray-800">${esc(currentAgent.name)}</p>
              ${currentAgent.specialization ? `<p class="text-sm text-gray-500">${esc(currentAgent.specialization)}</p>` : ''}
              ${currentAgent.email ? `<p class="text-xs text-gray-400 mt-0.5">${esc(currentAgent.email)}</p>` : ''}
              <div class="mt-2 flex items-center gap-2">
                <span class="text-xs bg-white border border-[#8FBF3F] text-[#5a7a28] px-2 py-0.5 rounded-full font-medium">
                  سهم: ${fmt(total * agentPct / 100)} ${currency}
                </span>
                <span class="text-xs bg-white border border-gray-200 text-gray-500 px-2 py-0.5 rounded-full">
                  ${agentPct}٪
                </span>
              </div>
            </div>
          </div>
          ${order.assignedAt ? `
          <p class="text-xs text-gray-400 mt-2 flex items-center gap-1">
            <i class="fas fa-clock"></i>تاریخ تخصیص: ${fmtDate(order.assignedAt)}
          </p>` : ''}
          ${order.assignmentNotes ? `
          <div class="mt-3 bg-blue-50 border border-blue-100 rounded-lg p-3">
            <p class="text-xs text-blue-600 font-medium mb-1">یادداشت تخصیص:</p>
            <p class="text-sm text-gray-700">${esc(order.assignmentNotes)}</p>
          </div>` : ''}
          ${canManage(userRole) ? `
          <button onclick="OrderDetailRedesign.assignAgent('${esc(order.id)}','')"
            class="mt-3 w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 py-2 rounded-lg text-xs font-medium transition-colors">
            <i class="fas fa-user-minus ml-1"></i>حذف تخصیص
          </button>` : ''}
          ` : `
          <div class="flex flex-col items-center justify-center py-8 text-gray-400">
            <i class="fas fa-user-slash text-4xl mb-3 opacity-30"></i>
            <p class="text-sm">عاملی تخصیص نیافته</p>
          </div>
          ${canManage(userRole) ? `<p class="text-xs text-center text-gray-400">از لیست پایین انتخاب کنید</p>` : ''}`}
        </div>
      </div>

      <!-- یادداشت تخصیص -->
      ${canManage(userRole) ? `
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2">
            <i class="fas fa-sticky-note text-[#8FBF3F]"></i>یادداشت تخصیص
          </h4>
        </div>
        <div class="p-4 space-y-3">
          <textarea id="asgn-notes" rows="4" placeholder="یادداشت یا توضیحات تخصیص..."
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#8FBF3F] outline-none resize-none">${esc(order.assignmentNotes || '')}</textarea>
          <button onclick="OrderDetailRedesign.saveAssignmentNotes('${esc(order.id)}')"
            class="w-full bg-[#8FBF3F] hover:bg-[#7aac2e] text-white py-2 rounded-lg text-sm font-medium transition-colors">
            <i class="fas fa-save ml-1"></i>ذخیره یادداشت
          </button>
        </div>
      </div>` : ''}

      <!-- لیست عامل‌ها برای انتخاب -->
      ${canManage(userRole) ? `
      <div class="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2">
            <i class="fas fa-users text-[#8FBF3F]"></i>انتخاب عامل
          </h4>
          <span class="text-xs text-gray-400">${agents.length} عامل فعال</span>
        </div>
        <div class="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          ${agents.length === 0
            ? `<p class="col-span-full text-center text-gray-400 text-sm py-4">عاملی تعریف نشده</p>`
            : agents.map(a => agentCard(a, a.id === currentAgentId)).join('')}
        </div>
      </div>` : ''}

      <!-- تاریخچه تخصیص -->
      <div class="${canManage(userRole) ? '' : 'lg:col-span-2'} bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2">
            <i class="fas fa-history text-[#8FBF3F]"></i>تاریخچه تخصیص
          </h4>
        </div>
        <div class="p-4 max-h-48 overflow-y-auto">
          ${assignLogs.length === 0
            ? `<p class="text-sm text-gray-400 text-center py-4">تاریخچه‌ای موجود نیست</p>`
            : `<div class="space-y-2">
                ${assignLogs.slice().reverse().map(l => `
                  <div class="flex items-start gap-2 text-sm">
                    <i class="fas fa-user-check text-[#8FBF3F] mt-0.5 text-xs flex-shrink-0"></i>
                    <div class="flex-1">
                      <p class="text-gray-700">${esc(l.message||'')}</p>
                      ${l.notes ? `<p class="text-xs text-gray-400">${esc(l.notes)}</p>` : ''}
                    </div>
                    <span class="text-xs text-gray-400 flex-shrink-0">${fmtDate(l.timestamp)}</span>
                  </div>`).join('')}
              </div>`}
        </div>
      </div>

    </div>`;
  }

  // ── تب ۴: فایل‌ها ───────────────────────────────────────────
  function renderFilesTab(order, userRole) {
    const files = Array.isArray(order.files) ? order.files : [];
    const fileTypeOpts = FILE_TYPES.map(t =>
      `<option value="${esc(t)}">${esc(t)}</option>`).join('');

    const fileIcon = (name) => {
      const ext = (name || '').split('.').pop().toLowerCase();
      if (['jpg','jpeg','png','gif','webp'].includes(ext)) return 'fa-file-image text-pink-500';
      if (['pdf'].includes(ext)) return 'fa-file-pdf text-red-500';
      if (['doc','docx'].includes(ext)) return 'fa-file-word text-blue-500';
      if (['xls','xlsx'].includes(ext)) return 'fa-file-excel text-green-500';
      return 'fa-file text-gray-400';
    };

    const fmtSize = (bytes) => {
      if (!bytes) return '';
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1048576) return (bytes/1024).toFixed(1) + ' KB';
      return (bytes/1048576).toFixed(1) + ' MB';
    };

    return `
    <div class="space-y-5">

      <!-- آپلود فایل جدید -->
      ${true ? `
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
              <select id="file-type-sel"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#8FBF3F] outline-none">
                <option value="">انتخاب نوع فایل...</option>
                ${fileTypeOpts}
              </select>
            </div>
            <div>
              <label class="text-xs text-gray-500 block mb-1">انتخاب فایل</label>
              <input type="file" id="file-input-odr"
                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
                class="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#8FBF3F] outline-none bg-white">
            </div>
          </div>
          <div class="flex items-center gap-3">
            <!-- Drop zone -->
            <div id="file-drop-zone"
              class="flex-1 border-2 border-dashed border-gray-300 rounded-xl p-4 text-center text-sm text-gray-400
                     hover:border-[#8FBF3F] hover:bg-[#f9fdf0] transition-colors cursor-pointer"
              onclick="document.getElementById('file-input-odr').click()"
              ondragover="event.preventDefault();this.classList.add('border-[#8FBF3F]','bg-[#f9fdf0]')"
              ondragleave="this.classList.remove('border-[#8FBF3F]','bg-[#f9fdf0]')"
              ondrop="OrderDetailRedesign.handleFileDrop(event,'${esc(order.id)}')">
              <i class="fas fa-cloud-upload-alt text-2xl mb-1 block opacity-50"></i>
              فایل را اینجا رها کنید یا کلیک کنید
            </div>
            <button onclick="OrderDetailRedesign.uploadFile('${esc(order.id)}')"
              class="bg-[#8FBF3F] hover:bg-[#7aac2e] text-white px-5 py-3 rounded-xl text-sm font-medium transition-colors flex-shrink-0">
              <i class="fas fa-upload ml-1"></i>آپلود
            </button>
          </div>
          <p class="text-xs text-gray-400">
            <i class="fas fa-info-circle ml-1"></i>
            فرمت‌های مجاز: PDF, DOC, DOCX, JPG, PNG — حداکثر ۱۰ مگابایت
          </p>
        </div>
      </div>` : ''}

      <!-- لیست فایل‌ها -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2">
            <i class="fas fa-folder-open text-[#8FBF3F]"></i>فایل‌های پروژه
          </h4>
          <span class="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">${files.length} فایل</span>
        </div>
        <div class="p-4" id="odr-files-list">
          ${files.length === 0
            ? `<div class="flex flex-col items-center justify-center py-12 text-gray-400">
                 <i class="fas fa-folder-open text-5xl opacity-20 mb-3"></i>
                 <p class="text-sm">هنوز فایلی آپلود نشده</p>
               </div>`
            : `<div class="space-y-2">
                ${files.map(f => `
                  <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100 transition-colors group">
                    <i class="fas ${fileIcon(f.name)} text-2xl flex-shrink-0"></i>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-800 truncate">${esc(f.name || '')}</p>
                      <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                        ${f.fileType ? `<span class="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">${esc(f.fileType)}</span>` : ''}
                        ${f.size ? `<span class="text-[10px] text-gray-400">${fmtSize(f.size)}</span>` : ''}
                        <span class="text-[10px] text-gray-400">${esc(f.uploadedByName || '')}</span>
                        <span class="text-[10px] text-gray-400">${f.uploadedAt ? fmtDate(f.uploadedAt) : ''}</span>
                      </div>
                    </div>
                    <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      ${f.url ? `
                      <a href="${esc(f.url)}" download="${esc(f.name)}"
                        class="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" title="دانلود">
                        <i class="fas fa-download text-xs"></i>
                      </a>` : ''}
                      <button onclick="OrderDetailRedesign.deleteFile('${esc(order.id)}','${esc(f.id)}')"
                        class="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors" title="حذف">
                        <i class="fas fa-trash text-xs"></i>
                      </button>
                    </div>
                  </div>`).join('')}
              </div>`}
        </div>
      </div>

    </div>`;
  }

  // ── تب ۵: تاریخچه ───────────────────────────────────────────
  function renderHistoryTab(order, userRole) {
    const workLog = Array.isArray(order.workLog) ? order.workLog : [];
    const rejHistory = Array.isArray(order.rejectionHistory) ? order.rejectionHistory : [];
    const allLogs = [
      ...workLog,
      ...rejHistory.map(r => ({
        id: r.date, type: 'rejection',
        message: `رد شده: ${r.reason || ''}`,
        timestamp: r.date, by: r.rejectedByName || r.rejectedBy || '',
      })),
    ].sort((a,b) => new Date(b.timestamp||0) - new Date(a.timestamp||0));

    const logTypeConfig = {
      assignment:    { icon:'fa-user-check',   color:'text-blue-500',  bg:'bg-blue-50'  },
      payment:       { icon:'fa-coins',         color:'text-green-600', bg:'bg-green-50' },
      status_change: { icon:'fa-exchange-alt',  color:'text-lime-500',bg:'bg-lime-50'},
      note:          { icon:'fa-sticky-note',   color:'text-amber-500', bg:'bg-amber-50' },
      rejection:     { icon:'fa-ban',           color:'text-red-500',   bg:'bg-red-50'   },
      file_upload:   { icon:'fa-paperclip',     color:'text-teal-500',  bg:'bg-teal-50'  },
      default:       { icon:'fa-circle',        color:'text-gray-400',  bg:'bg-gray-50'  },
    };

    return `
    <div class="space-y-5">

      <!-- آمار فعالیت‌ها -->
      <div class="grid grid-cols-3 sm:grid-cols-5 gap-3">
        ${Object.entries({
          'assignment':'تخصیص','payment':'پرداخت',
          'status_change':'تغییر وضعیت','note':'یادداشت','rejection':'رد',
        }).map(([type, label]) => {
          const cnt = allLogs.filter(l => l.type === type).length;
          const cfg = logTypeConfig[type] || logTypeConfig.default;
          return `<div class="${cfg.bg} rounded-xl p-3 text-center border border-gray-100">
            <i class="fas ${cfg.icon} ${cfg.color} text-lg mb-1 block"></i>
            <p class="text-lg font-black text-gray-800">${cnt}</p>
            <p class="text-[10px] text-gray-500">${label}</p>
          </div>`;
        }).join('')}
      </div>

      <!-- Timeline -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h4 class="text-sm font-bold text-gray-700 flex items-center gap-2">
            <i class="fas fa-stream text-[#8FBF3F]"></i>جدول زمانی فعالیت‌ها
          </h4>
          <span class="text-xs text-gray-400">${allLogs.length} رویداد</span>
        </div>
        <div class="p-4 max-h-96 overflow-y-auto" id="odr-timeline">
          ${allLogs.length === 0
            ? `<div class="flex flex-col items-center py-12 text-gray-400">
                 <i class="fas fa-history text-5xl opacity-20 mb-3"></i>
                 <p class="text-sm">تاریخچه‌ای ثبت نشده</p>
               </div>`
            : `<div class="relative pr-4">
                <div class="absolute right-1.5 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                ${allLogs.map(l => {
                  const cfg = logTypeConfig[l.type] || logTypeConfig.default;
                  return `
                  <div class="relative flex gap-4 mb-4 last:mb-0">
                    <div class="absolute -right-2 top-1 w-4 h-4 rounded-full ${cfg.bg} border-2 border-white shadow flex items-center justify-center flex-shrink-0">
                      <i class="fas ${cfg.icon} ${cfg.color} text-[8px]"></i>
                    </div>
                    <div class="${cfg.bg} rounded-xl p-3 flex-1 mr-4 border border-gray-100">
                      <div class="flex items-start justify-between gap-2">
                        <p class="text-sm text-gray-800 font-medium leading-snug">${esc(l.message || '')}</p>
                        <span class="text-[10px] text-gray-400 flex-shrink-0 mt-0.5">${fmtDate(l.timestamp)}</span>
                      </div>
                      ${l.notes ? `<p class="text-xs text-gray-500 mt-1">${esc(l.notes)}</p>` : ''}
                      ${l.by ? `<p class="text-[10px] text-gray-400 mt-1 flex items-center gap-1"><i class="fas fa-user text-[8px]"></i>${esc(l.by)}</p>` : ''}
                    </div>
                  </div>`;
                }).join('')}
              </div>`}
        </div>
      </div>

      <!-- افزودن یادداشت -->
      ${canManage(userRole) ? `
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
            class="bg-[#8FBF3F] hover:bg-[#7aac2e] text-white px-4 rounded-xl text-sm font-medium transition-colors self-end py-2 flex-shrink-0">
            <i class="fas fa-plus"></i>
          </button>
        </div>
      </div>` : ''}

    </div>`;
  }

  // ── مودال اصلی ──────────────────────────────────────────────
  function renderModal(order, userRole, activeTab) {
    const tabContent = getTabContent(order, userRole, activeTab);
    return `
    <div id="odr-modal-overlay"
      class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3"
      onclick="if(event.target===this)OrderDetailRedesign.close()">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden">
        <!-- Header -->
        ${renderHeader(order, userRole)}
        <!-- Tab Bar -->
        ${renderTabBar(activeTab)}
        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-5 bg-gray-50" id="odr-tab-content">
          ${tabContent}
        </div>
        <!-- Footer -->
        <div class="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-white flex-shrink-0">
          <div class="flex items-center gap-2 text-xs text-gray-400">
            <i class="fas fa-clock"></i>
            آخرین بروزرسانی: ${fmtDate(order.updatedAt || order.createdAt)}
          </div>
          <button onclick="OrderDetailRedesign.close()"
            class="bg-gray-200 hover:bg-gray-300 text-gray-700 px-5 py-2 rounded-xl text-sm font-medium transition-colors">
            <i class="fas fa-times ml-1"></i>بستن
          </button>
        </div>
      </div>
    </div>`;
  }

  function getTabContent(order, userRole, tab) {
    switch (tab) {
      case 'overview':   return renderOverviewTab(order, userRole);
      case 'financial':  return renderFinancialTab(order, userRole);
      case 'assignment': return renderAssignmentTab(order, userRole);
      case 'files':      return renderFilesTab(order, userRole);
      case 'history':    return renderHistoryTab(order, userRole);
      default:           return renderOverviewTab(order, userRole);
    }
  }

  // ── Public API ──────────────────────────────────────────────
  function show(orderId) {
    const orders = getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) { notify('سفارش یافت نشد', 'error'); return; }
    _orderId = orderId;
    _activeTab = 'overview';
    const user = currentUser();
    // حذف overlay قدیمی اگر وجود داشت
    const old = document.getElementById('odr-modal-overlay');
    if (old) old.remove();
    // یافتن یا ساختن container
    let container = document.getElementById('odr-modal-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'odr-modal-container';
      document.body.appendChild(container);
    }
    container.innerHTML = renderModal(order, user.role || 'manager', _activeTab);
    // ESC برای بستن
    document._odrEscHandler = (e) => { if (e.key === 'Escape') close(); };
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
    // بروزرسانی tab buttons
    TABS.forEach(t => {
      const btn = document.getElementById(`odr-tab-btn-${t.id}`);
      if (!btn) return;
      if (t.id === tabId) {
        btn.className = btn.className
          .replace('border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300','')
          .replace('border-transparent','')
          + ' border-[#8FBF3F] text-[#5a7a28]';
        btn.classList.remove('border-transparent','text-gray-500','hover:text-gray-700','hover:border-gray-300');
        btn.classList.add('border-[#8FBF3F]','text-[#5a7a28]');
      } else {
        btn.classList.remove('border-[#8FBF3F]','text-[#5a7a28]');
        btn.classList.add('border-transparent','text-gray-500','hover:text-gray-700','hover:border-gray-300');
      }
    });
    // بروزرسانی محتوا
    const contentEl = document.getElementById('odr-tab-content');
    if (!contentEl) return;
    const orders = getOrders();
    const order = orders.find(o => o.id === _orderId);
    if (!order) return;
    const user = currentUser();
    contentEl.innerHTML = getTabContent(order, user.role || 'manager', tabId);
  }

  function _reload() {
    if (_orderId) show(_orderId);
  }

  // ── متدهای عملیاتی ──────────────────────────────────────────
  function quickAction(orderId, newStatus) {
    const labels = { in_progress:'شروع کار', completed:'تکمیل', cancelled:'لغو' };
    if (!confirm(`آیا از "${labels[newStatus] || newStatus}" اطمینان دارید؟`)) return;
    const orders = getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) return;
    const user = currentUser();
    orders[idx] = {
      ...orders[idx],
      status: newStatus,
      updatedAt: new Date().toISOString(),
      ...(newStatus === 'completed' ? { progress: 100, completedAt: new Date().toISOString() } : {}),
      workLog: [...(orders[idx].workLog || []), {
        id: Date.now().toString(36), type: 'status_change',
        message: `وضعیت به "${STATUS[newStatus]?.label || newStatus}" تغییر یافت`,
        timestamp: new Date().toISOString(), by: user.name || '',
      }],
    };
    saveOrders(orders);
    notify(`وضعیت سفارش تغییر کرد ✓`, 'success');
    _reload();
  }

  function updateProgress(orderId, value) {
    const pct = Math.min(100, Math.max(0, parseInt(value) || 0));
    const orders = getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) return;
    orders[idx].progress = pct;
    orders[idx].updatedAt = new Date().toISOString();
    saveOrders(orders);
    // فقط نوار را آپدیت کن بدون reload کامل
    const bar = document.querySelector('#odr-tab-content .bg-gray-100 > div');
    if (bar) bar.style.width = pct + '%';
  }

  function addPayment(orderId) {
    const amount = parseFloat(document.getElementById('fin-pay-amount')?.value);
    const currency = document.getElementById('fin-pay-currency')?.value || 'تومان';
    const note = document.getElementById('fin-pay-note')?.value?.trim() || '';
    if (!amount || amount <= 0) { notify('مبلغ معتبر وارد کنید', 'error'); return; }
    const orders = getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) return;
    const newPaid = (parseFloat(orders[idx].paidAmount) || 0) + amount;
    const total = parseFloat(orders[idx].totalAmount || orders[idx].cost) || 0;
    const payStatus = newPaid >= total ? 'paid' : 'partial';
    const user = currentUser();
    orders[idx] = {
      ...orders[idx],
      paidAmount: newPaid, paymentStatus: payStatus,
      updatedAt: new Date().toISOString(),
      workLog: [...(orders[idx].workLog || []), {
        id: Date.now().toString(36), type: 'payment',
        message: `پرداخت ${(amount).toLocaleString('fa-IR')} ${currency} ثبت شد`,
        notes: note, timestamp: new Date().toISOString(), by: user.name || '',
      }],
    };
    saveOrders(orders);
    notify(`پرداخت ${(amount).toLocaleString('fa-IR')} ثبت شد ✓`, 'success');
    _reload();
  }

  function saveRevenueSplit(orderId) {
    const ap = parseFloat(document.getElementById('fin-agent-pct')?.value) || 60;
    const mp = parseFloat(document.getElementById('fin-mgr-pct')?.value)   || 40;
    if (Math.abs(ap + mp - 100) > 0.01) { notify('جمع درصدها باید ۱۰۰ باشد', 'error'); return; }
    const orders = getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) return;
    orders[idx] = { ...orders[idx], revenueAgentPercent: ap, revenueManagerPercent: mp, updatedAt: new Date().toISOString() };
    saveOrders(orders);
    notify('درصد تقسیم ذخیره شد ✓', 'success');
    _reload();
  }

  function assignAgent(orderId, agentId) {
    const orders = getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) return;
    const agentObj = agentId ? getUsers().find(u => u.id === agentId) : null;
    const user = currentUser();
    orders[idx] = {
      ...orders[idx],
      assignedDoctorId: agentId || null, assignedAgentId: agentId || null,
      assignedDoctor: agentObj ? agentObj.name : null,
      assignedAt: agentId ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
      workLog: [...(orders[idx].workLog || []), {
        id: Date.now().toString(36), type: 'assignment',
        message: agentObj ? `سفارش به ${agentObj.name} تخصیص داده شد` : 'تخصیص عامل لغو شد',
        timestamp: new Date().toISOString(), by: user.name || '',
      }],
    };
    saveOrders(orders);
    notify(agentObj ? `تخصیص به ${agentObj.name} ✓` : 'تخصیص لغو شد', 'success');
    _reload();
  }

  function saveAssignmentNotes(orderId) {
    const notes = document.getElementById('asgn-notes')?.value?.trim() || '';
    const orders = getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) return;
    orders[idx] = { ...orders[idx], assignmentNotes: notes, updatedAt: new Date().toISOString() };
    saveOrders(orders);
    notify('یادداشت ذخیره شد ✓', 'success');
  }

  function addNote(orderId) {
    const text = document.getElementById('hist-note')?.value?.trim();
    if (!text) { notify('یادداشت خالی است', 'error'); return; }
    const orders = getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) return;
    const user = currentUser();
    orders[idx].workLog = [...(orders[idx].workLog || []), {
      id: Date.now().toString(36), type: 'note',
      message: text, timestamp: new Date().toISOString(), by: user.name || '',
    }];
    orders[idx].updatedAt = new Date().toISOString();
    saveOrders(orders);
    notify('یادداشت ثبت شد ✓', 'success');
    switchTab('history');
  }

  function uploadFile(orderId) {
    const fileInput = document.getElementById('file-input-odr');
    const fileType  = document.getElementById('file-type-sel')?.value;
    const file = fileInput?.files?.[0];
    if (!fileType) { notify('نوع فایل را انتخاب کنید', 'error'); return; }
    if (!file)     { notify('فایلی انتخاب نشده', 'error'); return; }
    if (file.size > 10 * 1024 * 1024) { notify('حجم فایل بیشتر از ۱۰ مگابایت است', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const orders = getOrders();
      const idx = orders.findIndex(o => o.id === orderId);
      if (idx === -1) return;
      const user = currentUser();
      const newFile = {
        id: 'f_' + Date.now(), name: file.name, fileType,
        size: file.size, url: ev.target.result,
        uploadedBy: user.id, uploadedByName: user.name,
        uploadedAt: new Date().toISOString(),
      };
      if (!orders[idx].files) orders[idx].files = [];
      orders[idx].files.push(newFile);
      orders[idx].workLog = [...(orders[idx].workLog || []), {
        id: Date.now().toString(36), type: 'file_upload',
        message: `فایل "${file.name}" (${fileType}) آپلود شد`,
        timestamp: new Date().toISOString(), by: user.name || '',
      }];
      orders[idx].updatedAt = new Date().toISOString();
      saveOrders(orders);
      notify(`فایل "${file.name}" آپلود شد ✓`, 'success');
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
    if (fi) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fi.files = dt.files;
    }
    notify(`فایل "${file.name}" انتخاب شد — نوع فایل را انتخاب و آپلود کنید`, 'info');
  }

  function deleteFile(orderId, fileId) {
    if (!confirm('آیا از حذف این فایل اطمینان دارید؟')) return;
    const orders = getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) return;
    orders[idx].files = (orders[idx].files || []).filter(f => f.id !== fileId);
    orders[idx].updatedAt = new Date().toISOString();
    saveOrders(orders);
    notify('فایل حذف شد', 'warning');
    switchTab('files');
  }

  function openEdit(orderId) {
    close();
    if (typeof OrdersRedesign !== 'undefined') {
      setTimeout(() => OrdersRedesign.openEdit(orderId), 150);
    }
  }

  function printOrder(orderId) {
    const orders = getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const currency = order.currency || 'تومان';
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html dir="rtl" lang="fa">
    <head><meta charset="UTF-8"><title>سفارش ${String(orderId).slice(-8)}</title>
    <style>
      body{font-family:Vazirmatn,Tahoma,sans-serif;padding:30px;color:#333;direction:rtl}
      h1{font-size:20px;border-bottom:2px solid #8FBF3F;padding-bottom:8px;color:#5a7a28}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      td{padding:8px 12px;border:1px solid #e5e7eb;font-size:13px}
      td:first-child{background:#f9fdf0;font-weight:600;width:30%}
      .badge{display:inline-block;padding:2px 10px;border-radius:999px;font-size:11px;background:#f3f9e8;color:#5a7a28;border:1px solid #d4edaa}
      @media print{body{padding:10px}}
    </style></head><body>
    <h1>جزئیات سفارش</h1>
    <table>
      <tr><td>شماره سفارش</td><td><code>${String(orderId).slice(-8).toUpperCase()}</code></td></tr>
      <tr><td>نام دانشجو</td><td>${order.studentName||'---'}</td></tr>
      <tr><td>دانشگاه</td><td>${order.university||'---'}</td></tr>
      <tr><td>رشته</td><td>${order.field||'---'}</td></tr>
      <tr><td>نوع کار</td><td>${order.type||'---'}</td></tr>
      <tr><td>وضعیت</td><td><span class="badge">${STATUS[order.status]?.label||order.status||'---'}</span></td></tr>
      <tr><td>پیشرفت</td><td>${order.progress||0}%</td></tr>
      <tr><td>مبلغ</td><td>${(parseFloat(order.totalAmount||order.cost||0)).toLocaleString('fa-IR')} ${currency}</td></tr>
      <tr><td>پرداخت شده</td><td>${(parseFloat(order.paidAmount||0)).toLocaleString('fa-IR')} ${currency}</td></tr>
      <tr><td>عامل</td><td>${order.assignedDoctor||'---'}</td></tr>
      <tr><td>مهلت تحویل</td><td>${order.deadline||'---'}</td></tr>
      <tr><td>تاریخ ثبت</td><td>${fmtDate(order.createdAt)}</td></tr>
      ${order.description?`<tr><td>توضیحات</td><td>${order.description}</td></tr>`:''}
    </table>
    <p style="margin-top:30px;font-size:11px;color:#999;text-align:center">
      تاریخ چاپ: ${new Date().toLocaleDateString('fa-IR')}
    </p>
    <script>window.onload=()=>window.print()<\/script>
    </body></html>`);
    win.document.close();
  }

  // ── بستن IIFE و Export ──────────────────────────────────────
  return {
    show, close, switchTab,
    quickAction, updateProgress,
    addPayment, saveRevenueSplit,
    assignAgent, saveAssignmentNotes,
    addNote, uploadFile, handleFileDrop, deleteFile,
    openEdit, printOrder,
  };

})();

// ── Patch روی OrderPagesModule ───────────────────────────────
(function patchOrderPages() {
  const patch = () => {
    if (typeof window.OrderPagesModule !== 'undefined') {
      window.OrderPagesModule.showOrderPage = (id) => OrderDetailRedesign.show(id);
      console.log('✅ OrderDetailRedesign: OrderPagesModule patched');
    }
    // patch روی OrdersRedesign.openDetail
    if (typeof window.OrdersRedesign !== 'undefined') {
      window.OrdersRedesign._origOpenDetail = window.OrdersRedesign.openDetail;
      window.OrdersRedesign.openDetail = (id) => OrderDetailRedesign.show(id);
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(patch, 150));
  } else {
    setTimeout(patch, 150);
  }
})();

window.OrderDetailRedesign = OrderDetailRedesign;
console.log('✅ order-detail-redesign.js بارگذاری شد');
