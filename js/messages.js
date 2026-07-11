// Messages Module - ماژول پیام‌ها
const MessagesModule = {
    currentUser: null,
    currentConversation: null,
    mediaRecorder: null,
    audioChunks: [],
    recordingStartTime: null,
    recordingInterval: null,
    attachedFile: null,
    
    // Initialize module
    init() {
        this.currentUser = this.getCurrentUser();
        if (!this.currentUser) {
            // Redirect to test page if no user is logged in
            if (confirm('شما وارد سیستم نشده‌اید. آیا می‌خواهید به صفحه ورود بروید؟')) {
                window.location.href = 'messages-test.html';
            } else {
                window.location.href = 'index.html';
            }
            return;
        }
        
        // Show current user badge
        this.showCurrentUserBadge();
        
        this.loadConversations();
        this.setupSearchListener();
    },
    
    // Show current user badge
    showCurrentUserBadge() {
        const roleNames = {
            'manager': 'مدیر',
            'employee': 'کارمند',
            'agent': 'عامل',
            'student': 'دانشجو'
        };
        
        const badge = document.getElementById('current-user-badge');
        if (badge) {
            badge.innerHTML = `
                <i class="fas fa-user ml-1"></i>
                ${this.currentUser.name} (${roleNames[this.currentUser.role]})
            `;
        }
    },
    
    // Get current user from localStorage
    getCurrentUser() {
        // Try different storage keys
        let userStr = localStorage.getItem('currentUser');
        if (!userStr) {
            userStr = localStorage.getItem(CONFIG.STORAGE_KEYS.CURRENT_USER);
        }
        if (!userStr) {
            userStr = localStorage.getItem('edu_system_current_user');
        }
        
        return userStr ? JSON.parse(userStr) : null;
    },
    
    // Get all users for conversations
    getAllUsers() {
        // Use DataModule to get users
        const users = DataModule.getUsers();
        
        // Filter based on current user role
        if (this.currentUser.role === 'employee') {
            // employee can chat with: manager, other employees, and agents
            return users.filter(u => 
                u.id !== this.currentUser.id && 
                ['manager', 'employee', 'agent'].includes(u.role)
            );
        }
        
        // For other roles, show all users except themselves
        return users.filter(u => u.id !== this.currentUser.id);
    },
    
    // Load conversations list
    loadConversations() {
        const users = this.getAllUsers();
        const conversationsHTML = users.map(user => this.getConversationItem(user)).join('');
        document.getElementById('conversations-list').innerHTML = conversationsHTML;
    },
    
    // Get conversation item HTML
    getConversationItem(user) {
        const messages = this.getConversationMessages(user.id);
        const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
        const unreadCount = this.getUnreadCount(user.id);
        
        const roleIcons = {
            'manager': 'fa-user-tie',
            'employee': 'fa-user-cog',
            'agent': 'fa-user-shield',
            'student': 'fa-user-graduate'
        };
        
        const roleColors = {
            'manager': 'bg-yellow-500',
            'employee': 'bg-yellow-500',
            'agent': 'bg-blue-500',
            'student': 'bg-green-500'
        };
        
        const roleNames = {
            'manager': 'مدیر',
            'employee': 'کارمند',
            'agent': 'عامل',
            'student': 'دانشجو'
        };
        
        // For demo, mark all users as online
        const isOnline = true;
        
        return `
            <div class="conversation-item p-4 hover:bg-slate-700 cursor-pointer border-b border-slate-700 transition-all ${this.currentConversation === user.id ? 'bg-slate-700' : ''}"
                 onclick="MessagesModule.openConversation('${user.id}')">
                <div class="flex items-start space-x-3 space-x-reverse">
                    <div class="relative flex-shrink-0">
                        <div class="w-12 h-12 rounded-full ${roleColors[user.role]} flex items-center justify-center text-white font-bold">
                            <i class="fas ${roleIcons[user.role]}"></i>
                        </div>
                        ${isOnline ? '<span class="absolute bottom-0 left-0 w-3 h-3 bg-green-500 border-2 border-slate-800 rounded-full"></span>' : ''}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between mb-1">
                            <h4 class="font-bold text-white truncate">${user.name}</h4>
                            ${lastMessage ? `<span class="text-xs text-gray-400">${this.formatTime(lastMessage.timestamp)}</span>` : ''}
                        </div>
                        <div class="flex items-center justify-between">
                            <p class="text-sm text-gray-400 truncate">
                                ${lastMessage ? this.getLastMessagePreview(lastMessage) : 'هنوز پیامی ارسال نشده'}
                            </p>
                            ${unreadCount > 0 ? `
                                <span class="bg-yellow-500 text-gray-900 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                    ${unreadCount}
                                </span>
                            ` : ''}
                        </div>
                        <span class="text-xs text-gray-500">${roleNames[user.role]}</span>
                    </div>
                </div>
            </div>
        `;
    },
    
    // Get last message preview
    getLastMessagePreview(message) {
        if (message.type === 'voice') {
            return '<i class="fas fa-microphone ml-1"></i>پیام صوتی';
        } else if (message.type === 'file') {
            return `<i class="fas fa-paperclip ml-1"></i>${message.fileName}`;
        } else {
            return message.text || '';
        }
    },
    
    // Open conversation
    openConversation(userId) {
        this.currentConversation = userId;
        const user = this.getAllUsers().find(u => u.id === userId);
        
        if (!user) return;
        
        // Update header
        this.updateChatHeader(user);
        
        // Load messages
        this.loadMessages(userId);
        
        // Show input area
        document.getElementById('message-input-area').style.display = 'block';
        
        // Mark as read
        this.markAsRead(userId);
        
        // Update conversation list
        this.loadConversations();
    },
    
    // Update chat header
    updateChatHeader(user) {
        const roleNames = {
            'manager': 'مدیر',
            'employee': 'کارمند',
            'agent': 'عامل',
            'student': 'دانشجو'
        };
        
        const roleColors = {
            'manager': 'bg-yellow-500',
            'employee': 'bg-yellow-500',
            'agent': 'bg-blue-500',
            'student': 'bg-green-500'
        };
        
        const roleIcons = {
            'manager': 'fa-user-tie',
            'employee': 'fa-user-cog',
            'agent': 'fa-user-shield',
            'student': 'fa-user-graduate'
        };
        
        document.getElementById('chat-header').innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3 space-x-reverse">
                    <div class="relative">
                        <div class="w-12 h-12 rounded-full ${roleColors[user.role]} flex items-center justify-center text-white font-bold">
                            <i class="fas ${roleIcons[user.role]}"></i>
                        </div>
                        ${user.online ? '<span class="absolute bottom-0 left-0 w-3 h-3 bg-green-500 border-2 border-slate-800 rounded-full"></span>' : ''}
                    </div>
                    <div>
                        <h3 class="font-bold text-white">${user.name}</h3>
                        <p class="text-sm text-gray-400">${roleNames[user.role]}</p>
                    </div>
                </div>
                <div class="flex space-x-2 space-x-reverse">
                    <button class="text-gray-400 hover:text-white p-2" title="جستجو">
                        <i class="fas fa-search"></i>
                    </button>
                    <button class="text-gray-400 hover:text-white p-2" title="تنظیمات">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                </div>
            </div>
        `;
    },
    
    // Load messages
    loadMessages(userId) {
        const messages = this.getConversationMessages(userId);
        const messagesHTML = messages.map(msg => this.getMessageHTML(msg)).join('');
        
        document.getElementById('messages-area').innerHTML = messagesHTML || `
            <div class="text-center py-8">
                <i class="fas fa-comments text-4xl text-gray-500 mb-4"></i>
                <p class="text-gray-400">هنوز پیامی ارسال نشده است</p>
            </div>
        `;
        
        // Scroll to bottom
        this.scrollToBottom();
    },
    
    // Get message HTML
    getMessageHTML(message) {
        const isMe = message.senderId === this.currentUser.id;
        const alignment = isMe ? 'justify-end' : 'justify-start';
        const bgColor = isMe ? 'bg-yellow-600' : 'bg-slate-700';
        
        let contentHTML = '';
        
        // Text message
        if (message.type === 'text') {
            contentHTML = `<p class="text-white">${message.text}</p>`;
        }
        // Voice message
        else if (message.type === 'voice') {
            contentHTML = `
                <div class="flex items-center space-x-3 space-x-reverse">
                    <button onclick="MessagesModule.playVoiceMessage('${message.id}')" 
                            class="w-10 h-10 rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 flex items-center justify-center"
                            id="play-btn-${message.id}">
                        <i class="fas fa-play text-white" id="play-icon-${message.id}"></i>
                    </button>
                    <div class="flex-1 min-w-[200px]">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-xs text-white opacity-80">پیام صوتی</span>
                            <span class="text-xs text-white opacity-80">${message.duration || '0:00'}</span>
                        </div>
                        <div class="w-full bg-white bg-opacity-20 rounded-full h-1">
                            <div class="bg-white h-1 rounded-full transition-all" style="width: 0%" id="progress-${message.id}"></div>
                        </div>
                    </div>
                    <audio id="audio-${message.id}" src="${message.voiceUrl}" class="hidden"></audio>
                </div>
            `;
        }
        // File message
        else if (message.type === 'file') {
            const fileIcon = this.getFileIcon(message.fileName);
            contentHTML = `
                <div class="flex items-center space-x-3 space-x-reverse">
                    <div class="w-12 h-12 rounded-lg bg-white bg-opacity-20 flex items-center justify-center">
                        <i class="fas ${fileIcon} text-white text-xl"></i>
                    </div>
                    <div class="flex-1">
                        <p class="text-white font-medium">${message.fileName}</p>
                        <p class="text-xs text-white opacity-70">${this.formatFileSize(message.fileSize)}</p>
                    </div>
                    <button onclick="MessagesModule.downloadFile('${message.id}')" 
                            class="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg">
                        <i class="fas fa-download"></i>
                    </button>
                </div>
            `;
        }
        
        return `
            <div class="flex ${alignment} mb-4">
                <div class="max-w-md ${bgColor} rounded-lg p-3 shadow-lg">
                    ${contentHTML}
                    <div class="flex items-center justify-between mt-2 text-xs ${isMe ? 'text-yellow-200' : 'text-gray-400'}">
                        <span>${this.formatTime(message.timestamp)}</span>
                        ${isMe ? `<i class="fas fa-check-double mr-2 ${message.read ? 'text-blue-300' : ''}"></i>` : ''}
                    </div>
                </div>
            </div>
        `;
    },
    
    // Send message
    async sendMessage() {
        const input = document.getElementById('message-input');
        const text = input.value.trim();
        
        if (!text && !this.attachedFile) return;
        if (!this.currentConversation) return;
        
        const message = {
            senderId: this.currentUser.id,
            receiverId: this.currentConversation,
            timestamp: new Date().toISOString(),
            read: false
        };
        
        // Handle file attachment
        if (this.attachedFile) {
            message.type = 'file';
            message.fileName = this.attachedFile.name;
            message.fileSize = this.attachedFile.size;
            message.fileUrl = this.attachedFile.url;
            message.text = text || '';
        } else {
            message.type = 'text';
            message.text = text;
        }
        
        // Try backend first
        if (window.APIOrdersModule) {
            try {
                const messageData = {
                    content: message.text,
                    message_type: 'direct',
                    recipient: this.currentConversation
                };
                
                const result = await APIOrdersModule.sendMessage(messageData);
                if (result) {
                    UTILS.showNotification('پیام با موفقیت ارسال شد', 'success');
                    input.value = '';
                    this.attachedFile = null;
                    document.getElementById('attachment-preview').style.display = 'none';
                    this.loadMessages(this.currentConversation);
                    this.loadConversations();
                    return;
                }
            } catch (error) {
                console.warn('Backend send failed, using localStorage:', error);
            }
        }
        
        // Fallback to localStorage
        message.id = this.generateId();
        this.saveMessage(message);
        
        // Clear input
        input.value = '';
        this.attachedFile = null;
        document.getElementById('attachment-preview').style.display = 'none';
        
        // Reload messages
        this.loadMessages(this.currentConversation);
        this.loadConversations();
        
        UTILS.showNotification('پیام در حافظه محلی ذخیره شد', 'success');
    },
    
    // Toggle voice recording
    toggleVoiceRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    },
    
    // Start voice recording
    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };
            
            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                const audioUrl = URL.createObjectURL(audioBlob);
                this.sendVoiceMessage(audioUrl);
                
                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
            };
            
            this.mediaRecorder.start();
            this.recordingStartTime = Date.now();
            
            // Show recording UI
            document.getElementById('voice-recording-ui').style.display = 'block';
            document.getElementById('voice-btn').classList.add('bg-red-500', 'text-white');
            
            // Start timer
            this.recordingInterval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;
                document.getElementById('recording-timer').textContent = 
                    `${minutes}:${seconds.toString().padStart(2, '0')}`;
            }, 1000);
            
        } catch (error) {
            console.error('Error accessing microphone:', error);
            UTILS.showNotification('دسترسی به میکروفون امکان‌پذیر نیست', 'error');
        }
    },
    
    // Stop recording
    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
            this.cleanupRecording();
        }
    },
    
    // Cancel recording
    cancelRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
            this.audioChunks = [];
        }
        this.cleanupRecording();
        UTILS.showNotification('ضبط صدا لغو شد', 'info');
    },
    
    // Cleanup recording UI
    cleanupRecording() {
        document.getElementById('voice-recording-ui').style.display = 'none';
        document.getElementById('voice-btn').classList.remove('bg-red-500', 'text-white');
        
        if (this.recordingInterval) {
            clearInterval(this.recordingInterval);
            this.recordingInterval = null;
        }
    },
    
    // Send voice message
    sendVoiceMessage(audioUrl) {
        if (!this.currentConversation) return;
        
        const duration = Math.floor((Date.now() - this.recordingStartTime) / 1000);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        
        const message = {
            id: this.generateId(),
            type: 'voice',
            senderId: this.currentUser.id,
            receiverId: this.currentConversation,
            voiceUrl: audioUrl,
            duration: `${minutes}:${seconds.toString().padStart(2, '0')}`,
            timestamp: new Date().toISOString(),
            read: false
        };
        
        this.saveMessage(message);
        this.loadMessages(this.currentConversation);
        this.loadConversations();
        
        UTILS.showNotification('پیام صوتی ارسال شد', 'success');
    },
    
    // Play voice message
    playVoiceMessage(messageId) {
        const audio = document.getElementById(`audio-${messageId}`);
        const playBtn = document.getElementById(`play-btn-${messageId}`);
        const playIcon = document.getElementById(`play-icon-${messageId}`);
        const progress = document.getElementById(`progress-${messageId}`);
        
        if (audio.paused) {
            // Pause all other audios
            document.querySelectorAll('audio').forEach(a => {
                if (a.id !== `audio-${messageId}`) {
                    a.pause();
                    a.currentTime = 0;
                }
            });
            
            audio.play();
            playIcon.classList.remove('fa-play');
            playIcon.classList.add('fa-pause');
            
            audio.ontimeupdate = () => {
                const percent = (audio.currentTime / audio.duration) * 100;
                progress.style.width = percent + '%';
            };
            
            audio.onended = () => {
                playIcon.classList.remove('fa-pause');
                playIcon.classList.add('fa-play');
                progress.style.width = '0%';
            };
        } else {
            audio.pause();
            playIcon.classList.remove('fa-pause');
            playIcon.classList.add('fa-play');
        }
    },
    
    // Handle file select
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Check file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            UTILS.showNotification('حجم فایل نباید بیشتر از 10 مگابایت باشد', 'error');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            this.attachedFile = {
                name: file.name,
                size: file.size,
                type: file.type,
                url: e.target.result
            };
            
            this.showAttachmentPreview();
        };
        reader.readAsDataURL(file);
    },
    
    // Show attachment preview
    showAttachmentPreview() {
        const preview = document.getElementById('attachment-preview');
        const fileIcon = this.getFileIcon(this.attachedFile.name);
        
        preview.innerHTML = `
            <div class="bg-slate-700 rounded-lg p-3 flex items-center justify-between">
                <div class="flex items-center space-x-3 space-x-reverse">
                    <div class="w-10 h-10 rounded-lg bg-slate-600 flex items-center justify-center">
                        <i class="fas ${fileIcon} text-yellow-400"></i>
                    </div>
                    <div>
                        <p class="text-white text-sm font-medium">${this.attachedFile.name}</p>
                        <p class="text-gray-400 text-xs">${this.formatFileSize(this.attachedFile.size)}</p>
                    </div>
                </div>
                <button onclick="MessagesModule.removeAttachment()" 
                        class="text-red-400 hover:text-red-300 p-2">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        preview.style.display = 'block';
    },
    
    // Remove attachment
    removeAttachment() {
        this.attachedFile = null;
        document.getElementById('attachment-preview').style.display = 'none';
        document.getElementById('file-input').value = '';
    },
    
    // Download file
    downloadFile(messageId) {
        const messages = this.getAllMessages();
        const message = messages.find(m => m.id === messageId);
        
        if (!message || !message.fileUrl) return;
        
        const link = document.createElement('a');
        link.href = message.fileUrl;
        link.download = message.fileName;
        link.click();
        
        UTILS.showNotification('دانلود فایل آغاز شد', 'success');
    },
    
    // Get file icon based on extension
    getFileIcon(fileName) {
        const ext = fileName.split('.').pop().toLowerCase();
        const iconMap = {
            'pdf': 'fa-file-pdf text-red-400',
            'doc': 'fa-file-word text-blue-400',
            'docx': 'fa-file-word text-blue-400',
            'xls': 'fa-file-excel text-green-400',
            'xlsx': 'fa-file-excel text-green-400',
            'ppt': 'fa-file-powerpoint text-orange-400',
            'pptx': 'fa-file-powerpoint text-orange-400',
            'jpg': 'fa-file-image text-yellow-400',
            'jpeg': 'fa-file-image text-yellow-400',
            'png': 'fa-file-image text-yellow-400',
            'gif': 'fa-file-image text-yellow-400',
            'zip': 'fa-file-archive text-yellow-400',
            'rar': 'fa-file-archive text-yellow-400',
            'txt': 'fa-file-alt text-gray-400',
            'mp3': 'fa-file-audio text-pink-400',
            'mp4': 'fa-file-video text-yellow-400',
        };
        return iconMap[ext] || 'fa-file text-gray-400';
    },
    
    // Format file size
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    },
    
    // Handle keyboard shortcuts
    handleKeyDown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendMessage();
        }
    },
    
    // Auto resize textarea
    autoResize(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
    },
    
    // Setup search listener
    setupSearchListener() {
        const searchInput = document.getElementById('search-conversations');
        searchInput.addEventListener('input', (e) => {
            this.searchConversations(e.target.value);
        });
    },
    
    // Search conversations
    searchConversations(query) {
        const users = this.getAllUsers();
        const filtered = users.filter(u => 
            u.name.toLowerCase().includes(query.toLowerCase())
        );
        
        const conversationsHTML = filtered.map(user => this.getConversationItem(user)).join('');
        document.getElementById('conversations-list').innerHTML = conversationsHTML || `
            <div class="text-center py-8 text-gray-400">
                <i class="fas fa-search text-3xl mb-2"></i>
                <p>نتیجه‌ای یافت نشد</p>
            </div>
        `;
    },
    
    // Scroll to bottom
    scrollToBottom() {
        setTimeout(() => {
            const messagesArea = document.getElementById('messages-area');
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }, 100);
    },
    
    // Get conversation messages
    getConversationMessages(userId) {
        const allMessages = this.getAllMessages();
        return allMessages.filter(m => 
            (m.senderId === this.currentUser.id && m.receiverId === userId) ||
            (m.senderId === userId && m.receiverId === this.currentUser.id)
        ).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    },
    
    // Get all messages
    getAllMessages() {
        const messagesStr = localStorage.getItem('messages');
        return messagesStr ? JSON.parse(messagesStr) : [];
    },
    
    // Save message
    saveMessage(message) {
        const messages = this.getAllMessages();
        messages.push(message);
        localStorage.setItem('messages', JSON.stringify(messages));
    },
    
    // Get unread count
    getUnreadCount(userId) {
        const messages = this.getConversationMessages(userId);
        return messages.filter(m => 
            m.senderId === userId && 
            m.receiverId === this.currentUser.id && 
            !m.read
        ).length;
    },
    
    // Mark as read
    markAsRead(userId) {
        const messages = this.getAllMessages();
        messages.forEach(m => {
            if (m.senderId === userId && m.receiverId === this.currentUser.id) {
                m.read = true;
            }
        });
        localStorage.setItem('messages', JSON.stringify(messages));
    },
    
    // Format time
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        // Less than 1 minute
        if (diff < 60000) {
            return 'همین الان';
        }
        // Less than 1 hour
        if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            return `${minutes} دقیقه پیش`;
        }
        // Today
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
        }
        // Yesterday
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
            return 'دیروز';
        }
        // This week
        if (diff < 604800000) {
            const days = Math.floor(diff / 86400000);
            return `${days} روز پیش`;
        }
        // Older
        return date.toLocaleDateString('fa-IR');
    },
    
    // Generate unique ID
    generateId() {
        return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
};
