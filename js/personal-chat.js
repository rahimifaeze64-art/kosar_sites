// Personal Chat Module - ماژول گفتگو شخصی
// ══════════════════════════════════════════════════════════════
// BUG FIX: کلید localStorage باید متقارن باشد
//   پیام A→B باید هم توسط A و هم توسط B قابل خواندن باشد.
//   راه‌حل: کلید را همیشه با ID کوچکتر اول می‌سازیم:
//   chatKey(a, b) = "pc_" + min(a,b) + "_" + max(a,b)
// ══════════════════════════════════════════════════════════════
const PersonalChatModule = {
    selectedUser: null,
    messages: [],
    initialized: false,
    _pollTimer: null,

    // ── کلید متقارن localStorage ──────────────────────────────
    _chatKey(idA, idB) {
        return 'pc_' + [String(idA), String(idB)].sort().join('_');
    },

    // ── کاربر جاری ───────────────────────────────────────────
    getCurrentUser() {
        try {
            const u = JSON.parse(localStorage.getItem('currentUser'));
            if (u && u.id) return u;
        } catch (e) {}
        return { id: 'mgr001', name: 'مدیر سیستم', username: 'manager', role: 'manager' };
    },

    // ── لیست کاربران از DataModule (نه hardcode) ─────────────
    getAvailableUsers(currentUser) {
        let allUsers = [];
        try {
            if (typeof DataModule !== 'undefined') {
                allUsers = DataModule.getUsers() || [];
            }
        } catch (e) {}

        // fallback hardcoded اگر DataModule خالی بود
        if (!allUsers.length) {
            allUsers = [
                { id: 'mgr001',   name: 'مدیر سیستم',         username: 'manager', role: 'manager'  },
                { id: 'emp001',   name: 'سارا سادات حسینی',   username: 'zahra',   role: 'employee' },
                { id: 'emp002',   name: 'زینب بتول محمدی',     username: 'fatemeh', role: 'employee' },
                { id: 'emp003',   name: 'علیرضا غلامی فرزاد', username: 'farzad',  role: 'employee' },
                { id: 'emp004',   name: 'سید محمد فاضلی',      username: 'fazeli',  role: 'employee' },
                { id: 'doc001',   name: 'دکتر معصومی',          username: 'masoumi', role: 'agent'    },
                { id: 'doc002',   name: 'دکتر ذوقی',            username: 'zoghi',   role: 'agent'    },
                { id: 'agent001', name: 'دکتر فتحی',            username: 'fathi',   role: 'agent'    },
                { id: 'agent002', name: 'دکتر حمیدی',           username: 'sajadi',  role: 'agent'    }
            ];
        }

        // فیلتر بر اساس نقش
        switch (currentUser.role) {
            case 'manager':
                return allUsers.filter(u => u.id !== currentUser.id);
            case 'employee':
                return allUsers.filter(u => u.id !== currentUser.id &&
                    (u.role === 'manager' || u.role === 'employee'));
            case 'agent':
                return allUsers.filter(u => u.role === 'manager');
            default:
                return [];
        }
    },

    // ── بارگذاری پیام‌ها از localStorage ─────────────────────
    loadMessages(otherId) {
        const me = this.getCurrentUser();
        const key = this._chatKey(me.id, otherId);
        try {
            this.messages = JSON.parse(localStorage.getItem(key) || '[]');
        } catch (e) {
            this.messages = [];
        }
        // sync از Supabase در پس‌زمینه
        this._loadFromCloud(me.id, otherId);
    },

    // ── ذخیره پیام‌ها (localStorage + Supabase) ───────────────
    saveMessages(otherId) {
        const me = this.getCurrentUser();
        const key = this._chatKey(me.id, otherId);
        localStorage.setItem(key, JSON.stringify(this.messages));
        // ارسال آخرین پیام به Supabase
        this._syncToCloud(otherId);
    },

    // ── sync به Supabase ──────────────────────────────────────
    _syncToCloud(receiverId) {
        if (!this._isOnline()) return;
        const lastMsg = this.messages[this.messages.length - 1];
        if (!lastMsg) return;
        const sbMsg = {
            id:         String(lastMsg.id),
            senderId:   lastMsg.senderId   || null,
            receiverId: receiverId         || null,
            content:    lastMsg.text || lastMsg.fileName || '[file]',
            isSystem:   false
        };
        SupabaseDataModule.sendMessage(sbMsg)
            .then(() => {})
            .catch(e => console.warn('⚠️ personalChat sync:', e.message));
    },

    // ── بارگذاری از Supabase ──────────────────────────────────
    _loadFromCloud(myId, otherId) {
        if (!this._isOnline()) return;
        SupabaseDataModule.getMessages(myId).then(cloudMsgs => {
            if (!cloudMsgs || !cloudMsgs.length) return;
            const relevant = cloudMsgs.filter(m =>
                (m.senderId === myId    && m.receiverId === otherId) ||
                (m.senderId === otherId && m.receiverId === myId)
            );
            if (!relevant.length) return;

            const key   = this._chatKey(myId, otherId);
            const local = JSON.parse(localStorage.getItem(key) || '[]');
            const ids   = new Set(local.map(m => String(m.id)));

            // برای نام فرستنده از لیست کاربران استفاده می‌کنیم
            const allUsers = this.getAvailableUsers(this.getCurrentUser());

            relevant.forEach(m => {
                if (!ids.has(String(m.id))) {
                    const sender = allUsers.find(u => u.id === m.senderId);
                    local.push({
                        id:         m.id,
                        senderId:   m.senderId,
                        senderName: sender ? sender.name : (m.senderId || ''),
                        text:       m.content || m.text || '',
                        type:       'text',
                        timestamp:  m.createdAt || m.created_at || new Date().toISOString(),
                        read:       !!(m.readAt || m.read_at)
                    });
                }
            });
            local.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            localStorage.setItem(key, JSON.stringify(local));

            if (this.selectedUser && this.selectedUser.id === otherId) {
                this.messages = local;
                this.refreshChatArea(this.getCurrentUser());
                this._scrollToBottom();
            }
        }).catch(e => console.warn('⚠️ personalChat loadCloud:', e.message));
    },

    _isOnline() {
        return typeof SupabaseDataModule !== 'undefined' &&
               typeof SupabaseConnection !== 'undefined' &&
               SupabaseConnection.isOnline;
    },

    // ── تعداد پیام‌های خوانده‌نشده ────────────────────────────
    getUnreadCount(otherId) {
        const me = this.getCurrentUser();
        const key = this._chatKey(me.id, otherId);
        try {
            const msgs = JSON.parse(localStorage.getItem(key) || '[]');
            return msgs.filter(m => !m.read && m.senderId !== me.id).length;
        } catch (e) { return 0; }
    },

    // ── خوانده شدن پیام‌ها ────────────────────────────────────
    markMessagesAsRead(otherId) {
        const me = this.getCurrentUser();
        const key = this._chatKey(me.id, otherId);
        try {
            const msgs = JSON.parse(localStorage.getItem(key) || '[]');
            msgs.forEach(m => { if (m.senderId !== me.id) m.read = true; });
            localStorage.setItem(key, JSON.stringify(msgs));
        } catch (e) {}
    },

    // ── انتخاب کاربر ─────────────────────────────────────────
    selectUser(userId) {
        const me = this.getCurrentUser();
        const users = this.getAvailableUsers(me);
        this.selectedUser = users.find(u => u.id === userId);
        if (!this.selectedUser) return;

        this.loadMessages(userId);
        this.markMessagesAsRead(userId);

        const chatArea = document.getElementById('personalChatArea');
        if (chatArea) {
            chatArea.innerHTML = this.getChatAreaHTML(me);
            this.updateUsersListSelection();
            setTimeout(() => this._scrollToBottom(), 150);
        }

        // polling برای دریافت پیام‌های جدید هر ۵ ثانیه
        this._startPolling(userId);
    },

    _startPolling(otherId) {
        this._stopPolling();
        this._pollTimer = setInterval(() => {
            if (!this.selectedUser || this.selectedUser.id !== otherId) {
                this._stopPolling();
                return;
            }
            const me  = this.getCurrentUser();
            const key = this._chatKey(me.id, otherId);
            try {
                const stored = JSON.parse(localStorage.getItem(key) || '[]');
                if (stored.length !== this.messages.length) {
                    this.messages = stored;
                    this.refreshChatArea(me);
                    this._scrollToBottom();
                }
            } catch (e) {}
            // همچنین از cloud sync کن
            this._loadFromCloud(me.id, otherId);
        }, 5000);
    },

    _stopPolling() {
        if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
    },

    _scrollToBottom() {
        setTimeout(() => {
            const el = document.getElementById('personalChatMessages');
            if (el) el.scrollTop = el.scrollHeight;
        }, 50);
    },

    // ── ارسال پیام متنی ──────────────────────────────────────
    sendMessage() {
        const input = document.getElementById('personalChatInput');
        if (!input) return;
        const text = input.value.trim();
        if (!text || !this.selectedUser) return;

        const me = this.getCurrentUser();
        const msg = {
            id:         Date.now(),
            senderId:   me.id,
            senderName: me.name,
            text:       text,
            type:       'text',
            timestamp:  new Date().toISOString(),
            read:       false
        };

        this.messages.push(msg);
        this.saveMessages(this.selectedUser.id);
        input.value = '';
        input.style.height = 'auto';
        this.refreshChatArea(me);
        this._scrollToBottom();
    },

    // ── ارسال فایل ───────────────────────────────────────────
    attachFile() {
        const input = document.createElement('input');
        input.type   = 'file';
        input.accept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) this.sendFileMessage(file);
        };
        input.click();
    },

    sendFileMessage(file) {
        if (!this.selectedUser) return;
        const me = this.getCurrentUser();
        const reader = new FileReader();
        reader.onloadend = () => {
            const msg = {
                id:         Date.now(),
                senderId:   me.id,
                senderName: me.name,
                fileName:   file.name,
                fileData:   reader.result,
                fileType:   file.type,
                type:       'file',
                timestamp:  new Date().toISOString(),
                read:       false
            };
            this.messages.push(msg);
            this.saveMessages(this.selectedUser.id);
            this.refreshChatArea(me);
            this._scrollToBottom();
        };
        reader.readAsDataURL(file);
    },

    // ── رندر UI ───────────────────────────────────────────────
    getPersonalChatContent() {
        const me = this.getCurrentUser();
        return `
            <div id="personalChatContainer" class="personal-chat-container"
                 style="display:flex;flex-direction:column;height:calc(100vh - 200px);background:#f8fafc;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
                <div style="background:linear-gradient(135deg,#059669 0%,#10b981 100%);padding:20px;color:white;">
                    <h2 style="font-size:1.5rem;font-weight:bold;margin-bottom:8px;">
                        <i class="fas fa-comments" style="margin-left:8px;"></i>گفتگو شخصی
                    </h2>
                    <p style="color:#d1fae5;font-size:0.875rem;">${this.getRoleDescription(me.role)}</p>
                </div>
                <div style="display:flex;flex:1;overflow:hidden;">
                    <div style="width:280px;background:#334155;border-left:1px solid #475569;display:flex;flex-direction:column;">
                        <div style="padding:16px;border-bottom:1px solid #475569;">
                            <h3 style="color:#f1f5f9;font-weight:bold;margin-bottom:12px;">
                                <i class="fas fa-users" style="margin-left:8px;color:#10b981;"></i>انتخاب گفتگو
                            </h3>
                            <input type="text" id="personalChatSearch" placeholder="جستجوی کاربر..."
                                   onkeyup="PersonalChatModule.filterUsers(this.value)"
                                   style="width:100%;background:#1e293b;border:1px solid #475569;border-radius:8px;padding:10px 12px;color:#f1f5f9;font-family:inherit;">
                        </div>
                        <div id="personalChatUsersList" style="flex:1;overflow-y:auto;padding:8px;">
                            ${this.renderUsersList(me)}
                        </div>
                    </div>
                    <div id="personalChatArea" style="flex:1;display:flex;flex-direction:column;overflow:hidden;background:#ffffff;">
                        ${this.selectedUser ? this.getChatAreaHTML(me) : this.getSelectUserPlaceholderHTML()}
                    </div>
                </div>
            </div>
            <style>
                .personal-chat-container #personalChatUsersList::-webkit-scrollbar { width:6px; }
                .personal-chat-container #personalChatUsersList::-webkit-scrollbar-track { background:#1e293b; }
                .personal-chat-container #personalChatUsersList::-webkit-scrollbar-thumb { background:#475569;border-radius:3px; }
                .personal-chat-container #personalChatMessages::-webkit-scrollbar { width:8px; }
                .personal-chat-container #personalChatMessages::-webkit-scrollbar-track { background:#f1f5f9; }
                .personal-chat-container #personalChatMessages::-webkit-scrollbar-thumb { background:#cbd5e1;border-radius:4px; }
                .user-item.selected { background:#059669 !important; }
                .user-item:hover:not(.selected) { background:#475569 !important; }
                @keyframes slideIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
            </style>
            <script>
                setTimeout(() => {
                    if (!window.personalChatInitialized) {
                        PersonalChatModule.init();
                        window.personalChatInitialized = true;
                    }
                }, 100);
            </script>
        `;
    },

    renderUsersList(currentUser) {
        const users = this.getAvailableUsers(currentUser);
        if (!users.length) return `
            <div style="text-align:center;padding:20px;color:#94a3b8;">
                <i class="fas fa-user-slash" style="font-size:2rem;margin-bottom:8px;display:block;"></i>
                <p>کاربری برای گفتگو یافت نشد</p>
            </div>`;
        return users.map(u => this._userItem(u)).join('');
    },

    _userItem(user) {
        const isSelected  = this.selectedUser && this.selectedUser.id === user.id;
        const unread      = this.getUnreadCount(user.id);
        return `
        <div onclick="PersonalChatModule.selectUser('${user.id}')"
             class="user-item ${isSelected ? 'selected' : ''}"
             style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:8px;cursor:pointer;transition:all 0.2s;background:${isSelected ? '#059669' : 'transparent'};">
            <div style="width:40px;height:40px;border-radius:50%;${this.getRoleClass(user.role)}display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;flex-shrink:0;">
                ${(user.name||'?').charAt(0)}
            </div>
            <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;justify-content:space-between;">
                    <p style="color:white;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${user.name}</p>
                    ${unread > 0 ? `<span style="background:#ef4444;color:white;font-size:10px;padding:2px 6px;border-radius:10px;flex-shrink:0;">${unread}</span>` : ''}
                </div>
                <p style="color:#94a3b8;font-size:12px;">${this.getRoleName(user.role)}</p>
            </div>
        </div>`;
    },

    getChatAreaHTML(currentUser) {
        return `
            <div style="padding:16px 20px;border-bottom:1px solid #e2e8f0;background:#f8fafc;display:flex;align-items:center;gap:12px;">
                <div style="width:40px;height:40px;border-radius:50%;${this.getRoleClass(this.selectedUser.role)}display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;">
                    ${(this.selectedUser.name||'?').charAt(0)}
                </div>
                <div>
                    <p style="color:#1e293b;font-weight:600;">${this.selectedUser.name}</p>
                    <p style="color:#64748b;font-size:12px;">${this.getRoleName(this.selectedUser.role)}</p>
                </div>
                <button onclick="PersonalChatModule.closeChat()"
                        style="margin-right:auto;background:transparent;border:none;color:#94a3b8;cursor:pointer;font-size:18px;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div id="personalChatMessages"
                 style="flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:12px;background:#f8fafc;">
                ${this.renderMessages(currentUser)}
            </div>
            <div style="padding:16px 20px;border-top:1px solid #e2e8f0;background:#f1f5f9;">
                <div style="display:flex;gap:12px;align-items:flex-end;">
                    <textarea id="personalChatInput" placeholder="پیام خود را بنویسید..." rows="1"
                        onkeypress="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();PersonalChatModule.sendMessage();}"
                        oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,120)+'px';"
                        style="flex:1;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 16px;color:#333;resize:none;min-height:44px;max-height:120px;font-family:inherit;"></textarea>
                    <div style="display:flex;gap:8px;">
                        <button onclick="PersonalChatModule.attachFile()"
                                style="width:44px;height:44px;border-radius:12px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;background:#8b5cf6;color:white;font-size:18px;"
                                title="پیوست فایل"><i class="fas fa-paperclip"></i></button>
                        <button onclick="PersonalChatModule.sendMessage()"
                                style="width:44px;height:44px;border-radius:12px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;background:#059669;color:white;font-size:18px;"
                                title="ارسال"><i class="fas fa-paper-plane"></i></button>
                    </div>
                </div>
            </div>`;
    },

    renderMessages(currentUser) {
        if (!this.messages.length) return `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;color:#94a3b8;">
                <i class="fas fa-comments" style="font-size:3rem;margin-bottom:12px;"></i>
                <p>هنوز پیامی ارسال نشده است</p>
                <p style="font-size:0.875rem;margin-top:4px;">اولین پیام را ارسال کنید</p>
            </div>`;
        return this.messages.map(msg => {
            const isOwn = msg.senderId === currentUser.id;
            const time  = new Date(msg.timestamp).toLocaleTimeString('fa-IR', { hour:'2-digit', minute:'2-digit' });
            return `
            <div style="display:flex;justify-content:${isOwn ? 'flex-end' : 'flex-start'};animation:slideIn 0.3s ease;">
                <div style="max-width:70%;display:flex;flex-direction:column;align-items:${isOwn ? 'flex-end' : 'flex-start'};">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;font-size:12px;">
                        ${!isOwn ? `<span style="color:#374151;font-weight:600;">${msg.senderName||''}</span>` : ''}
                        <span style="color:#9ca3af;">${time}</span>
                    </div>
                    <div style="border-radius:12px;padding:12px 16px;${isOwn ? 'background:#059669;color:white;' : 'background:#e2e8f0;color:#1e293b;'}">
                        ${this._renderContent(msg)}
                    </div>
                </div>
            </div>`;
        }).join('');
    },

    _renderContent(msg) {
        if (msg.type === 'text')
            return `<p style="white-space:pre-wrap;word-break:break-word;">${msg.text||''}</p>`;
        if (msg.type === 'file')
            return `<div style="display:flex;align-items:center;gap:8px;">
                <i class="fas fa-file" style="font-size:1.5rem;"></i>
                <a href="${msg.fileData||'#'}" download="${msg.fileName||'file'}"
                   style="color:inherit;text-decoration:underline;">${msg.fileName||'فایل'}</a>
                <i class="fas fa-download" style="opacity:0.7;"></i>
            </div>`;
        if (msg.type === 'voice')
            return `<audio controls src="${msg.audioData||''}" style="height:32px;"></audio>`;
        return '';
    },

    getSelectUserPlaceholderHTML() {
        return `<div style="flex:1;display:flex;align-items:center;justify-content:center;color:#94a3b8;">
            <div style="text-align:center;">
                <i class="fas fa-comments" style="font-size:3rem;margin-bottom:16px;display:block;"></i>
                <p style="font-size:1.125rem;">یک کاربر را از لیست انتخاب کنید</p>
            </div>
        </div>`;
    },

    updateUsersListSelection() {
        const me  = this.getCurrentUser();
        const el  = document.getElementById('personalChatUsersList');
        if (el) el.innerHTML = this.renderUsersList(me);
    },

    refreshChatArea(currentUser) {
        const el = document.getElementById('personalChatArea');
        if (el && this.selectedUser) el.innerHTML = this.getChatAreaHTML(currentUser);
    },

    filterUsers(query) {
        const me    = this.getCurrentUser();
        let   users = this.getAvailableUsers(me);
        if (query.trim()) {
            const q = query.toLowerCase();
            users = users.filter(u =>
                (u.name||'').toLowerCase().includes(q) ||
                (u.username||'').toLowerCase().includes(q)
            );
        }
        const el = document.getElementById('personalChatUsersList');
        if (el) el.innerHTML = users.length
            ? users.map(u => this._userItem(u)).join('')
            : `<div style="text-align:center;padding:20px;color:#94a3b8;"><i class="fas fa-search" style="display:block;font-size:2rem;margin-bottom:8px;"></i><p>کاربری یافت نشد</p></div>`;
    },

    closeChat() {
        this._stopPolling();
        this.selectedUser = null;
        const el = document.getElementById('personalChatArea');
        if (el) el.innerHTML = this.getSelectUserPlaceholderHTML();
        this.updateUsersListSelection();
    },

    // ── helpers ───────────────────────────────────────────────
    getRoleDescription(role) {
        return { manager:'همه کارمندها و عامل‌ها', employee:'مدیر و سایر کارمندها', agent:'فقط مدیر' }[role]
            || 'گفتگو شخصی';
    },
    getRoleClass(role) {
        return ({ manager:'background:linear-gradient(135deg,#7c3aed,#a855f7);',
                  employee:'background:linear-gradient(135deg,#3b82f6,#60a5fa);',
                  agent:'background:linear-gradient(135deg,#0891b2,#06b6d4);' }[role])
            || 'background:#6b7280;';
    },
    getRoleName(role) {
        return { manager:'مدیر', employee:'کارمند', agent:'عامل', student:'دانشجو' }[role] || role;
    },

    init() { this.initialized = true; }
};

window.getPersonalChatContent = () => PersonalChatModule.getPersonalChatContent();
