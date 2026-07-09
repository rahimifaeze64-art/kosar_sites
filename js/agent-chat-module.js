// Agent Chat Module - ماژول چت عامل
const AgentChatModule = {
    // Open agent chat in new window or modal
    openAgentChat() {
        window.open('agent-chat.html', '_blank', 'width=1200,height=800');
    },
    
    // Show agent chat in modal
    showAgentChatModal() {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-slate-800 rounded-lg w-11/12 h-5/6 flex flex-col">
                <div class="flex justify-between items-center p-4 border-b border-slate-700">
                    <h3 class="text-xl font-bold text-white">
                        <i class="fas fa-comments ml-2"></i>
                        گفتگو
                    </h3>
                    <button onclick="this.closest('.fixed').remove()" 
                            class="text-gray-400 hover:text-white">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                <iframe src="agent-chat.html" 
                        class="flex-1 w-full border-0"></iframe>
            </div>
        `;
        document.body.appendChild(modal);
    },
    
    // Get agent chat content for sidebar
    getAgentChatContent(currentUser) {
        return `
            <div class="agent-chat-container" style="display: flex; flex-direction: column; height: calc(100vh - 200px); background: #1e293b; border-radius: 12px; overflow: hidden;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 20px; color: white;">
                    <h2 style="font-size: 1.5rem; font-weight: bold; margin-bottom: 8px;">
                        <i class="fas fa-comments" style="margin-left: 8px;"></i>
                        گفتگو
                    </h2>
                    <p style="color: #fef3c7; font-size: 0.875rem;">
                        چت مشترک مدیر و عامل‌ها برای هماهنگی وظایف
                    </p>
                </div>

                <!-- Participants Bar -->
                <div style="background: #334155; padding: 12px 20px; border-bottom: 1px solid #475569; display: flex; align-items: center; gap: 12px; overflow-x: auto;">
                    <span style="color: #94a3b8; font-size: 0.875rem;">شرکت‌کنندگان:</span>
                    <div style="display: flex; align-items: center; gap: 8px; background: #7c3aed; padding: 6px 12px; border-radius: 20px; white-space: nowrap; font-size: 14px;">
                        <i class="fas fa-crown"></i>
                        <span>مدیر</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; background: #475569; padding: 6px 12px; border-radius: 20px; white-space: nowrap; font-size: 14px;">
                        <i class="fas fa-user-tie"></i>
                        <span>فتحی</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; background: #475569; padding: 6px 12px; border-radius: 20px; white-space: nowrap; font-size: 14px;">
                        <i class="fas fa-user-tie"></i>
                        <span>سجادی</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; background: #475569; padding: 6px 12px; border-radius: 20px; white-space: nowrap; font-size: 14px;">
                        <i class="fas fa-user-tie"></i>
                        <span>احمدی</span>
                    </div>
                </div>

                <!-- Messages Area -->
                <div id="agentChatMessages" style="flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px;">
                    <!-- Messages will be rendered here by JS -->
                </div>

                <!-- Input Area -->
                <div style="background: #334155; padding: 16px 20px; border-top: 1px solid #475569;">
                    <div style="display: flex; gap: 12px; align-items: flex-end;">
                        <textarea 
                            id="agentChatInput" 
                            placeholder="پیام خود را بنویسید... (از @ برای منشن استفاده کنید)"
                            rows="1"
                            style="flex: 1; background: #1e293b; border: 1px solid #475569; border-radius: 12px; padding: 12px 16px; color: white; resize: none; min-height: 44px; max-height: 120px; font-family: inherit;"
                            onkeypress="if(event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); if(window.agentChatInstance) window.agentChatInstance.sendMessage(); }"
                            oninput="this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 120) + 'px';"></textarea>
                        
                        <div style="display: flex; gap: 8px;">
                            <button id="mentionBtn" onclick="if(window.agentChatInstance) window.agentChatInstance.showMentionList();" 
                                    style="width: 44px; height: 44px; border-radius: 12px; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; font-size: 18px; background: #fbbf24; color: #1e293b;"
                                    title="منشن کردن">
                                <i class="fas fa-at"></i>
                            </button>
                            <button id="attachFileBtn" onclick="if(window.agentChatInstance) window.agentChatInstance.attachFile();" 
                                    style="width: 44px; height: 44px; border-radius: 12px; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; font-size: 18px; background: #8b5cf6; color: white;"
                                    title="پیوست فایل">
                                <i class="fas fa-paperclip"></i>
                            </button>
                            <button id="recordVoiceBtn" onclick="if(window.agentChatInstance) window.agentChatInstance.toggleVoiceRecording();" 
                                    style="width: 44px; height: 44px; border-radius: 12px; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; font-size: 18px; background: #ef4444; color: white;"
                                    title="ضبط صوت">
                                <i class="fas fa-microphone"></i>
                            </button>
                            <button id="sendAgentChatBtn" onclick="if(window.agentChatInstance) window.agentChatInstance.sendMessage();" 
                                    style="width: 44px; height: 44px; border-radius: 12px; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; font-size: 18px; background: #f59e0b; color: white;"
                                    title="ارسال">
                                <i class="fas fa-paper-plane"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <style>
                .agent-chat-container #agentChatMessages::-webkit-scrollbar {
                    width: 8px;
                }
                .agent-chat-container #agentChatMessages::-webkit-scrollbar-track {
                    background: #1e293b;
                    border-radius: 4px;
                }
                .agent-chat-container #agentChatMessages::-webkit-scrollbar-thumb {
                    background: #475569;
                    border-radius: 4px;
                }
                .agent-chat-container #agentChatMessages::-webkit-scrollbar-thumb:hover {
                    background: #64748b;
                }
                .agent-chat-container textarea:focus {
                    outline: none;
                    border-color: #f59e0b !important;
                }
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
                .recording {
                    animation: pulse 1s infinite;
                }
                @keyframes pulse {
                    0%, 100% {
                        opacity: 1;
                    }
                    50% {
                        opacity: 0.5;
                    }
                }
            </style>

            <script>
                // Initialize agent chat when content is loaded
                setTimeout(() => {
                    if (!window.agentChatInstance) {
                        window.agentChatInstance = new AgentChat();
                        console.log('✅ Agent chat initialized in sidebar');
                    } else {
                        window.agentChatInstance.renderMessages();
                        console.log('✅ Agent chat re-rendered');
                    }
                }, 100);
            </script>
        `;
    },
    
    // Get unread messages count for badge
    getUnreadCount() {
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const messages = JSON.parse(localStorage.getItem('agentChat_messages') || '[]');
        
        return messages.filter(msg => {
            return msg.mentions && 
                   msg.mentions.includes(currentUser.username) && 
                   !msg.read;
        }).length;
    },
    
    // Mark messages as read
    markAsRead() {
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const messages = JSON.parse(localStorage.getItem('agentChat_messages') || '[]');
        
        messages.forEach(msg => {
            if (msg.mentions && msg.mentions.includes(currentUser.username)) {
                msg.read = true;
            }
        });
        
        localStorage.setItem('agentChat_messages', JSON.stringify(messages));
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgentChatModule;
}
