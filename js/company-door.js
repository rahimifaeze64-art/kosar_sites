/**
 * company-door.js
 * کنترل در شرکت از طریق Raspberry Pi
 * تاریخچه در Supabase جدول: door_logs
 */
const CompanyDoorModule = (function () {
    'use strict';

    // ── تنظیمات — آدرس Raspberry Pi رو اینجا بذار ─────────
    // مثال: 'http://192.168.1.50:5000'  یا آدرس public با port forward
    const DOOR_API_BASE = localStorage.getItem('door_api_base') || '';

    const LOG_TABLE = 'door_logs';

    let _currentUser = null;
    let _logs        = [];
    let _status      = 'unknown'; // 'open' | 'closed' | 'unknown'
    let _loading     = false;

    function sb() {
        return (typeof getSupabaseClient === 'function') ? getSupabaseClient() : null;
    }

    function esc(s) {
        return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // ── init ─────────────────────────────────────────────────
    async function init(user) {
        _currentUser = user;
        await loadLogs();
        render();
    }

    // ── بارگذاری تاریخچه از Supabase ────────────────────────
    async function loadLogs() {
        const client = sb();
        if (!client) {
            // fallback به localStorage
            try { _logs = JSON.parse(localStorage.getItem('door_logs') || '[]'); } catch { _logs = []; }
            return;
        }
        const { data, error } = await client
            .from(LOG_TABLE)
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
        if (!error && data) {
            _logs = data;
            localStorage.setItem('door_logs', JSON.stringify(_logs));
        } else {
            try { _logs = JSON.parse(localStorage.getItem('door_logs') || '[]'); } catch { _logs = []; }
        }
    }

    // ── ذخیره لاگ ───────────────────────────────────────────
    async function saveLog(action) {
        const entry = {
            id:         'dl-' + Date.now() + '-' + Math.random().toString(36).substr(2,6),
            action,                                   // 'open' | 'close'
            user_name:  _currentUser?.name  || _currentUser?.username || 'نامشخص',
            user_role:  _currentUser?.role  || '',
            created_at: new Date().toISOString(),
        };
        _logs.unshift(entry);
        if (_logs.length > 50) _logs = _logs.slice(0, 50);
        localStorage.setItem('door_logs', JSON.stringify(_logs));

        const client = sb();
        if (client) {
            await client.from(LOG_TABLE).insert([{
                action:    entry.action,
                user_name: entry.user_name,
                user_role: entry.user_role,
            }]);
        }
    }

    // ── ارسال دستور به Raspberry Pi ─────────────────────────
    async function sendCommand(action) {
        if (_loading) return;

        const base = (localStorage.getItem('door_api_base') || '').trim();
        if (!base) {
            _showToast('اتصالات برقرار نیست', 'error');
            return;
        }

        _loading = true;
        _updateButtons();

        try {
            const endpoint = base.replace(/\/$/, '') + (action === 'open' ? '/open' : '/close');
            const res = await fetch(endpoint, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ action, requested_by: _currentUser?.name || 'app' }),
                signal:  AbortSignal.timeout(8000),
            });

            if (res.ok) {
                _status = action === 'open' ? 'open' : 'closed';
                await saveLog(action);
                _showToast(action === 'open' ? ' در باز شد' : ' در بسته شد', 'success');
                _updateAll();
            } else {
                _showToast(`خطا از سرور: ${res.status}`, 'error');
            }
        } catch (e) {
            if (e.name === 'TimeoutError' || e.name === 'AbortError') {
                _showToast('Raspberry Pi نرسید', 'error');
            } else {
                _showToast('به Raspberry Pi ناموفق بود', 'error');
            }
        } finally {
            _loading = false;
            _updateButtons();
        }
    }

    // ── رندر صفحه ────────────────────────────────────────────
    function render() {
        const root = document.getElementById('company-door-root');
        if (!root) return;
        root.innerHTML = _buildHTML();
        _updateButtons();
    }

    function _buildHTML() {
        const logsHtml = _buildLogsHTML();
        return `
        <div class="space-y-6 max-w-xl mx-auto" dir="rtl">

            <!-- هدر -->
            <div class="flex items-center justify-between">
                <h2 class="text-2xl font-bold text-white flex items-center gap-3">
                    <span class="bg-lime-500/20 p-2 rounded-xl">
                        <i class="fas fa-door-open text-lime-400"></i>
                    </span>
                    در شرکت
                </h2>
                <button onclick="CompanyDoorModule.showSettings()"
                    class="text-white/60 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-all" title="تنظیمات API">
                    <i class="fas fa-cog text-lg"></i>
                </button>
            </div>

            <!-- وضعیت فعلی -->
            <div class="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6 text-center">
                <div id="door-status-icon" class="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center text-5xl transition-all duration-500
                    ${_status==='open' ? 'bg-emerald-500/30 border-2 border-emerald-400' :
                      _status==='closed' ? 'bg-red-500/20 border-2 border-red-400/50' :
                      'bg-white/10 border-2 border-white/20'}">
                    <i class="fas ${_status==='open' ? 'fa-door-open text-emerald-400' :
                                    _status==='closed' ? 'fa-door-closed text-red-400' :
                                    'fa-question text-white/40'}"></i>
                </div>
                <p id="door-status-text" class="text-white font-bold text-xl mb-1">
                    ${_status==='open' ? 'در باز است' :
                      _status==='closed' ? 'در بسته است' : 'وضعیت نامشخص'}
                </p>
                <p class="text-white/50 text-sm">
                    ${_logs.length ? 'آخرین تغییر: ' + _formatTime(_logs[0]?.created_at) : 'بدون سابقه'}
                </p>
            </div>

            <!-- دکمه‌های کنترل -->
            <div class="grid grid-cols-2 gap-4">
                <button id="door-btn-open"
                    onclick="CompanyDoorModule.openDoor()"
                    class="flex flex-col items-center gap-3 py-8 px-4 rounded-2xl border-2 transition-all duration-200 font-bold text-lg
                           bg-emerald-500/20 hover:bg-emerald-500/40 border-emerald-400/50 hover:border-emerald-400 text-emerald-300 hover:text-white
                           active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
                    <i class="fas fa-lock-open text-3xl"></i>
                    باز کردن
                </button>
                <button id="door-btn-close"
                    onclick="CompanyDoorModule.closeDoor()"
                    class="flex flex-col items-center gap-3 py-8 px-4 rounded-2xl border-2 transition-all duration-200 font-bold text-lg
                           bg-red-500/10 hover:bg-red-500/30 border-red-400/30 hover:border-red-400 text-red-400 hover:text-white
                           active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
                    <i class="fas fa-lock text-3xl"></i>
                    بستن در
                </button>
            </div>

            <!-- تاریخچه -->
            <div class="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 overflow-hidden">
                <div class="flex items-center justify-between px-5 py-4 border-b border-white/10">
                    <h3 class="text-white font-bold flex items-center gap-2">
                        <i class="fas fa-history text-lime-400 text-sm"></i>
                        تاریخچه
                    </h3>
                    <span class="bg-white/10 text-white/60 text-xs px-2 py-0.5 rounded-full">${_logs.length} رویداد</span>
                </div>
                <div id="door-logs-list" class="divide-y divide-white/5 max-h-80 overflow-y-auto">
                    ${logsHtml}
                </div>
            </div>

        </div>`;
    }

    function _buildLogsHTML() {
        if (!_logs.length) return `
            <div class="text-center py-10 text-white/40">
                <i class="fas fa-clipboard-list text-3xl mb-2 block"></i>
                هنوز رویدادی ثبت نشده
            </div>`;

        return _logs.map(log => {
            const isOpen   = log.action === 'open';
            const iconClass = isOpen ? 'fa-door-open text-emerald-400' : 'fa-door-closed text-red-400';
            const bgClass   = isOpen ? 'bg-emerald-500/10' : 'bg-red-500/10';
            const label     = isOpen ? 'باز شد' : 'بسته شد';
            return `
            <div class="flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-all ${bgClass}">
                <div class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <i class="fas ${iconClass} text-sm"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-white text-sm font-medium">${label}</p>
                    <p class="text-white/50 text-xs truncate">
                        توسط: ${esc(log.user_name || 'نامشخص')}
                        ${log.user_role ? `· ${log.user_role === 'manager' ? 'مدیر' : 'کارمند'}` : ''}
                    </p>
                </div>
                <div class="text-white/40 text-xs text-left flex-shrink-0">${_formatTime(log.created_at)}</div>
            </div>`;
        }).join('');
    }

    // ── آپدیت دکمه‌ها بدون re-render کامل ───────────────────
    function _updateButtons() {
        const btnOpen  = document.getElementById('door-btn-open');
        const btnClose = document.getElementById('door-btn-close');
        if (!btnOpen || !btnClose) return;
        if (_loading) {
            btnOpen.disabled  = true;
            btnClose.disabled = true;
            btnOpen.innerHTML  = '<i class="fas fa-spinner fa-spin text-3xl"></i><span>در حال ارسال...</span>';
            btnClose.innerHTML = '<i class="fas fa-spinner fa-spin text-3xl"></i><span>در حال ارسال...</span>';
        } else {
            btnOpen.disabled  = false;
            btnClose.disabled = false;
            btnOpen.innerHTML  = '<i class="fas fa-lock-open text-3xl"></i>باز کردن';
            btnClose.innerHTML = '<i class="fas fa-lock text-3xl"></i>بستن در';
        }
    }

    function _updateAll() {
        // آپدیت آیکون وضعیت
        const icon = document.getElementById('door-status-icon');
        const text = document.getElementById('door-status-text');
        if (icon) {
            icon.className = `w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center text-5xl transition-all duration-500
                ${_status==='open' ? 'bg-emerald-500/30 border-2 border-emerald-400' : 'bg-red-500/20 border-2 border-red-400/50'}`;
            icon.innerHTML = `<i class="fas ${_status==='open' ? 'fa-door-open text-emerald-400' : 'fa-door-closed text-red-400'}"></i>`;
        }
        if (text) {
            text.textContent = _status === 'open' ? 'در باز است' : 'در بسته است';
        }
        // آپدیت لیست لاگ
        const logsList = document.getElementById('door-logs-list');
        if (logsList) logsList.innerHTML = _buildLogsHTML();
    }

    // ── فرمت زمان ────────────────────────────────────────────
    function _formatTime(iso) {
        if (!iso) return '—';
        try {
            const d = new Date(iso);
            const date = d.toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' });
            const time = d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
            return `${date} · ${time}`;
        } catch { return iso.substring(0, 16); }
    }

    // ── Toast notification ────────────────────────────────────
    function _showToast(msg, type = 'info') {
        const colors = { success: 'bg-emerald-500', error: 'bg-red-500', info: 'bg-blue-500' };
        const el = document.createElement('div');
        el.className = `fixed top-5 left-1/2 -translate-x-1/2 z-[9999] ${colors[type]||colors.info}
                        text-white px-6 py-3 rounded-2xl shadow-2xl font-medium text-sm
                        transition-all duration-300 flex items-center gap-2`;
        el.innerHTML = `<i class="fas ${type==='success'?'fa-check-circle':type==='error'?'fa-exclamation-circle':'fa-info-circle'}"></i>${msg}`;
        document.body.appendChild(el);
        setTimeout(() => { el.style.opacity='0'; setTimeout(()=>el.remove(), 300); }, 3000);
    }

    // ── مودال تنظیمات آدرس API ───────────────────────────────
    function showSettings() {
        document.getElementById('door-settings-modal')?.remove();
        const current = localStorage.getItem('door_api_base') || '';
        const modal   = document.createElement('div');
        modal.id = 'door-settings-modal';
        modal.className = 'fixed inset-0 bg-black/70 flex items-center justify-center z-[999] p-4';
        modal.innerHTML = `
        <div class="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-white/10 shadow-2xl" onclick="event.stopPropagation()">
            <div class="flex justify-between items-center mb-5">
                <h3 class="text-white font-bold text-lg flex items-center gap-2">
                    <i class="fas fa-cog text-lime-400"></i>تنظیمات اتصال
                </h3>
                <button onclick="document.getElementById('door-settings-modal').remove()"
                    class="text-white/50 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="space-y-4 text-sm">
                <div>
                    <label class="text-white/70 text-xs mb-1 block">آدرس API سرور Raspberry Pi</label>
                    <input id="door-api-input" type="text" value="${esc(current)}"
                        placeholder="مثال: http://192.168.1.50:5000"
                        class="w-full bg-white/10 text-white placeholder-white/30 px-4 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-lime-500 text-left" dir="ltr"/>
                    <p class="text-white/40 text-xs mt-1">
                        این آدرس باید از طریق اینترنت یا شبکه داخلی قابل دسترس باشد.<br>
                        endpoint های مورد نیاز: <code class="text-lime-400">POST /open</code> و <code class="text-lime-400">POST /close</code>
                    </p>
                </div>
                <div class="bg-white/5 rounded-xl p-3 text-xs text-white/50 space-y-1">
                    <p class="text-white/70 font-medium mb-1">نمونه کد Python برای Raspberry Pi:</p>
                    <pre class="text-lime-300 text-xs overflow-x-auto" dir="ltr">from flask import Flask, request
import RPi.GPIO as GPIO

app = Flask(__name__)
DOOR_PIN = 18
GPIO.setmode(GPIO.BCM)
GPIO.setup(DOOR_PIN, GPIO.OUT)

@app.route('/open', methods=['POST'])
def open_door():
    GPIO.output(DOOR_PIN, GPIO.HIGH)
    return {'status': 'opened'}

@app.route('/close', methods=['POST'])
def close_door():
    GPIO.output(DOOR_PIN, GPIO.LOW)
    return {'status': 'closed'}

app.run(host='0.0.0.0', port=5000)</pre>
                </div>
            </div>
            <div class="flex gap-3 mt-5">
                <button onclick="CompanyDoorModule.saveSettings()"
                    class="flex-1 bg-lime-600 hover:bg-lime-500 text-white font-bold py-2.5 rounded-xl transition-all">
                    <i class="fas fa-save ml-1"></i>ذخیره
                </button>
                <button onclick="document.getElementById('door-settings-modal').remove()"
                    class="px-5 bg-white/10 hover:bg-white/20 text-white py-2.5 rounded-xl transition-all">
                    انصراف
                </button>
            </div>
        </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    }

    function saveSettings() {
        const val = document.getElementById('door-api-input')?.value.trim() || '';
        localStorage.setItem('door_api_base', val);
        document.getElementById('door-settings-modal')?.remove();
        _showToast('تنظیمات ذخیره شد', 'success');
    }

    // ── public API ────────────────────────────────────────────
    function openDoor()  { sendCommand('open');  }
    function closeDoor() { sendCommand('close'); }

    // محتوا برای Alpine x-html
    function getContent() {
        setTimeout(() => {
            const root = document.getElementById('company-door-root');
            if (root) CompanyDoorModule.init(
                (typeof Alpine !== 'undefined' && document.querySelector('[x-data]'))
                    ? Alpine.$data(document.querySelector('[x-data]'))?.currentUser
                    : null
            );
        }, 80);
        return `<div id="company-door-root" class="p-4 md:p-6">
            <div class="flex items-center justify-center py-20">
                <i class="fas fa-spinner fa-spin text-3xl text-lime-400"></i>
            </div>
        </div>`;
    }

    return { init, getContent, openDoor, closeDoor, showSettings, saveSettings };

})();

window.CompanyDoorModule = CompanyDoorModule;
