// ============================================================
// js/agent-orders.js
// ماژول صفحه سفارشات عامل
// نمایش، فیلتر، تایید و تایمر سفارشات تخصیص‌یافته به عامل
// ============================================================

// ── helper داخلی ─────────────────────────────────────────────
function _agentFmtCurrency(n) {
    if (typeof UTILS !== 'undefined' && UTILS.formatCurrency) return UTILS.formatCurrency(n);
    return Number(n || 0).toLocaleString('fa-IR') + ' ت';
}

function _agentGetCurrentUser() {
    try {
        if (window.Alpine && document.querySelector('[x-data]')) {
            return document.querySelector('[x-data]').__x.$data.currentUser;
        }
    } catch (e) {}
    return JSON.parse(localStorage.getItem('currentUser') || 'null');
}

function _agentGetMyOrders(userId) {
    const orders = DataModule.getOrders();
    return orders.filter(o =>
        o.assignedDoctorId === userId ||
        o.assignedAgentId  === userId ||
        o.assigned_doctor  === userId ||
        o.assignedDoctor   === userId ||
        o.doctorId         === userId ||
        o.doctor_id        === userId
    ).sort((a, b) => {
        if (!a.deadlineDateTime) return 1;
        if (!b.deadlineDateTime) return -1;
        return new Date(a.deadlineDateTime) - new Date(b.deadlineDateTime);
    });
}

function _agentRerender() {
    const el = document.querySelector('[x-show*="agentTasks"]');
    if (el) {
        el.innerHTML = window.getMyAgentTasksContent();
        if (typeof window.startAgentTimers === 'function') window.startAgentTimers();
    }
}

// ── صفحه اصلی سفارشات عامل ──────────────────────────────────
window.getMyAgentTasksContent = function () {
    try {
        const currentUser = _agentGetCurrentUser();
        if (!currentUser || !currentUser.id)
            return '<div class="text-red-400 p-4">لطفاً وارد سیستم شوید</div>';

        const tasksData   = JSON.parse(localStorage.getItem('employee_tasks') || '{}');
        const myTasks     = Array.isArray(tasksData[currentUser.id]) ? tasksData[currentUser.id] : [];
        const myOrders    = _agentGetMyOrders(currentUser.id);

        const totalOrders      = myOrders.length;
        const pendingOrders    = myOrders.filter(o => o.status === 'pending').length;
        const inProgressOrders = myOrders.filter(o => o.status === 'in_progress').length;
        const completedOrders  = myOrders.filter(o => o.status === 'completed').length;
        const totalIncome      = myOrders.reduce((s, o) => s + (o.doctorShare || o.doctor_share || 0), 0);
        const orderTasksCount  = myTasks.filter(t => t.isOrderTask).length;
        const otherTasksCount  = myTasks.filter(t => !t.isOrderTask).length;

        const filterBtns = ['all','pending','in_progress','completed'].map((s, i) => {
            const labels = {all:'همه', pending:'در انتظار', in_progress:'در حال انجام', completed:'تکمیل شده'};
            const colors = {
                all:         'bg-slate-600 text-white',
                pending:     'bg-amber-500/20 text-amber-300 border border-amber-500/30',
                in_progress: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
                completed:   'bg-green-500/20 text-green-300 border border-green-500/30',
            };
            return `<button onclick="window.filterAgentOrders('${s}')" id="agent-filter-${s}"
                class="px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${colors[s]}${i===0?' ring-2 ring-white/20':''}">
                ${labels[s]}
            </button>`;
        }).join('');

        const ordersGrid = myOrders.length === 0
            ? `<div class="bg-slate-800/60 rounded-2xl border border-slate-700/50 py-16 text-center">
                <i class="fas fa-inbox text-5xl text-gray-600 mb-4 block"></i>
                <p class="text-gray-400 text-lg">هیچ سفارشی به شما تخصیص داده نشده است</p>
                <p class="text-gray-500 text-sm mt-1">پس از تخصیص سفارش توسط مدیر، اینجا نمایش داده می‌شود</p>
               </div>`
            : `<div class="grid grid-cols-1 lg:grid-cols-2 gap-4" id="agent-orders-grid">
                ${myOrders.map((o, i) => window.getAgentOrderCard(o, i)).join('')}
               </div>`;

        return `
        <div class="space-y-6 p-1">
          <!-- هدر -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 class="text-2xl font-bold text-white flex items-center gap-3">
                <span class="w-10 h-10 rounded-xl bg-lime-500/20 flex items-center justify-center">
                  <i class="fas fa-clipboard-list text-lime-400 text-lg"></i>
                </span>سفارشات من
              </h2>
              <p class="text-gray-400 text-sm mt-1 mr-13">خوش آمدید، <span class="text-lime-400 font-medium">${currentUser.name || ''}</span></p>
            </div>
            <button onclick="location.reload()"
              class="self-start sm:self-auto bg-slate-700 hover:bg-slate-600 text-gray-300 hover:text-white px-4 py-2 rounded-xl text-sm transition-all flex items-center gap-2">
              <i class="fas fa-sync-alt text-xs"></i> به‌روزرسانی
            </button>
          </div>
          <!-- آمار -->
          <div class="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div class="bg-slate-800/80 border border-slate-700/50 rounded-2xl p-4">
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs text-gray-400">کل سفارشات</span>
                <span class="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center"><i class="fas fa-layer-group text-gray-300 text-xs"></i></span>
              </div>
              <p class="text-3xl font-bold text-white">${totalOrders}</p>
            </div>
            <div class="bg-slate-800/80 border border-amber-500/20 rounded-2xl p-4">
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs text-gray-400">در انتظار</span>
                <span class="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center"><i class="fas fa-hourglass-half text-amber-400 text-xs"></i></span>
              </div>
              <p class="text-3xl font-bold text-amber-400">${pendingOrders}</p>
            </div>
            <div class="bg-slate-800/80 border border-blue-500/20 rounded-2xl p-4">
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs text-gray-400">در حال انجام</span>
                <span class="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center"><i class="fas fa-spinner text-blue-400 text-xs"></i></span>
              </div>
              <p class="text-3xl font-bold text-blue-400">${inProgressOrders}</p>
            </div>
            <div class="bg-slate-800/80 border border-green-500/20 rounded-2xl p-4">
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs text-gray-400">تکمیل شده</span>
                <span class="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center"><i class="fas fa-check-circle text-green-400 text-xs"></i></span>
              </div>
              <p class="text-3xl font-bold text-green-400">${completedOrders}</p>
            </div>
            <div class="col-span-2 lg:col-span-1 bg-gradient-to-br from-lime-600/30 to-lime-700/20 border border-lime-500/30 rounded-2xl p-4">
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs text-gray-400">درآمد کل</span>
                <span class="w-8 h-8 rounded-lg bg-lime-500/20 flex items-center justify-center"><i class="fas fa-coins text-lime-400 text-xs"></i></span>
              </div>
              <p class="text-xl font-bold text-lime-300">${_agentFmtCurrency(totalIncome)}</p>
            </div>
          </div>
          <!-- فیلتر -->
          <div class="flex gap-2 flex-wrap" id="agent-order-filter">${filterBtns}</div>
          <!-- لیست سفارشات -->
          <div id="agent-orders-list">${ordersGrid}</div>
          <!-- وظایف اختصاصی -->
          ${orderTasksCount > 0 ? `
          <div class="bg-slate-800/60 rounded-2xl border border-slate-700/50 p-5">
            <h3 class="text-base font-bold text-white mb-4 flex items-center gap-2">
              <i class="fas fa-tasks text-blue-400"></i>وظایف اختصاصی
              <span class="bg-blue-500/20 text-blue-300 text-xs px-2 py-0.5 rounded-full mr-1">${orderTasksCount}</span>
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              ${myTasks.filter(t => t.isOrderTask).map(t => window.getAgentTaskCard(t, currentUser.id)).join('')}
            </div>
          </div>` : ''}
          <!-- سایر وظایف -->
          ${otherTasksCount > 0 ? `
          <div class="bg-slate-800/60 rounded-2xl border border-slate-700/50 p-5">
            <h3 class="text-base font-bold text-white mb-4 flex items-center gap-2">
              <i class="fas fa-list-check text-lime-400"></i>سایر وظایف
              <span class="bg-lime-500/20 text-lime-300 text-xs px-2 py-0.5 rounded-full mr-1">${otherTasksCount}</span>
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              ${myTasks.filter(t => !t.isOrderTask).map(t => window.getAgentTaskCard(t, currentUser.id)).join('')}
            </div>
          </div>` : ''}
        </div>`;
    } catch (err) {
        console.error('agent-orders: getMyAgentTasksContent خطا:', err);
        return `<div class="text-red-500 p-4">خطا در بارگذاری: ${err.message}</div>`;
    }
};

// ── فیلتر سفارشات بر اساس وضعیت ─────────────────────────────
window.filterAgentOrders = function (status) {
    ['all','pending','in_progress','completed'].forEach(s => {
        const btn = document.getElementById('agent-filter-' + s);
        if (!btn) return;
        btn.classList.toggle('ring-2', s === status);
        btn.classList.toggle('ring-white/20', s === status);
    });
    const grid = document.getElementById('agent-orders-grid');
    if (!grid) return;
    grid.querySelectorAll('[data-order-status]').forEach(card => {
        card.style.display = (status === 'all' || card.getAttribute('data-order-status') === status) ? '' : 'none';
    });
};

// ── کارت سفارش ───────────────────────────────────────────────
window.getAgentOrderCard = function (order, index) {
    const now      = new Date();
    const deadline = order.deadlineDateTime ? new Date(order.deadlineDateTime) : null;
    const isExpired= deadline && deadline < now && order.status !== 'completed';

    const statusCfg = {
        completed:   { label:'تکمیل شده',   cls:'bg-green-500/20 text-green-300 border border-green-500/30', dot:'bg-green-400', icon:'fa-check-circle'   },
        in_progress: { label:'در حال انجام', cls:'bg-blue-500/20  text-blue-300  border border-blue-500/30',  dot:'bg-blue-400',  icon:'fa-spinner'        },
        pending:     { label:'در انتظار',    cls:'bg-amber-500/20 text-amber-300 border border-amber-500/30', dot:'bg-amber-400', icon:'fa-hourglass-half'  },
    };
    const st       = statusCfg[order.status] || statusCfg.pending;
    const topBar   = order.status === 'completed' ? 'bg-green-500' : order.status === 'in_progress' ? 'bg-blue-500' : isExpired ? 'bg-red-500' : 'bg-amber-400';
    const progress = Math.min(100, parseInt(order.progress) || 0);
    const pColor   = progress === 100 ? 'bg-green-500' : progress > 50 ? 'bg-blue-500' : 'bg-amber-400';
    const share    = order.doctorShare || order.doctor_share || 0;

    let deadlineHtml = '<span class="text-gray-500 text-xs">مهلت نامشخص</span>';
    if (deadline) {
        const diffMs   = deadline - now;
        const diffDays = Math.floor(diffMs / 86400000);
        const diffHrs  = Math.floor((diffMs % 86400000) / 3600000);
        deadlineHtml = isExpired
            ? `<div class="flex items-center gap-1.5 text-red-400 text-xs font-medium"><i class="fas fa-exclamation-triangle"></i><span>مهلت گذشته!</span></div>`
            : `<div class="flex items-center gap-3">
                <div class="text-center"><div class="text-lg font-bold text-white leading-none" id="timer-days-${order.id}">${diffDays}</div><div class="text-[10px] text-gray-400 mt-0.5">روز</div></div>
                <div class="text-gray-600">:</div>
                <div class="text-center"><div class="text-lg font-bold text-lime-400 leading-none" id="timer-hours-${order.id}">${diffHrs}</div><div class="text-[10px] text-gray-400 mt-0.5">ساعت</div></div>
               </div>`;
    }

    return `
    <div data-order-status="${order.status}"
         class="group bg-slate-800/80 border border-slate-700/50 rounded-2xl overflow-hidden
                hover:border-slate-500/70 hover:shadow-2xl hover:shadow-black/30 transition-all duration-300 flex flex-col">
      <div class="h-1 w-full ${topBar}"></div>
      <div class="p-5 flex-1 space-y-4">
        <div class="flex items-start justify-between gap-3">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-[11px] text-gray-500 font-mono">#${String(index+1).padStart(3,'0')}</span>
              <span class="w-1.5 h-1.5 rounded-full ${st.dot} flex-shrink-0"></span>
            </div>
            <h4 class="text-white font-bold text-base leading-snug line-clamp-2">${order.title || order.type || 'سفارش'}</h4>
          </div>
          <span class="flex-shrink-0 px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${st.cls}">
            <i class="fas ${st.icon} text-[10px]"></i>${st.label}
          </span>
        </div>
        <div class="bg-slate-700/40 rounded-xl p-3 space-y-1.5">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-slate-600 flex items-center justify-center flex-shrink-0">
              <i class="fas fa-user-graduate text-lime-400 text-xs"></i>
            </div>
            <div class="min-w-0">
              <p class="text-white text-sm font-medium truncate">${order.studentName || '---'}</p>
              ${order.university ? `<p class="text-gray-400 text-xs truncate">${order.university}</p>` : ''}
            </div>
          </div>
          ${order.type ? `
          <div class="flex items-center gap-2 pt-1 border-t border-slate-600/50">
            <i class="fas fa-tag text-gray-500 text-xs w-7 text-center"></i>
            <span class="text-gray-300 text-xs">${order.type}</span>
            ${order.degree ? `<span class="bg-slate-600 text-gray-300 text-[10px] px-1.5 py-0.5 rounded-md mr-auto">${order.degree}</span>` : ''}
          </div>` : ''}
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-slate-700/30 rounded-xl p-3">
            <div class="flex items-center justify-between mb-2">
              <span class="text-[11px] text-gray-400">پیشرفت</span>
              <span class="text-xs font-bold text-white">${progress}%</span>
            </div>
            <div class="w-full bg-slate-600/50 rounded-full h-1.5">
              <div class="${pColor} h-1.5 rounded-full transition-all duration-500" style="width:${progress}%"></div>
            </div>
          </div>
          <div class="bg-slate-700/30 rounded-xl p-3 flex flex-col justify-center">
            <span class="text-[11px] text-gray-400 mb-1.5">${isExpired ? 'زمان تحویل' : deadline ? 'مانده تا مهلت' : 'مهلت'}</span>
            ${deadlineHtml}
          </div>
        </div>
        ${share > 0 ? `
        <div class="flex items-center justify-between bg-lime-500/10 border border-lime-500/20 rounded-xl px-3 py-2">
          <span class="text-xs text-gray-400 flex items-center gap-1.5"><i class="fas fa-coins text-lime-400 text-[11px]"></i>سهم درآمد</span>
          <span class="text-sm font-bold text-lime-300">${Number(share).toLocaleString('fa-IR')} ت</span>
        </div>` : ''}
      </div>
      <div class="px-5 pb-5 pt-2 flex gap-2">
        <button onclick="viewOrderDetails('${order.id}')"
                class="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-xl text-sm font-medium
                       transition-all flex items-center justify-center gap-2 border border-slate-600/50 hover:border-slate-500">
          <i class="fas fa-eye text-xs"></i> جزئیات
        </button>
        ${order.status !== 'in_progress' && order.status !== 'completed' ? `
        <button onclick="window.agentConfirmOrder('${order.id}')"
                class="flex-1 bg-green-600 hover:bg-green-500 text-white py-2.5 rounded-xl text-sm font-medium
                       transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-900/30">
          <i class="fas fa-play text-xs"></i> شروع کار
        </button>` : ''}
        ${order.status === 'in_progress' ? `
        <button onclick="viewOrderDetails('${order.id}')"
                class="flex-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 py-2.5 rounded-xl text-sm font-medium
                       transition-all flex items-center justify-center gap-2 border border-blue-500/30">
          <i class="fas fa-edit text-xs"></i> ادامه کار
        </button>` : ''}
      </div>
    </div>`;
};

// ── تایید سفارش و شروع کار ───────────────────────────────────
window.agentConfirmOrder = function (orderId) {
    if (!confirm('آیا این سفارش را تایید می‌کنید و شروع به کار می‌کنید؟')) return;
    try {
        const orders = DataModule.getOrders();
        const idx    = orders.findIndex(o => o.id === orderId);
        if (idx === -1) { UTILS.showNotification('سفارش یافت نشد', 'error'); return; }

        orders[idx].status          = 'in_progress';
        orders[idx].confirmedByAgent= true;
        orders[idx].confirmedAt     = new Date().toISOString();
        orders[idx].updatedAt       = new Date().toISOString();

        localStorage.setItem(CONFIG.STORAGE_KEYS.ORDERS, JSON.stringify(orders));

        if (typeof SupabaseDataModule !== 'undefined' &&
            typeof SupabaseConnection  !== 'undefined' && SupabaseConnection.isOnline) {
            SupabaseDataModule.saveOrders(orders).catch(e =>
                console.warn('⚠️ Supabase sync خطا:', e.message));
        }
        if (typeof RealtimeEvents !== 'undefined') {
            RealtimeEvents.emit(RealtimeEvents.EVENTS.ORDERS_CHANGED, { orders });
        }

        UTILS.showNotification('✅ سفارش تایید شد — در حال انجام', 'success', 3000);
        setTimeout(() => {
            _agentRerender();
            if (typeof window.startAgentTimers === 'function') window.startAgentTimers();
        }, 100);
    } catch (err) {
        console.error('agentConfirmOrder خطا:', err);
        UTILS.showNotification('خطا در تایید سفارش: ' + err.message, 'error');
    }
};

// ── تایمر countdown ──────────────────────────────────────────
window.startAgentTimers = function () {
    const currentUser = _agentGetCurrentUser();
    if (!currentUser) return;

    const myOrders = _agentGetMyOrders(currentUser.id).filter(o => o.deadlineDateTime);
    const tick = () => myOrders.forEach(o => window.updateOrderTimer(o.id, o.deadlineDateTime));
    tick();
    setInterval(tick, 1000);
};

window.updateOrderTimer = function (orderId, deadlineDateTime) {
    const daysEl  = document.getElementById('timer-days-'  + orderId);
    const hoursEl = document.getElementById('timer-hours-' + orderId);
    if (!daysEl || !hoursEl) return;

    const deadline = new Date(deadlineDateTime);
    if (isNaN(deadline.getTime())) {
        daysEl.textContent = hoursEl.textContent = '?'; return;
    }
    const diff = deadline - new Date();
    if (diff <= 0) {
        daysEl.textContent = hoursEl.textContent = '0';
        daysEl.classList.add('text-red-400');
        hoursEl.classList.add('text-red-400');
        return;
    }
    const days  = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    daysEl.textContent  = days;
    hoursEl.textContent = hours;

    if (days === 0 && hours < 6) {
        daysEl.className  = daysEl.className.replace(/text-\w+-400/g,'') + ' text-red-400';
        hoursEl.className = hoursEl.className.replace(/text-\w+-400/g,'') + ' text-red-400';
    } else if (days === 0) {
        daysEl.className  = daysEl.className.replace(/text-\w+-400/g,'') + ' text-lime-400';
        hoursEl.className = hoursEl.className.replace(/text-\w+-400/g,'') + ' text-lime-400';
    }
};

// ── کارت وظیفه عامل ─────────────────────────────────────────
window.getAgentTaskCard = function (task, userId) {
    const statusColors = {
        pending:     'border-lime-500 bg-lime-500/10',
        in_progress: 'border-blue-500 bg-blue-500/10',
        completed:   'border-green-500 bg-green-500/10',
    };
    const statusTexts = { pending:'در انتظار', in_progress:'در حال انجام', completed:'تکمیل شده' };
    const badgeColors = { pending:'bg-lime-500', in_progress:'bg-blue-500', completed:'bg-green-500' };

    const priorityBadge = task.priority === 'high'
        ? '<span class="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">فوری</span>'
        : task.priority === 'medium'
        ? '<span class="text-xs bg-orange-400 text-white px-2 py-0.5 rounded-full">متوسط</span>' : '';

    const orderBadge = task.isOrderTask
        ? `<span class="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full"><i class="fas fa-shopping-bag ml-1"></i>از سفارش</span>` : '';

    const orderInfo = task.isOrderTask ? `
        <div class="mt-2 bg-slate-700 rounded p-2 text-xs text-gray-300 space-y-1">
            ${task.studentName ? `<div><i class="fas fa-user-graduate ml-1 text-blue-400"></i>دانشجو: <span class="text-white">${task.studentName}</span></div>` : ''}
            ${task.university  ? `<div><i class="fas fa-university ml-1 text-blue-400"></i>دانشگاه: <span class="text-white">${task.university}</span></div>` : ''}
            ${task.orderType   ? `<div><i class="fas fa-file-alt ml-1 text-blue-400"></i>نوع: <span class="text-white">${task.orderType}</span></div>` : ''}
        </div>` : '';

    const cycle      = ['pending','in_progress','completed'];
    const nextStatus = cycle[(cycle.indexOf(task.status) + 1) % cycle.length];

    return `
    <div class="bg-slate-800 border-r-4 ${statusColors[task.status] || 'border-gray-500'} rounded-lg p-4">
        <div class="flex flex-wrap gap-2 mb-3">
            ${orderBadge}${priorityBadge}
            <span class="text-xs ${badgeColors[task.status] || 'bg-gray-500'} text-white px-2 py-0.5 rounded-full">
                ${statusTexts[task.status] || task.status}
            </span>
        </div>
        <h4 class="font-bold text-white text-sm mb-1">${task.title}</h4>
        ${task.description ? `<p class="text-gray-400 text-xs mb-2 line-clamp-2">${task.description}</p>` : ''}
        ${orderInfo}
        <div class="flex items-center justify-between mt-3">
            <span class="text-xs text-gray-500"><i class="fas fa-calendar ml-1"></i>${task.dueDate || 'بدون مهلت'}</span>
            <button onclick="window.agentToggleTaskStatus('${task.id}','${userId}')"
                    class="text-xs bg-slate-600 hover:bg-slate-500 text-white px-2 py-1 rounded transition-colors">
                <i class="fas fa-sync-alt ml-1"></i>${statusTexts[nextStatus]}
            </button>
        </div>
        ${task.voiceMessage ? `
        <div class="mt-3 bg-slate-700 rounded p-2 flex items-center gap-2">
            <button onclick="window.agentPlayVoice('${task.id}')"
                    class="w-8 h-8 rounded-full bg-lime-500 hover:bg-lime-600 flex items-center justify-center text-gray-900 flex-shrink-0">
                <i class="fas fa-play text-xs" id="agent-play-icon-${task.id}"></i>
            </button>
            <div class="flex-1">
                <div class="w-full bg-slate-600 rounded-full h-1">
                    <div class="bg-lime-400 h-1 rounded-full" style="width:0%" id="agent-progress-${task.id}"></div>
                </div>
                <span class="text-xs text-gray-400">${task.voiceDuration || '0:00'}</span>
            </div>
            <audio id="agent-audio-${task.id}" src="${task.voiceMessage}" class="hidden"></audio>
        </div>` : ''}
    </div>`;
};

// ── تغییر وضعیت وظیفه ────────────────────────────────────────
window.agentToggleTaskStatus = function (taskId, userId) {
    const data  = JSON.parse(localStorage.getItem('employee_tasks') || '{}');
    const tasks = data[userId] || [];
    const idx   = tasks.findIndex(t => t.id === taskId);
    if (idx === -1) return;
    const cycle    = ['pending','in_progress','completed'];
    tasks[idx].status = cycle[(cycle.indexOf(tasks[idx].status) + 1) % cycle.length];
    data[userId] = tasks;
    localStorage.setItem('employee_tasks', JSON.stringify(data));
    _agentRerender();
    UTILS.showNotification('وضعیت وظیفه تغییر کرد', 'success');
};

// ── پخش پیام صوتی ────────────────────────────────────────────
window.agentPlayVoice = function (taskId) {
    const audio = document.getElementById('agent-audio-' + taskId);
    const icon  = document.getElementById('agent-play-icon-' + taskId);
    const prog  = document.getElementById('agent-progress-' + taskId);
    if (!audio) return;
    if (audio.paused) {
        document.querySelectorAll('audio').forEach(a => { if (a !== audio) { a.pause(); a.currentTime = 0; } });
        audio.play();
        icon.className = 'fas fa-pause text-xs';
        audio.ontimeupdate = () => { prog.style.width = (audio.currentTime / audio.duration) * 100 + '%'; };
        audio.onended = () => { icon.className = 'fas fa-play text-xs'; prog.style.width = '0%'; };
    } else {
        audio.pause();
        icon.className = 'fas fa-play text-xs';
    }
};

console.log('✅ agent-orders.js بارگذاری شد');
