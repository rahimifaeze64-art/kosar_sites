// ============================================================
// manages-chat.js  v2 — گفتگوی گروهی مدیریت
// ذخیره: Supabase (management_messages) + Storage (فایل‌ها)
// Realtime: Supabase Realtime subscription
// شرکت‌کنندگان: مدیر + همه کارمندان از profiles
// ============================================================
class ManagesChat {
    constructor() {
        this.messages     = [];
        this.participants = [];
        this.isRecording  = false;
        this.audioRecorder = null;
        this.audioChunks  = [];
        this._realtimeSub = null;
        this._initialized = false;
        this._sending     = false;
        this.searchQuery  = '';
        this.init();
    }

    // ── راه‌اندازی ────────────────────────────────────────────
    async init() {
        if (this._initialized) {
            this.renderMessages();
            return;
        }
        this._initialized = true;

        // صبر برای آماده شدن SupabaseDataModule (حداکثر ۳ ثانیه)
        await this._waitForSupabase();

        await this.loadParticipants();
        await this.loadMessages();
        this.renderMessages();
        this.scrollToBottom();
        this.setupAudioRecorder();
        this.subscribeRealtime();
    }

    // ── صبر برای آماده شدن Supabase ──────────────────────────
    _waitForSupabase() {
        return new Promise(resolve => {
            if (typeof SupabaseDataModule !== 'undefined' &&
                typeof SupabaseDataModule.getManagementMessages === 'function') {
                return resolve();
            }
            let tries = 0;
            const check = setInterval(() => {
                tries++;
                if (typeof SupabaseDataModule !== 'undefined' &&
                    typeof SupabaseDataModule.getManagementMessages === 'function') {
                    clearInterval(check);
                    resolve();
                } else if (tries >= 30) { // max 3s
                    clearInterval(check);
                    console.warn('⚠️ ManagesChat: Supabase timeout — fallback به localStorage');
                    resolve();
                }
            }, 100);
        });
    }

    // ── بارگذاری شرکت‌کنندگان از Supabase ────────────────────
    async loadParticipants() {
        try {
            if (typeof SupabaseDataModule !== 'undefined' &&
                typeof SupabaseDataModule.getManagementChatParticipants === 'function') {
                this.participants = await SupabaseDataModule.getManagementChatParticipants();
            }
        } catch (e) {
            console.warn('⚠️ loadParticipants خطا:', e.message);
        }
        // اگر خالی بود fallback به localStorage
        if (!this.participants.length) {
            const users = JSON.parse(localStorage.getItem('edu_system_users') || localStorage.getItem('users') || '[]');
            this.participants = users.filter(u => u.role === 'manager' || u.role === 'employee');
        }
    }

    // ── بارگذاری پیام‌ها ──────────────────────────────────────
    async loadMessages() {
        try {
            if (typeof SupabaseDataModule !== 'undefined' &&
                typeof SupabaseDataModule.getManagementMessages === 'function') {
                this.messages = await SupabaseDataModule.getManagementMessages(150);
                return;
            }
        } catch (e) {
            console.warn('⚠️ loadMessages خطا:', e.message);
        }
        // fallback localStorage
        const raw = localStorage.getItem('mgmt_chat_messages');
        this.messages = raw ? JSON.parse(raw) : [];
    }

    // ── Realtime subscription ─────────────────────────────────
    subscribeRealtime() {
        if (typeof SupabaseDataModule === 'undefined' ||
            typeof SupabaseDataModule.subscribeToManagementChat !== 'function') return;
        this._realtimeSub = SupabaseDataModule.subscribeToManagementChat((event, msg) => {
            const currentUser = this._currentUser();
            if (event === 'INSERT') {
                // جلوگیری از دوبار نشان دادن پیام خودم
                if (msg.senderId === currentUser?.id) {
                    // فقط _pending رو false کن
                    const idx = this.messages.findIndex(m => m._pending && m.senderId === msg.senderId);
                    if (idx >= 0) { this.messages[idx] = { ...msg }; this.renderMessages(); return; }
                }
                const exists = this.messages.find(m => m.id === msg.id);
                if (!exists) {
                    this.messages.push(msg);
                    this.renderMessages();
                    this.scrollToBottom();
                }
            } else if (event === 'UPDATE') {
                const idx = this.messages.findIndex(m => m.id === msg.id);
                if (idx >= 0) {
                    if (msg.deleted) { this.messages.splice(idx, 1); }
                    else { this.messages[idx] = msg; }
                    this.renderMessages();
                }
            }
        });
    }

    // ── ارسال پیام متنی ───────────────────────────────────────
    async sendMessage() {
        if (this._sending) return;
        const input = document.getElementById('managesChatInput');
        const text  = input?.value?.trim();
        if (!text) return;

        this._sending = true;
        const user = this._currentUser();
        const msgId = 'mgmt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

        const msg = {
            id:         msgId,
            senderId:   user.id,
            senderName: user.name,
            senderRole: user.role,
            msgType:    'text',
            content:    text,
            text,
            mentions:   this._extractMentions(text),
            createdAt:  new Date().toISOString(),
            _pending:   true
        };

        // نمایش فوری (optimistic)
        this.messages.push(msg);
        input.value = '';
        input.style.height = 'auto';
        this.renderMessages();
        this.scrollToBottom();

        try {
            if (typeof SupabaseDataModule !== 'undefined') {
                await SupabaseDataModule.sendManagementMessage(msg);
            }
        } catch (e) {
            console.warn('⚠️ sendMessage خطا:', e.message);
        }
        this._sending = false;
    }

    // ── پیوست فایل ───────────────────────────────────────────
    attachFile() {
        const input = document.createElement('input');
        input.type   = 'file';
        input.accept = 'image/*,.pdf,.doc,.docx,.zip,.rar';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 20 * 1024 * 1024) { alert('حداکثر حجم فایل ۲۰ مگابایت است'); return; }
            await this._sendFileMessage(file);
        };
        input.click();
    }

    // ── ارسال پیام فایل/تصویر ────────────────────────────────
    async _sendFileMessage(file) {
        const user  = this._currentUser();
        const msgId = 'mgmt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        const isImage = file.type.startsWith('image/');
        const isVoice = file.type.startsWith('audio/');
        const msgType = isVoice ? 'voice' : (isImage ? 'image' : 'file');

        // نمایش موقت با previewURL
        const previewUrl = URL.createObjectURL(file);
        const msg = {
            id:         msgId,
            senderId:   user.id,
            senderName: user.name,
            senderRole: user.role,
            msgType,
            content:    file.name,
            fileUrl:    previewUrl,
            fileName:   file.name,
            fileType:   file.type,
            fileSize:   file.size,
            mentions:   [],
            createdAt:  new Date().toISOString(),
            _pending:   true,
            _localFile: true
        };
        this.messages.push(msg);
        this.renderMessages();
        this.scrollToBottom();

        try {
            let finalUrl = previewUrl;
            let filePath = null;

            if (typeof SupabaseDataModule !== 'undefined') {
                const uploaded = await SupabaseDataModule.uploadManagementChatFile(file, msgId);
                if (uploaded) {
                    finalUrl = uploaded.url;
                    filePath = uploaded.path;
                }
            }

            // آپدیت URL واقعی در پیام
            const idx = this.messages.findIndex(m => m.id === msgId);
            if (idx >= 0) {
                this.messages[idx].fileUrl   = finalUrl;
                this.messages[idx].filePath  = filePath;
                this.messages[idx]._pending  = false;
                this.messages[idx]._localFile = false;
            }

            const finalMsg = { ...msg, fileUrl: finalUrl, filePath };
            if (typeof SupabaseDataModule !== 'undefined') {
                await SupabaseDataModule.sendManagementMessage(finalMsg);
            }
            this.renderMessages();
        } catch (e) {
            console.warn('⚠️ _sendFileMessage خطا:', e.message);
        }
    }

    // ── ضبط صوت ──────────────────────────────────────────────
    setupAudioRecorder() {
        if (!navigator.mediaDevices?.getUserMedia) return;
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                this.audioRecorder = new MediaRecorder(stream);
                this.audioRecorder.ondataavailable = e => { if (e.data.size > 0) this.audioChunks.push(e.data); };
                this.audioRecorder.onstop = () => {
                    const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
                    this.audioChunks = [];
                    const voiceFile = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
                    this._sendFileMessage(voiceFile);
                };
            })
            .catch(() => {});
    }

    toggleVoiceRecording() {
        if (!this.audioRecorder) { alert('دسترسی به میکروفون ممکن نیست'); return; }
        const btn = document.getElementById('recordVoiceBtn');
        if (this.isRecording) {
            this.audioRecorder.stop();
            this.isRecording = false;
            if (btn) { btn.innerHTML = '<i class="fas fa-microphone"></i>'; btn.style.background = '#ef4444'; }
        } else {
            this.audioChunks = [];
            this.audioRecorder.start();
            this.isRecording = true;
            if (btn) { btn.innerHTML = '<i class="fas fa-stop"></i>'; btn.style.background = '#dc2626'; }
        }
    }

    // ── ویرایش پیام ──────────────────────────────────────────
    editMessage(msgId) {
        const msg = this.messages.find(m => m.id === msgId);
        if (!msg || msg.msgType !== 'text') { alert('فقط پیام‌های متنی قابل ویرایش هستند'); return; }
        this._closeContextMenu();

        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onclick="event.stopPropagation()">
                <h3 class="text-gray-800 font-bold text-lg mb-4 flex items-center gap-2">
                    <i class="fas fa-edit text-blue-500"></i> ویرایش پیام
                </h3>
                <textarea id="edit-msg-text" rows="4"
                    class="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-gray-800 resize-none focus:outline-none focus:border-blue-400"
                    >${this._esc(msg.content || msg.text || '')}</textarea>
                <div class="flex gap-3 mt-4">
                    <button onclick="window.managesChatInstance._saveEdit('${msgId}'); this.closest('.fixed').remove();"
                        class="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl font-bold">ذخیره</button>
                    <button onclick="this.closest('.fixed').remove()"
                        class="px-5 bg-gray-100 text-gray-700 py-2.5 rounded-xl">انصراف</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
        document.getElementById('edit-msg-text')?.focus();
    }

    async _saveEdit(msgId) {
        const newText = document.getElementById('edit-msg-text')?.value?.trim();
        if (!newText) { alert('متن خالی نیست'); return; }
        const idx = this.messages.findIndex(m => m.id === msgId);
        if (idx >= 0) {
            this.messages[idx].content = newText;
            this.messages[idx].text    = newText;
            this.messages[idx].edited  = true;
            this.messages[idx].editedAt = new Date().toISOString();
            this.renderMessages();
        }
        if (typeof SupabaseDataModule !== 'undefined') {
            await SupabaseDataModule.editManagementMessage(msgId, newText);
        }
    }

    // ── حذف پیام ─────────────────────────────────────────────
    async deleteMessage(msgId) {
        if (!confirm('این پیام حذف شود؟')) return;
        this._closeContextMenu();
        this.messages = this.messages.filter(m => m.id !== msgId);
        this.renderMessages();
        if (typeof SupabaseDataModule !== 'undefined') {
            await SupabaseDataModule.deleteManagementMessage(msgId);
        }
    }

    // ── ذخیره فایل در بایگانی ────────────────────────────────
    saveToArchive(msgId) {
        const msg = this.messages.find(m => m.id === msgId);
        if (!msg || (msg.msgType === 'text')) { alert('فقط فایل‌ها و صداها ذخیره می‌شوند'); return; }
        this._closeContextMenu();

        const cats = [
            { id:'form1', name:'استماره 1' }, { id:'form2', name:'استماره 2' },
            { id:'correspondence', name:'همانندجویی‌ها' }, { id:'administrative', name:'امر اداری‌ها' },
            { id:'thesis-original', name:'رساله - فایل اولیه' }, { id:'thesis-edited', name:'رساله - تعدیل شده' },
            { id:'thesis-pre-defense', name:'رساله - فایل منضده قبل مناقشه' },
            { id:'thesis-post-defense-edit', name:'رساله - تعدیل بعد مناقشه' },
            { id:'thesis-translated', name:'رساله ترجمه شده' },
            { id:'thesis-iraqi-citation', name:'رساله - استلال عراقی' },
            { id:'thesis-irandoc', name:'رساله - تنضید ایران داک' },
            { id:'articles', name:'مقاله‌ها' }, { id:'binding', name:'تجلید' }, { id:'other', name:'سایر' }
        ];
        const opts = cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl" onclick="event.stopPropagation()">
                <h3 class="text-gray-800 font-bold text-lg mb-4 flex items-center gap-2">
                    <i class="fas fa-archive text-green-600"></i> ذخیره در بایگانی
                </h3>
                <label class="text-gray-600 text-sm mb-1 block">دسته‌بندی</label>
                <select id="archive-cat-sel" class="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 mb-4 focus:outline-none">${opts}</select>
                <div class="flex gap-3">
                    <button onclick="window.managesChatInstance._confirmArchive('${msgId}'); this.closest('.fixed').remove();"
                        class="flex-1 bg-green-600 hover:bg-green-500 text-white py-2.5 rounded-xl font-bold">ذخیره</button>
                    <button onclick="this.closest('.fixed').remove()"
                        class="px-5 bg-gray-100 text-gray-700 py-2.5 rounded-xl">انصراف</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    }

    async _confirmArchive(msgId) {
        const msg = this.messages.find(m => m.id === msgId);
        const category = document.getElementById('archive-cat-sel')?.value || 'other';
        if (!msg) return;

        const fileRecord = {
            id:          'arch_' + Date.now(),
            name:        msg.fileName || `voice-${Date.now()}.webm`,
            category,
            author:      msg.senderName,
            type:        (msg.fileName || '').split('.').pop().toLowerCase() || 'file',
            size:        msg.fileSize ? Math.round(msg.fileSize / 1024) + ' KB' : '',
            url:         msg.fileUrl || '#',
            storagePath: msg.filePath || null,
            uploadDate:  new Date().toISOString(),
            uploadedById: this._currentUser()?.id || null
        };

        if (typeof SupabaseDataModule !== 'undefined') {
            await SupabaseDataModule.saveArchiveFile(fileRecord);
        } else {
            const existing = JSON.parse(localStorage.getItem('archiveFiles') || '[]');
            existing.unshift(fileRecord);
            localStorage.setItem('archiveFiles', JSON.stringify(existing));
        }
        alert('✅ فایل در بایگانی ذخیره شد');
    }

    // ── منشن ─────────────────────────────────────────────────
    showMentionList() {
        document.getElementById('mgmt-mention-modal')?.remove();
        const modal = document.createElement('div');
        modal.id = 'mgmt-mention-modal';
        modal.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4';
        const rows = this.participants.map(p => `
            <div class="flex items-center gap-3 p-3 bg-gray-50 hover:bg-blue-50 rounded-xl cursor-pointer transition-all border border-transparent hover:border-blue-200"
                 onclick="document.getElementById('managesChatInput').value += '@${this._esc(p.username)} ';
                          document.getElementById('managesChatInput').focus();
                          document.getElementById('mgmt-mention-modal').remove();">
                <div class="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
                     style="background:${p.role === 'manager' ? '#7c3aed' : '#3b82f6'}">
                    ${(p.name || '؟').charAt(0)}
                </div>
                <div class="flex-1 min-w-0">
                    <p class="font-medium text-gray-800 text-sm truncate">${this._esc(p.name)}</p>
                    <p class="text-gray-400 text-xs">@${this._esc(p.username)}</p>
                </div>
                <span class="text-xs px-2 py-0.5 rounded-full font-semibold ${p.role === 'manager' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}">
                    ${p.role === 'manager' ? 'مدیر' : 'کارمند'}
                </span>
            </div>`).join('');
        modal.innerHTML = `
            <div class="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl max-h-[70vh] flex flex-col" onclick="event.stopPropagation()">
                <div class="flex items-center justify-between mb-3">
                    <h3 class="font-bold text-gray-800 flex items-center gap-2">
                        <i class="fas fa-at text-blue-500"></i> منشن کردن
                    </h3>
                    <button onclick="document.getElementById('mgmt-mention-modal').remove()"
                        class="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
                </div>
                <div class="space-y-2 overflow-y-auto flex-1">${rows}</div>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    }

    // ── context menu (راست‌کلیک / long‌press) ────────────────
    showContextMenu(e, msgId) {
        e.preventDefault();
        this._closeContextMenu();
        const msg  = this.messages.find(m => m.id === msgId);
        const user = this._currentUser();
        if (!msg) return;
        const isOwn = msg.senderId === user?.id;
        const isFile = msg.msgType !== 'text';

        const menu = document.createElement('div');
        menu.id = 'mgmt-ctx-menu';
        menu.className = 'fixed bg-white rounded-xl shadow-2xl border border-gray-200 z-[9999] py-1 min-w-[180px]';
        menu.style.cssText = `left:${Math.min(e.clientX, window.innerWidth - 200)}px;top:${Math.min(e.clientY, window.innerHeight - 200)}px`;
        menu.innerHTML = `
            ${isOwn && !isFile ? `<button onclick="window.managesChatInstance.editMessage('${msgId}')"
                class="w-full text-right px-4 py-2.5 hover:bg-gray-50 text-gray-700 flex items-center gap-3 text-sm">
                <i class="fas fa-edit text-blue-400 w-4"></i> ویرایش</button>` : ''}
            ${isOwn ? `<button onclick="window.managesChatInstance.deleteMessage('${msgId}')"
                class="w-full text-right px-4 py-2.5 hover:bg-red-50 text-red-600 flex items-center gap-3 text-sm">
                <i class="fas fa-trash w-4"></i> حذف</button>` : ''}
            ${isFile ? `<button onclick="window.managesChatInstance.saveToArchive('${msgId}')"
                class="w-full text-right px-4 py-2.5 hover:bg-green-50 text-green-700 flex items-center gap-3 text-sm">
                <i class="fas fa-archive text-green-500 w-4"></i> ذخیره در بایگانی</button>` : ''}
            ${isFile && msg.fileUrl ? `<a href="${this._esc(msg.fileUrl)}" download="${this._esc(msg.fileName || 'file')}" target="_blank"
                class="block w-full text-right px-4 py-2.5 hover:bg-blue-50 text-blue-700 flex items-center gap-3 text-sm">
                <i class="fas fa-download text-blue-400 w-4"></i> دانلود</a>` : ''}`;

        document.body.appendChild(menu);
        setTimeout(() => {
            document.addEventListener('click', this._ctxClose = () => this._closeContextMenu(), { once: true });
        }, 50);
    }

    _closeContextMenu() {
        document.getElementById('mgmt-ctx-menu')?.remove();
        if (this._ctxClose) { document.removeEventListener('click', this._ctxClose); this._ctxClose = null; }
    }

    handleLongPressStart(e, msgId) {
        this._longPressTimer = setTimeout(() => this.showContextMenu(e, msgId), 600);
    }

    handleLongPressEnd() {
        clearTimeout(this._longPressTimer);
    }

    // ── رندر پیام‌ها ──────────────────────────────────────────
    renderMessages() {
        const container = document.getElementById('managesChatMessages');
        if (!container) return;
        const user = this._currentUser();

        let list = this.messages.filter(m => !m.deleted);
        if (this.searchQuery.trim()) {
            const q = this.searchQuery.toLowerCase();
            list = list.filter(m =>
                (m.content || m.text || '').toLowerCase().includes(q) ||
                (m.senderName || '').toLowerCase().includes(q) ||
                (m.fileName || '').toLowerCase().includes(q));
        }

        if (!list.length) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-center py-16">
                    <i class="fas fa-comments text-5xl text-gray-300 mb-3"></i>
                    <p class="text-gray-400">${this.searchQuery ? 'پیامی یافت نشد' : 'هنوز پیامی ارسال نشده است'}</p>
                </div>`;
            return;
        }

        // گروه‌بندی بر اساس تاریخ
        let lastDate = '';
        container.innerHTML = list.map(msg => {
            const isOwn    = msg.senderId === user?.id;
            const dateStr  = this._formatDate(msg.createdAt);
            const timeStr  = this._formatTime(msg.createdAt);
            const dateDiv  = dateStr !== lastDate
                ? `<div class="flex items-center gap-3 my-3">
                       <div class="flex-1 h-px bg-gray-200"></div>
                       <span class="text-gray-400 text-xs px-2">${dateStr}</span>
                       <div class="flex-1 h-px bg-gray-200"></div>
                   </div>`
                : '';
            lastDate = dateStr;

            const avatarBg = msg.senderRole === 'manager' ? '#7c3aed' : '#3b82f6';
            const roleBadge = msg.senderRole === 'manager'
                ? '<span class="text-xs px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold">مدیر</span>'
                : '<span class="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">کارمند</span>';
            const pendingDot = msg._pending
                ? '<span class="text-gray-400 text-xs mr-1" title="در حال ارسال..."><i class="fas fa-clock"></i></span>' : '';
            const editedNote = msg.edited
                ? '<span class="text-gray-400 text-xs mr-1">(ویرایش شده)</span>' : '';
            const bubbleBg = isOwn
                ? 'background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;'
                : 'background:#f1f5f9;color:#1e293b;';

            return `${dateDiv}
            <div class="flex items-end gap-2 mb-3 ${isOwn ? 'flex-row-reverse' : ''} group">
                <!-- آواتار -->
                <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${isOwn ? 'ml-1' : 'mr-1'}"
                     style="background:${avatarBg}">${(msg.senderName || '؟').charAt(0)}</div>
                <!-- حباب -->
                <div class="max-w-[70%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}">
                    <!-- اطلاعات فرستنده -->
                    <div class="flex items-center gap-1.5 mb-1 ${isOwn ? 'flex-row-reverse' : ''}">
                        <span class="text-xs font-semibold text-gray-600">${this._esc(msg.senderName)}</span>
                        ${roleBadge}
                        <span class="text-gray-400 text-xs">${timeStr}</span>
                        ${editedNote}${pendingDot}
                    </div>
                    <!-- محتوا -->
                    <div class="rounded-2xl px-4 py-2.5 relative cursor-pointer select-text"
                         style="${bubbleBg}max-width:100%;"
                         oncontextmenu="event.preventDefault();window.managesChatInstance.showContextMenu(event,'${msg.id}');"
                         ontouchstart="window.managesChatInstance.handleLongPressStart(event,'${msg.id}')"
                         ontouchend="window.managesChatInstance.handleLongPressEnd()"
                         ontouchmove="window.managesChatInstance.handleLongPressEnd()">
                        ${this._renderContent(msg)}
                    </div>
                    <!-- منشن‌ها -->
                    ${msg.mentions?.length ? `<div class="mt-1 flex flex-wrap gap-1">${msg.mentions.map(m=>`<span class="text-xs px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700">@${this._esc(m)}</span>`).join('')}</div>` : ''}
                </div>
            </div>`;
        }).join('');
    }

    // ── رندر محتوای یک پیام ──────────────────────────────────
    _renderContent(msg) {
        switch (msg.msgType) {
            case 'image':
                return `<img src="${this._esc(msg.fileUrl)}" alt="${this._esc(msg.fileName)}"
                    class="max-w-full rounded-xl cursor-pointer max-h-64 object-cover"
                    onclick="window.open('${this._esc(msg.fileUrl)}','_blank')"
                    onerror="this.src='';this.alt='تصویر قابل نمایش نیست'">`;
            case 'voice':
                return `<div class="flex items-center gap-3 min-w-[220px]">
                    <i class="fas fa-microphone text-lg opacity-70"></i>
                    <audio controls src="${this._esc(msg.fileUrl)}" class="flex-1" style="height:32px;max-width:240px;">
                        مرورگر شما پخش صوت را پشتیبانی نمی‌کند
                    </audio>
                </div>`;
            case 'file':
                return `<div class="flex items-center gap-3 py-1">
                    <i class="fas fa-file text-2xl opacity-70"></i>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium truncate">${this._esc(msg.fileName || msg.content)}</p>
                        ${msg.fileSize ? `<p class="text-xs opacity-60">${Math.round(msg.fileSize/1024)} KB</p>` : ''}
                    </div>
                    ${msg.fileUrl && msg.fileUrl !== '#' ? `<a href="${this._esc(msg.fileUrl)}" download="${this._esc(msg.fileName || 'file')}" target="_blank"
                        class="opacity-70 hover:opacity-100 transition-opacity"><i class="fas fa-download"></i></a>` : ''}
                </div>`;
            default:
                return `<p class="whitespace-pre-wrap break-words text-sm leading-relaxed">${this._highlightMentions(this._esc(msg.content || msg.text || ''))}</p>`;
        }
    }

    scrollToBottom() {
        setTimeout(() => {
            const c = document.getElementById('managesChatMessages');
            if (c) c.scrollTop = c.scrollHeight;
        }, 80);
    }

    setSearchQuery(q) { this.searchQuery = q; this.renderMessages(); }

    // ── رندر نوار شرکت‌کنندگان ───────────────────────────────
    renderParticipantsBar() {
        const bar = document.getElementById('mgmt-participants-bar');
        if (!bar) return;
        bar.innerHTML = this.participants.map(p => `
            <div class="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm whitespace-nowrap flex-shrink-0"
                 style="${p.role === 'manager' ? 'background:#7c3aed;color:white;' : 'background:#e0e7ff;color:#3730a3;'}">
                <i class="fas ${p.role === 'manager' ? 'fa-crown' : 'fa-user'} text-xs"></i>
                <span>${this._esc(p.name)}</span>
            </div>`).join('');
    }

    // ── helpers ───────────────────────────────────────────────
    _currentUser() {
        try {
            return JSON.parse(localStorage.getItem('currentUser') ||
                              localStorage.getItem('edu_system_current_user') || 'null');
        } catch { return null; }
    }

    _extractMentions(text) {
        const matches = [];
        const re = /@(\S+)/g;
        let m;
        while ((m = re.exec(text)) !== null) matches.push(m[1]);
        return matches;
    }

    _highlightMentions(text) {
        return text.replace(/@(\S+)/g,
            '<span class="px-1 py-0.5 rounded font-semibold" style="background:rgba(250,204,21,0.3);color:#92400e;">@$1</span>');
    }

    _esc(s) {
        return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    _formatDate(iso) {
        if (!iso) return '';
        try {
            const d = new Date(iso);
            if (typeof Jalali !== 'undefined') return Jalali.toJalaliDisplay(d);
            return d.toLocaleDateString('fa-IR');
        } catch { return ''; }
    }

    _formatTime(iso) {
        if (!iso) return '';
        try { return new Date(iso).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }); }
        catch { return ''; }
    }

    // ── destroy — برای حذف subscription هنگام خروج ───────────
    destroy() {
        if (typeof SupabaseDataModule !== 'undefined') {
            SupabaseDataModule.unsubscribeManagementChat();
        }
        this._initialized = false;
    }
}

// ── expose global ─────────────────────────────────────────────
window.ManagesChat = ManagesChat;

// راه‌اندازی خودکار در صفحه مستقل
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('managesChatMessages') && !window.managesChatInstance) {
        window.managesChatInstance = new ManagesChat();
    }
});
