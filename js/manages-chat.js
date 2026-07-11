// مدیریت چت مدیریتی برای کارمند ها
class ManagesChat {
    constructor() {
        this.messages = [];
        this.participants = [];
        this.audioRecorder = null;
        this.isRecording = false;
        this.initialized = false;
        this.contextMenuVisible = false;
        this.selectedMessageId = null;
        this.longPressTimer = null;
        this.searchQuery = '';
        this.init();
    }

    init() {
        // Prevent double initialization
        if (this.initialized) {
            console.log('ManagesChat already initialized, re-rendering messages');
            this.renderMessages();
            return;
        }
        
        this.loadMessages();
        this.loadParticipants();
        this.setupEventListeners();
        this.setupAudioRecorder();
        this.renderMessages();
        this.initialized = true;
        console.log('ManagesChat initialized successfully');
    }

    loadMessages() {
        const saved = localStorage.getItem('managesChat_messages');
        this.messages = saved ? JSON.parse(saved) : [];
    }

    saveMessages() {
        localStorage.setItem('managesChat_messages', JSON.stringify(this.messages));
    }

    loadParticipants() {
        // بارگذاری لیست کارمند ها و مدیر
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        
        // لیست ثابت کارمند ها
        const fixedemployees = [
            { id: 'mgr001', name: 'مدیر سیستم', username: 'manager', role: 'manager' },
            { id: 'emp001', name: 'ساره', username: 'zahra', role: 'employee' },
            { id: 'emp002', name: 'زینب', username: 'fatemeh', role: 'employee' },
            { id: 'emp003', name: 'فرزاد', username: 'farzad', role: 'employee' },
            { id: 'emp004', name: 'حسینی م', username: 'soleiman', role: 'employee' }
        ];
        
        // ترکیب لیست ثابت با کاربران جدید
        const dynamicParticipants = users.filter(u => u.role === 'employee' || u.role === 'manager');
        this.participants = [...fixedemployees];
        
        dynamicParticipants.forEach(user => {
            if (!this.participants.find(p => p.username === user.username)) {
                this.participants.push(user);
            }
        });
    }

    setupEventListeners() {
        // Note: Event listeners are now handled inline in the HTML for better compatibility
        // This method is kept for backward compatibility with standalone page
        const sendBtn = document.getElementById('sendManagesChatBtn');
        const messageInput = document.getElementById('managesChatInput');
        
        // Only add listeners if they don't have onclick attributes (standalone page)
        if (sendBtn && !sendBtn.hasAttribute('onclick')) {
            sendBtn.addEventListener('click', () => this.sendMessage());
        }
        
        if (messageInput && !messageInput.hasAttribute('onkeypress')) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        // ضبط صوت
        const voiceBtn = document.getElementById('recordVoiceBtn');
        if (voiceBtn && !voiceBtn.hasAttribute('onclick')) {
            voiceBtn.addEventListener('click', () => this.toggleVoiceRecording());
        }

        // منشن کردن
        const mentionBtn = document.getElementById('mentionBtn');
        if (mentionBtn && !mentionBtn.hasAttribute('onclick')) {
            mentionBtn.addEventListener('click', () => this.showMentionList());
        }

        // پیوست فایل
        const attachBtn = document.getElementById('attachFileBtn');
        if (attachBtn && !attachBtn.hasAttribute('onclick')) {
            attachBtn.addEventListener('click', () => this.attachFile());
        }
    }

    setupAudioRecorder() {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    this.audioRecorder = new MediaRecorder(stream);
                    this.setupRecorderEvents();
                })
                .catch(err => console.log('خطا در دسترسی به میکروفون:', err));
        }
    }

    setupRecorderEvents() {
        if (!this.audioRecorder) return;

        const audioChunks = [];
        
        this.audioRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        this.audioRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            this.sendVoiceMessage(audioBlob);
            audioChunks.length = 0;
        };
    }

    sendMessage() {
        const input = document.getElementById('managesChatInput');
        const text = input.value.trim();
        
        if (!text) return;

        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        
        const message = {
            id: Date.now(),
            senderId: currentUser.id,
            senderName: currentUser.name,
            senderRole: currentUser.role,
            text: text,
            type: 'text',
            timestamp: new Date().toISOString(),
            mentions: this.extractMentions(text),
            relatedTaskId: this.getRelatedTaskId()
        };

        this.messages.push(message);
        this.saveMessages();
        this.renderMessages();
        
        input.value = '';
        this.notifyMentionedUsers(message);
    }

    sendVoiceMessage(audioBlob) {
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const reader = new FileReader();
        
        reader.onloadend = () => {
            const message = {
                id: Date.now(),
                senderId: currentUser.id,
                senderName: currentUser.name,
                senderRole: currentUser.role,
                audioData: reader.result,
                type: 'voice',
                timestamp: new Date().toISOString(),
                duration: 0
            };

            this.messages.push(message);
            this.saveMessages();
            this.renderMessages();
        };
        
        reader.readAsDataURL(audioBlob);
    }

    toggleVoiceRecording() {
        if (!this.audioRecorder) {
            alert('دسترسی به میکروفون امکان‌پذیر نیست');
            return;
        }

        const btn = document.getElementById('recordVoiceBtn');
        
        if (this.isRecording) {
            this.audioRecorder.stop();
            this.isRecording = false;
            btn.innerHTML = '<i class="fas fa-microphone"></i>';
            btn.classList.remove('recording');
        } else {
            this.audioRecorder.start();
            this.isRecording = true;
            btn.innerHTML = '<i class="fas fa-stop"></i>';
            btn.classList.add('recording');
        }
    }

    extractMentions(text) {
        const mentionRegex = /@(\w+)/g;
        const mentions = [];
        let match;
        
        while ((match = mentionRegex.exec(text)) !== null) {
            mentions.push(match[1]);
        }
        
        return mentions;
    }

    showMentionList() {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-slate-800 rounded-2xl p-6 max-w-md w-11/12 max-h-[80vh] overflow-y-auto">
                <h3 class="text-xl font-bold text-white mb-4">
                    <i class="fas fa-at text-yellow-400 ml-2"></i>
                    انتخاب کاربر برای منشن
                </h3>
                <div class="space-y-2 mb-4">
                    ${this.participants.map(p => `
                        <div class="flex items-center gap-3 p-3 bg-slate-700 hover:bg-slate-600 rounded-lg cursor-pointer transition-all hover:translate-x-[-4px]" 
                             data-username="${p.username}"
                             onclick="document.getElementById('managesChatInput').value += '@${p.username} '; document.getElementById('managesChatInput').focus(); this.closest('.fixed').remove();">
                            <div class="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center text-gray-900 font-bold">
                                ${p.name.charAt(0)}
                            </div>
                            <div class="flex-1">
                                <p class="text-white font-medium">${p.name}</p>
                                <p class="text-gray-400 text-sm">@${p.username}</p>
                            </div>
                            <span class="px-2 py-1 rounded-full text-xs font-semibold ${p.role === 'manager' ? 'bg-yellow-600 text-gray-900' : 'bg-blue-600 text-white'}">
                                ${this.getRoleName(p.role)}
                            </span>
                        </div>
                    `).join('')}
                </div>
                <button onclick="this.closest('.fixed').remove()" 
                        class="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
                    بستن
                </button>
            </div>
        `;

        document.body.appendChild(modal);
    }

    attachFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,.pdf,.doc,.docx';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                this.sendFileMessage(file);
            }
        };
        
        input.click();
    }

    sendFileMessage(file) {
        const reader = new FileReader();
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        
        reader.onloadend = () => {
            const message = {
                id: Date.now(),
                senderId: currentUser.id,
                senderName: currentUser.name,
                senderRole: currentUser.role,
                fileName: file.name,
                fileData: reader.result,
                fileType: file.type,
                type: 'file',
                timestamp: new Date().toISOString()
            };

            this.messages.push(message);
            this.saveMessages();
            this.renderMessages();
        };
        
        reader.readAsDataURL(file);
    }

    renderMessages() {
        const container = document.getElementById('managesChatMessages');
        if (!container) {
            console.warn('managesChatMessages container not found');
            return;
        }

        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        
        // Filter messages by search query
        let displayMessages = this.messages;
        if (this.searchQuery.trim()) {
            displayMessages = this.messages.filter(msg => 
                (msg.text && msg.text.toLowerCase().includes(this.searchQuery.toLowerCase())) ||
                (msg.senderName && msg.senderName.toLowerCase().includes(this.searchQuery.toLowerCase())) ||
                (msg.fileName && msg.fileName.toLowerCase().includes(this.searchQuery.toLowerCase()))
            );
        }
        
        if (displayMessages.length === 0) {
            container.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center;">
                    <i class="fas fa-comments" style="font-size: 4rem; color: #4b5563; margin-bottom: 1rem;"></i>
                    <p style="color: #9ca3af; font-size: 1.125rem;">${this.searchQuery ? 'پیامی یافت نشد' : 'هنوز پیامی ارسال نشده است'}</p>
                    <p style="color: #6b7280; font-size: 0.875rem; margin-top: 0.5rem;">${this.searchQuery ? 'جستجوی دیگری امتحان کنید' : 'اولین پیام را ارسال کنید'}</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = displayMessages.map(msg => {
            const isOwn = msg.senderId === currentUser.id;
            const time = new Date(msg.timestamp).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
            const date = new Date(msg.timestamp).toLocaleDateString('fa-IR');
            
            return `
                <div style="display: flex; justify-content: flex-start; margin-bottom: 1rem; animation: slideIn 0.3s ease; direction: rtl;" class="message-group">
                    <div style="max-width: 70%; display: flex; flex-direction: column; align-items: flex-start;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; font-size: 0.75rem;">
                            <span style="font-weight: 600; color: #8b9dbbff;">${msg.senderName}</span>
                            <span style="padding: 0.125rem 0.5rem; border-radius: 9999px; font-size: 0.625rem; font-weight: 600; ${msg.senderRole === 'manager' ? 'background: #b1a1ceff; color: white;' : 'background: #3b82f6; color: white;'}">
                                ${this.getRoleName(msg.senderRole)}
                            </span>
                            <span style="color: #364157ff;">${time}</span>
                            <span style="color: #95a8c4ff; font-size: 0.625rem;">${date}</span>
                        </div>
                        <div style="position: relative; border-radius: 0.75rem; padding: 0.75rem 1rem; ${isOwn ? 'background: #8e8fccff; color: white;' : 'background: #e2e8f0; color: #03070eff;'}"
                             oncontextmenu="event.preventDefault(); if(window.managesChatInstance) window.managesChatInstance.showContextMenu(event, '${msg.id}'); return false;"
                             ontouchstart="if(window.managesChatInstance) window.managesChatInstance.handleLongPressStart(event, '${msg.id}')"
                             ontouchend="if(window.managesChatInstance) window.managesChatInstance.handleLongPressEnd()"
                             ontouchmove="if(window.managesChatInstance) window.managesChatInstance.handleLongPressEnd()">
                            ${this.renderMessageContent(msg)}
                        </div>
                        ${msg.relatedTaskId ? `<div style="margin-top: 0.25rem; font-size: 0.75rem; color: #9ca3af; background: #334155; padding: 0.25rem 0.5rem; border-radius: 0.25rem;">مرتبط با وظیفه #${msg.relatedTaskId}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            .message-group:hover .delete-btn {
                opacity: 1 !important;
            }
            .delete-btn:hover {
                background: #dc2626 !important;
            }
        `;
        if (!document.getElementById('chat-animation-style')) {
            style.id = 'chat-animation-style';
            document.head.appendChild(style);
        }

        // Scroll to bottom
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 50);
    }

    deleteMessage(messageId) {
        if (!confirm('آیا مطمئن هستید که می‌خواهید این پیام را حذف کنید؟')) {
            return;
        }
        
        this.messages = this.messages.filter(msg => msg.id != messageId);
        this.saveMessages();
        this.renderMessages();
    }

    renderMessageContent(msg) {
        switch (msg.type) {
            case 'text':
                return `<p class="whitespace-pre-wrap break-words">${this.highlightMentions(msg.text)}</p>`;
            case 'voice':
                return `
                    <div class="flex items-center gap-3 min-w-[250px]">
                        <audio controls src="${msg.audioData}" class="w-full" style="height: 32px;">
                            مرورگر شما از پخش صوت پشتیبانی نمی‌کند
                        </audio>
                    </div>
                `;
            case 'file':
                return `
                    <div class="flex items-center gap-3 bg-slate-700 bg-opacity-50 rounded-lg p-2">
                        <i class="fas fa-file text-2xl text-blue-400"></i>
                        <div class="flex-1">
                            <a href="${msg.fileData}" download="${msg.fileName}" class="text-blue-300 hover:text-blue-200 hover:underline">
                                ${msg.fileName}
                            </a>
                        </div>
                        <i class="fas fa-download text-gray-400"></i>
                    </div>
                `;
            default:
                return '';
        }
    }

    highlightMentions(text) {
        return text.replace(/@(\w+)/g, '<span class="bg-yellow-400 text-slate-900 px-1.5 py-0.5 rounded font-semibold">@$1</span>');
    }

    getRoleName(role) {
        const roles = {
            'manager': 'مدیر',
            'employee': 'کارمند'
        };
        return roles[role] || role;
    }

    getRelatedTaskId() {
        // اگر از صفحه وظایف آمده، شناسه وظیفه را برمی‌گرداند
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('taskId');
    }

    notifyMentionedUsers(message) {
        if (message.mentions.length === 0) return;

        message.mentions.forEach(username => {
            const user = this.participants.find(p => p.username === username);
            if (user) {
                // ارسال نوتیفیکیشن
                this.sendNotification(user.id, {
                    type: 'mention',
                    message: `${message.senderName} شما را در چت مدیریتی منشن کرد`,
                    messageId: message.id
                });
            }
        });
    }

    sendNotification(userId, notification) {
        const notifications = JSON.parse(localStorage.getItem(`notifications_${userId}`) || '[]');
        notifications.push({
            ...notification,
            id: Date.now(),
            timestamp: new Date().toISOString(),
            read: false
        });
        localStorage.setItem(`notifications_${userId}`, JSON.stringify(notifications));
    }

    filterMessagesByTask(taskId) {
        return this.messages.filter(msg => msg.relatedTaskId === taskId);
    }

    searchMessages(query) {
        return this.messages.filter(msg => 
            msg.text && msg.text.toLowerCase().includes(query.toLowerCase())
        );
    }
    
    // Context Menu Functions
    handleLongPressStart(event, messageId) {
        this.longPressTimer = setTimeout(() => {
            this.showContextMenu(event, messageId);
        }, 3000); // 3 seconds
    }
    
    handleLongPressEnd() {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    }
    
    showContextMenu(event, messageId) {
        // Remove existing context menu
        const existing = document.getElementById('message-context-menu');
        if (existing) existing.remove();
        
        this.selectedMessageId = messageId;
        const message = this.messages.find(m => m.id == messageId);
        if (!message) return;
        
        const menu = document.createElement('div');
        menu.id = 'message-context-menu';
        menu.className = 'fixed bg-slate-800 rounded-lg shadow-2xl border border-slate-600 z-[9999] min-w-[200px]';
        menu.style.left = event.pageX + 'px';
        menu.style.top = event.pageY + 'px';
        
        menu.innerHTML = `
            <div class="py-2">
                <button onclick="window.managesChatInstance.editMessage('${messageId}')" 
                        class="w-full text-right px-4 py-2 hover:bg-slate-700 text-white flex items-center gap-3">
                    <i class="fas fa-edit text-blue-400"></i>
                    <span>ویرایش</span>
                </button>
                <button onclick="window.managesChatInstance.deleteMessage('${messageId}')" 
                        class="w-full text-right px-4 py-2 hover:bg-slate-700 text-white flex items-center gap-3">
                    <i class="fas fa-trash text-red-400"></i>
                    <span>حذف</span>
                </button>
                ${message.type === 'file' || message.type === 'voice' ? `
                    <button onclick="window.managesChatInstance.saveToArchive('${messageId}')" 
                            class="w-full text-right px-4 py-2 hover:bg-slate-700 text-white flex items-center gap-3">
                        <i class="fas fa-save text-green-400"></i>
                        <span>ذخیره در بایگانی</span>
                    </button>
                    <button onclick="window.managesChatInstance.forwardFile('${messageId}')" 
                            class="w-full text-right px-4 py-2 hover:bg-slate-700 text-white flex items-center gap-3">
                        <i class="fas fa-share text-yellow-400"></i>
                        <span>فوروارد</span>
                    </button>
                    <button onclick="window.managesChatInstance.shareToApp('${messageId}')" 
                            class="w-full text-right px-4 py-2 hover:bg-slate-700 text-white flex items-center gap-3">
                        <i class="fas fa-share-alt text-yellow-400"></i>
                        <span>اشتراک‌گذاری</span>
                    </button>
                ` : ''}
            </div>
        `;
        
        document.body.appendChild(menu);
        
        // Close menu on click outside
        setTimeout(() => {
            document.addEventListener('click', function closeMenu(e) {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            });
        }, 100);
    }
    
    editMessage(messageId) {
        const message = this.messages.find(m => m.id == messageId);
        if (!message || message.type !== 'text') {
            alert('فقط پیام‌های متنی قابل ویرایش هستند');
            return;
        }
        
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[9999]';
        modal.innerHTML = `
            <div class="bg-slate-800 rounded-2xl p-6 max-w-md w-11/12">
                <h3 class="text-xl font-bold text-white mb-4">
                    <i class="fas fa-edit text-blue-400 ml-2"></i>
                    ویرایش پیام
                </h3>
                <textarea id="edit-message-text" 
                          class="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white resize-none"
                          rows="4">${message.text}</textarea>
                <div class="flex gap-3 mt-4">
                    <button onclick="window.managesChatInstance.saveEditedMessage('${messageId}'); this.closest('.fixed').remove();" 
                            class="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                        ذخیره
                    </button>
                    <button onclick="this.closest('.fixed').remove()" 
                            class="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg">
                        انصراف
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        document.getElementById('edit-message-text').focus();
        
        // Remove context menu
        const contextMenu = document.getElementById('message-context-menu');
        if (contextMenu) contextMenu.remove();
    }
    
    saveEditedMessage(messageId) {
        const newText = document.getElementById('edit-message-text').value.trim();
        if (!newText) {
            alert('متن پیام نمی‌تواند خالی باشد');
            return;
        }
        
        const messageIndex = this.messages.findIndex(m => m.id == messageId);
        if (messageIndex !== -1) {
            this.messages[messageIndex].text = newText;
            this.messages[messageIndex].edited = true;
            this.messages[messageIndex].editedAt = new Date().toISOString();
            this.saveMessages();
            this.renderMessages();
        }
    }
    
    saveToArchive(messageId) {
        const message = this.messages.find(m => m.id == messageId);
        if (!message || (message.type !== 'file' && message.type !== 'voice')) {
            alert('فقط فایل‌ها و پیام‌های صوتی قابل ذخیره هستند');
            return;
        }
        
        // Show category selection modal
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[9999]';
        modal.innerHTML = `
            <div class="bg-slate-800 rounded-2xl p-6 max-w-md w-11/12">
                <h3 class="text-xl font-bold text-white mb-4">
                    <i class="fas fa-save text-green-400 ml-2"></i>
                    ذخیره در بایگانی
                </h3>
                <div class="mb-4">
                    <label class="block text-white text-sm font-medium mb-2">دسته‌بندی</label>
                    <select id="archive-category" class="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white">
                        <option value="form1">استمارة 1</option>
                        <option value="form2">استمارة 2</option>
                        <option value="correspondence">همانندجویی‌ها</option>
                        <option value="administrative">امر اداری‌ها</option>
                        <option value="thesis-original">رساله - فایل اولیه</option>
                        <option value="thesis-edited">رساله - تعدیل شده</option>
                        <option value="thesis-pre-defense">رساله - فایل منضده قبل مناقشه</option>
                        <option value="thesis-pre-defense-edit">رساله - تعدیل قبل مناقشه</option>
                        <option value="thesis-post-defense-edit">رساله - تعدیل بعد مناقشه</option>
                        <option value="thesis-iraqi-citation">رساله - استلال عراقی</option>
                        <option value="thesis-irandoc">رساله - تنضید ایران داک</option>
                        <option value="articles">مقاله‌ها</option>
                        <option value="binding">تجلید</option>
                        <option value="document">مدرک</option>
                        <option value="translation">ترجمه</option>
                        <option value="other">سایر</option>
                    </select>
                </div>
                <div class="flex gap-3">
                    <button onclick="window.managesChatInstance.confirmSaveToArchive('${messageId}'); this.closest('.fixed').remove();" 
                            class="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg">
                        ذخیره
                    </button>
                    <button onclick="this.closest('.fixed').remove()" 
                            class="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg">
                        انصراف
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Remove context menu
        const contextMenu = document.getElementById('message-context-menu');
        if (contextMenu) contextMenu.remove();
    }
    
    confirmSaveToArchive(messageId) {
        const message = this.messages.find(m => m.id == messageId);
        const category = document.getElementById('archive-category').value;
        
        if (!message) return;
        
        // Get archive files from localStorage
        let archiveFiles = JSON.parse(localStorage.getItem('archive_files') || '[]');
        
        const archiveFile = {
            id: Date.now(),
            name: message.fileName || `voice-${Date.now()}.webm`,
            type: message.type === 'voice' ? 'audio' : message.fileType,
            category: category,
            author: message.senderName,
            uploadDate: new Date().toISOString(),
            data: message.fileData || message.audioData,
            source: 'management_chat',
            sourceMessageId: message.id
        };
        
        archiveFiles.push(archiveFile);
        localStorage.setItem('archive_files', JSON.stringify(archiveFiles));
        
        alert('فایل با موفقیت در بایگانی ذخیره شد');
    }
    
    forwardFile(messageId) {
        const message = this.messages.find(m => m.id == messageId);
        if (!message) return;
        
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[9999]';
        modal.innerHTML = `
            <div class="bg-slate-800 rounded-2xl p-6 max-w-md w-11/12">
                <h3 class="text-xl font-bold text-white mb-4">
                    <i class="fas fa-share text-yellow-400 ml-2"></i>
                    فوروارد به
                </h3>
                <div class="space-y-2 mb-4">
                    <button onclick="window.managesChatInstance.forwardToArchive('${messageId}'); this.closest('.fixed').remove();" 
                            class="w-full text-right px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center gap-3">
                        <i class="fas fa-archive text-green-400"></i>
                        <span>بایگانی فایل‌ها</span>
                    </button>
                    <button onclick="window.managesChatInstance.forwardToChat('${messageId}'); this.closest('.fixed').remove();" 
                            class="w-full text-right px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center gap-3">
                        <i class="fas fa-comments text-blue-400"></i>
                        <span>گفتگوی شخصی</span>
                    </button>
                </div>
                <button onclick="this.closest('.fixed').remove()" 
                        class="w-full bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg">
                    انصراف
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Remove context menu
        const contextMenu = document.getElementById('message-context-menu');
        if (contextMenu) contextMenu.remove();
    }
    
    forwardToArchive(messageId) {
        this.saveToArchive(messageId);
    }
    
    forwardToChat(messageId) {
        alert('فوروارد به گفتگوی شخصی در نسخه بعدی اضافه خواهد شد');
    }
    
    shareToApp(messageId) {
        const message = this.messages.find(m => m.id == messageId);
        if (!message) return;
        
        const fileData = message.fileData || message.audioData;
        const fileName = message.fileName || `voice-${Date.now()}.webm`;
        
        // Check if Web Share API is available
        if (navigator.share) {
            // Convert base64 to blob
            fetch(fileData)
                .then(res => res.blob())
                .then(blob => {
                    const file = new File([blob], fileName, { type: blob.type });
                    
                    navigator.share({
                        title: 'اشتراک‌گذاری فایل',
                        text: `فایل از گفتگو مدیریت: ${fileName}`,
                        files: [file]
                    })
                    .then(() => console.log('Share successful'))
                    .catch(err => console.log('Share failed:', err));
                })
                .catch(err => {
                    console.error('Error converting file:', err);
                    this.fallbackShare(fileData, fileName);
                });
        } else {
            this.fallbackShare(fileData, fileName);
        }
        
        // Remove context menu
        const contextMenu = document.getElementById('message-context-menu');
        if (contextMenu) contextMenu.remove();
    }
    
    fallbackShare(fileData, fileName) {
        // Fallback: Download file
        const link = document.createElement('a');
        link.href = fileData;
        link.download = fileName;
        link.click();
        
        alert('فایل دانلود شد. می‌توانید آن را در اپلیکیشن‌های دیگر به اشتراک بگذارید.');
    }
    
    // Search functionality
    setSearchQuery(query) {
        this.searchQuery = query;
        this.renderMessages();
    }
}

// راه‌اندازی
let managesChatInstance;

// Initialize on DOMContentLoaded for standalone page
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('managesChatMessages') && !window.managesChatInstance) {
        window.managesChatInstance = new ManagesChat();
        console.log('ManagesChat initialized on DOMContentLoaded');
    }
});

// Also expose as global for sidebar usage
if (typeof window !== 'undefined') {
    window.ManagesChat = ManagesChat;
}
