// Personal Chat Module - ماژول گفتگو شخصی
const PersonalChatModule = {
    // Current state
    selectedUser: null,
    messages: [],
    initialized: false,
    
    // Get personal chat content
    getPersonalChatContent() {
        const currentUser = this.getCurrentUser();
        
        return `
            <div id="personalChatContainer" class="personal-chat-container" style="display: flex; flex-direction: column; height: calc(100vh - 200px); background: #f8fafc; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 20px; color: white;">
                    <h2 style="font-size: 1.5rem; font-weight: bold; margin-bottom: 8px;">
                        <i class="fas fa-comments" style="margin-left: 8px;"></i>
                        گفتگو شخصی
                    </h2>
                    <p style="color: #d1fae5; font-size: 0.875rem;">
                        ${this.getRoleDescription(currentUser.role)}
                    </p>
                </div>

                <!-- Users List & Chat Area -->
                <div style="display: flex; flex: 1; overflow: hidden;">
                    <!-- Users List Sidebar -->
                    <div style="width: 280px; background: #56789bff; border-left: 1px solid #e2e8f0; display: flex; flex-direction: column;">
                        <div style="padding: 16px; border-bottom: 1px solid #e2e8f0;">
                            <h3 style="color: #1e293b; font-weight: bold; margin-bottom: 12px;">
                                <i class="fas fa-users" style="margin-left: 8px; color: #059669;"></i>
                                انتخاب گفتگو
                            </h3>
                            <input type="text" 
                                   id="personalChatSearch" 
                                   placeholder="جستجوی کاربر..."
                                   onkeyup="PersonalChatModule.filterUsers(this.value)"
                                   style="width: 100%; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; color: #333; font-family: inherit;">
                        </div>
                        <div id="personalChatUsersList" style="flex: 1; overflow-y: auto; padding: 8px;">
                            ${this.renderUsersList(currentUser)}
                        </div>
                    </div>

                    <!-- Chat Area -->
                    <div id="personalChatArea" style="flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #ffffff;">
                        ${this.selectedUser ? this.getChatAreaHTML(currentUser) : this.getSelectUserPlaceholderHTML()}
                    </div>
                </div>
            </div>

            <style>
                .personal-chat-container #personalChatUsersList::-webkit-scrollbar {
                    width: 6px;
                }
                .personal-chat-container #personalChatUsersList::-webkit-scrollbar-track {
                    background: #1e293b;
                }
                .personal-chat-container #personalChatUsersList::-webkit-scrollbar-thumb {
                    background: #475569;
                    border-radius: 3px;
                }
                .personal-chat-container #personalChatMessages::-webkit-scrollbar {
                    width: 8px;
                }
                .personal-chat-container #personalChatMessages::-webkit-scrollbar-track {
                    background: #1e293b;
                }
                .personal-chat-container #personalChatMessages::-webkit-scrollbar-thumb {
                    background: #475569;
                    border-radius: 4px;
                }
                .user-item.selected {
                    background: #059669 !important;
                }
                .user-item:hover:not(.selected) {
                    background: #475569 !important;
                }
                @keyframes slideIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
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
    
    // Get role description
    getRoleDescription(role) {
        const descriptions = {
            'manager': 'شما می‌توانید با همه کارمندها و عامل‌ها گفتگو کنید',
            'employee': 'شما می‌توانید با مدیر و سایر کارمندها گفتگو کنید',
            'agent': 'شما فقط می‌توانید با مدیر گفتگو کنید'
        };
        return descriptions[role] || 'گفتگو شخصی';
    },
    
    // Get current user
    getCurrentUser() {
        let user = null;
        try {
            user = JSON.parse(localStorage.getItem('currentUser'));
        } catch (e) {}
        
        if (!user) {
            user = {
                id: 'mgr001',
                name: 'مدیر سیستم',
                username: 'manager',
                role: 'manager'
            };
        }
        return user;
    },
    
    // Get available users for chat based on role
    getAvailableUsers(currentUser) {
        const allUsers = [
            { id: 'mgr001', name: 'مدیر سیستم', username: 'manager', role: 'manager' },
            { id: 'emp001', name: 'ساره', username: 'zahra', role: 'employee' },
            { id: 'emp002', name: 'زینب', username: 'fatemeh', role: 'employee' },
            { id: 'emp003', name: 'فرزاد', username: 'farzad', role: 'employee' },
            { id: 'emp004', name: 'سخایی م', username: 'sakhaei', role: 'employee' },
            { id: 'doc001', name: 'دکتر معصومی', username: 'masoumi', role: 'agent' },
            { id: 'doc002', name: 'دکتر ذوقی', username: 'zoghi', role: 'agent' },
            { id: 'agent001', name: 'دکتر فتحی', username: 'fathi', role: 'agent' },
            { id: 'agent002', name: 'دکتر سجادی', username: 'sajadi', role: 'agent' }
        ];
        
        // Filter based on role
        switch (currentUser.role) {
            case 'manager':
                // مدیر می‌تواند با همه گفتگو کند (به جز خودش)
                return allUsers.filter(u => u.id !== currentUser.id);
                
            case 'employee':
                // کارمند می‌تواند با مدیر و سایر کارمندها گفتگو کند
                return allUsers.filter(u => u.id !== currentUser.id && 
                    (u.role === 'manager' || u.role === 'employee'));
                
            case 'agent':
                // عامل فقط می‌تواند با مدیر گفتگو کند
                return allUsers.filter(u => u.role === 'manager');
                
            default:
                return [];
        }
    },
    
    // Render users list
    renderUsersList(currentUser) {
        const users = this.getAvailableUsers(currentUser);
        
        if (users.length === 0) {
            return `
                <div style="text-align: center; padding: 20px; color: #94a3b8;">
                    <i class="fas fa-user-slash" style="font-size: 2rem; margin-bottom: 8px;"></i>
                    <p>کاربری برای گفتگو یافت نشد</p>
                </div>
            `;
        }
        
        return users.map(user => {
            const isSelected = this.selectedUser && this.selectedUser.id === user.id;
            const unreadCount = this.getUnreadCount(user.id);
            const roleClass = this.getRoleClass(user.role);
            
            return `
                <div onclick="PersonalChatModule.selectUser('${user.id}')"
                     class="user-item ${isSelected ? 'selected' : ''}"
                     style="display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 8px; cursor: pointer; transition: all 0.2s; background: ${isSelected ? '#059669' : 'transparent'};">
                    <div style="width: 40px; height: 40px; border-radius: 50%; ${roleClass} display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
                        ${user.name.charAt(0)}
                    </div>
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <p style="color: white; font-weight: 500;">${user.name}</p>
                            ${unreadCount > 0 ? `<span style="background: #ef4444; color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px;">${unreadCount}</span>` : ''}
                        </div>
                        <p style="color: #94a3b8; font-size: 12px;">${this.getRoleName(user.role)}</p>
                    </div>
                </div>
            `;
        }).join('');
    },
    
    // Get role class for styling
    getRoleClass(role) {
        const classes = {
            'manager': 'background: linear-gradient(135deg, #7c3aed, #a855f7);',
            'employee': 'background: linear-gradient(135deg, #3b82f6, #60a5fa);',
            'agent': 'background: linear-gradient(135deg, #0891b2, #06b6d4);'
        };
        return classes[role] || 'background: #6b7280;';
    },
    
    // Get role name
    getRoleName(role) {
        const names = {
            'manager': 'مدیر',
            'employee': 'کارمند',
            'agent': 'عامل'
        };
        return names[role] || role;
    },
    
    // Get unread messages count
    getUnreadCount(userId) {
        const currentUser = this.getCurrentUser();
        const key = `personalChat_${currentUser.id}_${userId}`;
        const messages = JSON.parse(localStorage.getItem(key) || '[]');
        return messages.filter(m => !m.read && m.senderId !== currentUser.id).length;
    },
    
    // Select user for chat
    selectUser(userId) {
        const currentUser = this.getCurrentUser();
        const users = this.getAvailableUsers(currentUser);
        this.selectedUser = users.find(u => u.id === userId);
        
        if (this.selectedUser) {
            this.loadMessages(userId);
            this.markMessagesAsRead(userId);
            
            // Update chat area immediately
            const chatArea = document.getElementById('personalChatArea');
            if (chatArea) {
                chatArea.innerHTML = this.getChatAreaHTML(currentUser);
                
                // Update users list selection
                this.updateUsersListSelection();
                
                // Scroll messages to bottom
                setTimeout(() => {
                    const messagesContainer = document.getElementById('personalChatMessages');
                    if (messagesContainer) {
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }
                }, 150);
            }
        }
    },
    
    // Refresh chat UI - only update the chat area part
    refreshChatArea(currentUser) {
        const chatArea = document.getElementById('personalChatArea');
        if (chatArea && this.selectedUser) {
            chatArea.innerHTML = this.getChatAreaHTML(currentUser);
        }
    },
    
    // Update users list selection
    updateUsersListSelection() {
        const currentUser = this.getCurrentUser();
        const usersList = document.getElementById('personalChatUsersList');
        
        if (usersList) {
            usersList.innerHTML = this.renderUsersList(currentUser);
        }
    },
    
    // Load messages for specific user
    loadMessages(userId) {
        const currentUser = this.getCurrentUser();
        const key = `personalChat_${currentUser.id}_${userId}`;
        this.messages = JSON.parse(localStorage.getItem(key) || '[]');
        // sync از ابر در پس‌زمینه
        this._loadMessagesFromCloud(currentUser.id, userId);
    },
    
    // Save messages — localStorage + Supabase
    saveMessages(userId) {
        const currentUser = this.getCurrentUser();
        const key = `personalChat_${currentUser.id}_${userId}`;
        localStorage.setItem(key, JSON.stringify(this.messages));
        // sync آخرین پیام به Supabase
        this._syncLastMessage(userId);
    },

    // sync آخرین پیام به Supabase
    _syncLastMessage(receiverId) {
        if (typeof SupabaseDataModule === 'undefined' ||
            typeof SupabaseConnection === 'undefined' ||
            !SupabaseConnection.isOnline) return;

        const lastMsg = this.messages[this.messages.length - 1];
        if (!lastMsg) return;

        const sbMsg = {
            id:         String(lastMsg.id),
            senderId:   lastMsg.senderId || null,
            receiverId: receiverId       || null,
            content:    lastMsg.text || lastMsg.fileName || '[file]',
            isSystem:   false
        };

        SupabaseDataModule.sendMessage(sbMsg)
            .then(ok => { if (ok) console.log('✅ personalChat پیام در Supabase:', sbMsg.id); })
            .catch(e  => console.warn('⚠️ personalChat sync خطا:', e.message));
    },

    // بارگذاری پیام‌ها از Supabase در پس‌زمینه
    _loadMessagesFromCloud(myId, otherId) {
        if (typeof SupabaseDataModule === 'undefined' ||
            typeof SupabaseConnection === 'undefined' ||
            !SupabaseConnection.isOnline) return;

        SupabaseDataModule.getMessages(myId).then(cloudMsgs => {
            if (!cloudMsgs || cloudMsgs.length === 0) return;

            // فقط پیام‌های بین این دو نفر
            const relevant = cloudMsgs.filter(m =>
                (m.senderId === myId    && m.receiverId === otherId) ||
                (m.senderId === otherId && m.receiverId === myId)
            );
            if (relevant.length === 0) return;

            const key = `personalChat_${myId}_${otherId}`;
            const local = JSON.parse(localStorage.getItem(key) || '[]');
            const allIds = new Set(local.map(m => String(m.id)));

            relevant.forEach(m => {
                if (!allIds.has(String(m.id))) {
                    local.push({
                        id:         m.id,
                        senderId:   m.senderId,
                        senderName: m.senderId,
                        text:       m.content || m.text || '',
                        type:       'text',
                        timestamp:  m.createdAt || m.created_at,
                        read:       !!(m.readAt || m.read_at)
                    });
                }
            });
            local.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            localStorage.setItem(key, JSON.stringify(local));

            // اگر این مکالمه هنوز باز است، پیام‌ها رو به‌روز کن
            if (this.selectedUser && this.selectedUser.id === otherId) {
                this.messages = local;
                const currentUser = this.getCurrentUser();
                this.refreshChatArea(currentUser);
            }
        }).catch(e => console.warn('⚠️ personalChat loadFromCloud خطا:', e.message));
    },
    
    // Mark messages as read
    markMessagesAsRead(userId) {
        const currentUser = this.getCurrentUser();
        const key = `personalChat_${currentUser.id}_${userId}`;
        const messages = JSON.parse(localStorage.getItem(key) || '[]');
        
        messages.forEach(msg => {
            if (msg.senderId !== currentUser.id) {
                msg.read = true;
            }
        });
        
        localStorage.setItem(key, JSON.stringify(messages));
    },
    
    // Get select user placeholder
    getSelectUserPlaceholderHTML() {
        return `
            <div style="flex: 1; display: flex; align-items: center; justify-content: center; color: #94a3b8;">
                <div style="text-align: center;">
                    <i class="fas fa-arrow-right" style="font-size: 3rem; margin-bottom: 16px;"></i>
                    <p style="font-size: 1.125rem;">یک کاربر را از لیست انتخاب کنید</p>
                </div>
            </div>
        `;
    },
    
    // Get chat area HTML
    getChatAreaHTML(currentUser) {
        return `
            <!-- Chat Header -->
            <div style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; display: flex; align-items: center; gap: 12px;">
                <div style="width: 40px; height: 40px; border-radius: 50%; ${this.getRoleClass(this.selectedUser.role)} display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
                    ${this.selectedUser.name.charAt(0)}
                </div>
                <div>
                    <p style="color: #1e293b; font-weight: 600;">${this.selectedUser.name}</p>
                    <p style="color: #64748b; font-size: 12px;">${this.getRoleName(this.selectedUser.role)}</p>
                </div>
                <button onclick="PersonalChatModule.closeChat()" 
                        style="margin-right: auto; background: transparent; border: none; color: #94a3b8; cursor: pointer; font-size: 18px;">
                    <i class="fas fa-times"></i>
                </button>
            </div>

            <!-- Messages Area -->
            <div id="personalChatMessages" style="flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 12px; background: #f8fafc;">
                ${this.renderMessages(currentUser)}
            </div>

            <!-- Input Area -->
            <div style="padding: 16px 20px; border-top: 1px solid #e2e8f0; background: #f1f5f9;">
                <div style="display: flex; gap: 12px; align-items: flex-end;">
                    <textarea 
                        id="personalChatInput" 
                        placeholder="پیام خود را بنویسید..."
                        rows="1"
                        onkeypress="if(event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); PersonalChatModule.sendMessage(); }"
                        oninput="this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 120) + 'px';"
                        style="flex: 1; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 16px; color: #333; resize: none; min-height: 44px; max-height: 120px; font-family: inherit;"></textarea>
                    
                    <div style="display: flex; gap: 8px;">
                        <button onclick="PersonalChatModule.attachFile()" 
                                style="width: 44px; height: 44px; border-radius: 12px; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; background: #8b5cf6; color: white; font-size: 18px;"
                                title="پیوست فایل">
                            <i class="fas fa-paperclip"></i>
                        </button>
                        <button onclick="PersonalChatModule.sendMessage()" 
                                style="width: 44px; height: 44px; border-radius: 12px; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; background: #059669; color: white; font-size: 18px;"
                                title="ارسال">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    },
    
    // Update users list selection
    updateUsersListSelection() {
        const currentUser = this.getCurrentUser();
        const users = this.getAvailableUsers(currentUser);
        const usersList = document.getElementById('personalChatUsersList');
        
        if (usersList) {
            usersList.innerHTML = this.renderUsersList(currentUser);
        }
    },
    
    // Render messages
    renderMessages(currentUser) {
        if (this.messages.length === 0) {
            return `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; color: #94a3b8;">
                    <i class="fas fa-comments" style="font-size: 3rem; margin-bottom: 12px;"></i>
                    <p style="font-size: 1rem;">هنوز پیامی ارسال نشده است</p>
                    <p style="font-size: 0.875rem; margin-top: 4px;">اولین پیام را ارسال کنید</p>
                </div>
            `;
        }
        
        return this.messages.map(msg => {
            const isOwn = msg.senderId === currentUser.id;
            const time = new Date(msg.timestamp).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
            
            return `
                <div style="display: flex; justify-content: ${isOwn ? 'flex-end' : 'flex-start'}; animation: slideIn 0.3s ease;">
                    <div style="max-width: 70%; display: flex; flex-direction: column; align-items: ${isOwn ? 'flex-end' : 'flex-start'};">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; font-size: 12px;">
                            ${!isOwn ? `<span style="color: #374151; font-weight: 600;">${msg.senderName}</span>` : ''}
                            <span style="color: #9ca3af;">${time}</span>
                        </div>
                        <div style="border-radius: 12px; padding: 12px 16px; ${isOwn ? 'background: #059669; color: white;' : 'background: #e2e8f0; color: #1e293b;'}">
                            ${this.renderMessageContent(msg)}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },
    
    // Render message content
    renderMessageContent(msg) {
        switch (msg.type) {
            case 'text':
                return `<p class="whitespace-pre-wrap break-words">${msg.text}</p>`;
            case 'voice':
                return `
                    <div class="flex items-center gap-3 min-w-[200px]">
                        <audio controls src="${msg.audioData}" style="height: 32px;">
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
    },
    
    // Send message
    sendMessage() {
        const input = document.getElementById('personalChatInput');
        const text = input.value.trim();
        
        if (!text || !this.selectedUser) return;
        
        const currentUser = this.getCurrentUser();
        
        const message = {
            id: Date.now(),
            senderId: currentUser.id,
            senderName: currentUser.name,
            text: text,
            type: 'text',
            timestamp: new Date().toISOString(),
            read: true
        };
        
        this.messages.push(message);
        this.saveMessages(this.selectedUser.id);
        
        // Clear input and re-render
        input.value = '';
        this.refreshChatArea(currentUser);
        
        // Scroll to bottom
        setTimeout(() => {
            const container = document.getElementById('personalChatMessages');
            if (container) container.scrollTop = container.scrollHeight;
        }, 50);
    },
    
    // Attach file
    attachFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                this.sendFileMessage(file);
            }
        };
        
        input.click();
    },
    
    // Send file message
    sendFileMessage(file) {
        if (!this.selectedUser) return;
        
        const reader = new FileReader();
        const currentUser = this.getCurrentUser();
        
        reader.onloadend = () => {
            const message = {
                id: Date.now(),
                senderId: currentUser.id,
                senderName: currentUser.name,
                fileName: file.name,
                fileData: reader.result,
                fileType: file.type,
                type: 'file',
                timestamp: new Date().toISOString(),
                read: true
            };
            
            this.messages.push(message);
            this.saveMessages(this.selectedUser.id);
            this.refreshChatArea(currentUser);
            
            setTimeout(() => {
                const container = document.getElementById('personalChatMessages');
                if (container) container.scrollTop = container.scrollHeight;
            }, 50);
        };
        
        reader.readAsDataURL(file);
    },
    
    // Filter users
    filterUsers(query) {
        const currentUser = this.getCurrentUser();
        let users = this.getAvailableUsers(currentUser);
        
        if (query.trim()) {
            users = users.filter(u => 
                u.name.toLowerCase().includes(query.toLowerCase()) ||
                u.username.toLowerCase().includes(query.toLowerCase())
            );
        }
        
        const usersList = document.getElementById('personalChatUsersList');
        if (usersList) {
            const currentUserObj = this.getCurrentUser();
            usersList.innerHTML = this.renderFilteredUsers(users, currentUserObj);
        }
    },
    
    // Render filtered users
    renderFilteredUsers(users, currentUser) {
        if (users.length === 0) {
            return `
                <div style="text-align: center; padding: 20px; color: #94a3b8;">
                    <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 8px;"></i>
                    <p>کاربری یافت نشد</p>
                </div>
            `;
        }
        
        return users.map(user => {
            const isSelected = this.selectedUser && this.selectedUser.id === user.id;
            const unreadCount = this.getUnreadCount(user.id);
            
            return `
                <div onclick="PersonalChatModule.selectUser('${user.id}')"
                     class="user-item ${isSelected ? 'selected' : ''}"
                     style="display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 8px; cursor: pointer; transition: all 0.2s; background: ${isSelected ? '#059669' : 'transparent'};">
                    <div style="width: 40px; height: 40px; border-radius: 50%; ${this.getRoleClass(user.role)} display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
                        ${user.name.charAt(0)}
                    </div>
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <p style="color: white; font-weight: 500;">${user.name}</p>
                            ${unreadCount > 0 ? `<span style="background: #ef4444; color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px;">${unreadCount}</span>` : ''}
                        </div>
                        <p style="color: #94a3b8; font-size: 12px;">${this.getRoleName(user.role)}</p>
                    </div>
                </div>
            `;
        }).join('');
    },
    
    // Close chat
    closeChat() {
        this.selectedUser = null;
        const currentUser = this.getCurrentUser();
        
        const chatArea = document.getElementById('personalChatArea');
        if (chatArea) {
            chatArea.innerHTML = this.getSelectUserPlaceholderHTML();
        }
        
        // Update users list
        this.updateUsersListSelection();
    },
    
    // Initialize module
    init() {
        this.initialized = true;
    }
};

// Global function for app.js
window.getPersonalChatContent = function() {
    return PersonalChatModule.getPersonalChatContent();
};