// ============================================================
// management-chat-module.js  v2
// ماژول نمایش گفتگوی مدیریت در سایدبار index.html
// ============================================================
const ManagementChatModule = {

    // ── HTML اصلی چت ─────────────────────────────────────────
    getManagementChatContent(currentUser) {
        return `
        <div id="mgmt-chat-wrapper" class="flex flex-col rounded-2xl overflow-hidden border border-white/20 shadow-xl"
             style="height:calc(100vh - 200px);background:#f8fafc;">

            <!-- هدر -->
            <div class="flex items-center justify-between px-5 py-4 text-white"
                 style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);">
                <div>
                    <h2 class="text-lg font-bold flex items-center gap-2">
                        <i class="fas fa-users-cog"></i> گفتگو مدیریت
                    </h2>
                    <p class="text-indigo-200 text-xs mt-0.5">چت مشترک مدیر و کارمندان</p>
                </div>
                <!-- جستجو -->
                <div class="relative">
                    <input type="text" id="mgmt-search-input" placeholder="جستجو..."
                        oninput="if(window.managesChatInstance) window.managesChatInstance.setSearchQuery(this.value)"
                        class="bg-white/20 border border-white/30 rounded-xl px-3 py-1.5 text-white placeholder-indigo-200 text-sm focus:outline-none focus:bg-white/30 w-36">
                    <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-indigo-200 text-xs pointer-events-none"></i>
                </div>
            </div>

            <!-- بنر هشدار migration نشده -->
            <div id="mgmt-migration-banner" class="hidden items-center gap-3 px-4 py-3 text-sm font-medium"
                 style="display:none;background:#fef3c7;color:#92400e;border-bottom:1px solid #fde68a;">
                <i class="fas fa-exclamation-triangle text-amber-500"></i>
                <span>جدول چت مدیریت هنوز ایجاد نشده — فایل
                    <code class="bg-amber-100 px-1 rounded text-xs">supabase/management_chat_migration.sql</code>
                    را در Supabase SQL Editor اجرا کنید تا چت‌ها برای همه ذخیره شوند.
                </span>
            </div>

            <!-- نوار شرکت‌کنندگان -->
            <div id="mgmt-participants-bar"
                 class="flex items-center gap-2 px-4 py-2 overflow-x-auto border-b border-gray-200"
                 style="background:#f1f5f9;min-height:48px;">
                <span class="text-gray-400 text-xs whitespace-nowrap">در حال بارگذاری...</span>
            </div>

            <!-- ناحیه پیام‌ها -->
            <div id="managesChatMessages"
                 class="flex-1 overflow-y-auto p-4"
                 style="direction:rtl;"></div>

            <!-- ناحیه ورودی -->
            <div class="border-t border-gray-200 px-4 py-3" style="background:#f1f5f9;">
                <div class="flex items-end gap-2">
                    <textarea id="managesChatInput" rows="1"
                        placeholder="پیام بنویسید... (Enter = ارسال، Shift+Enter = خط جدید)"
                        class="flex-1 bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-gray-800 text-sm resize-none focus:outline-none focus:border-indigo-400 transition-colors"
                        style="min-height:42px;max-height:120px;"
                        onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();if(window.managesChatInstance)window.managesChatInstance.sendMessage();}"
                        oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,120)+'px';"></textarea>
                    <div class="flex gap-1.5 flex-shrink-0">
                        <!-- منشن -->
                        <button onclick="if(window.managesChatInstance)window.managesChatInstance.showMentionList();"
                            title="منشن کردن"
                            class="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:opacity-90"
                            style="background:#fbbf24;color:#1e293b;">
                            <i class="fas fa-at text-sm"></i>
                        </button>
                        <!-- پیوست فایل -->
                        <button onclick="if(window.managesChatInstance)window.managesChatInstance.attachFile();"
                            title="پیوست فایل"
                            class="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:opacity-90"
                            style="background:#8b5cf6;color:white;">
                            <i class="fas fa-paperclip text-sm"></i>
                        </button>
                        <!-- ضبط صوت -->
                        <button id="recordVoiceBtn"
                            onclick="if(window.managesChatInstance)window.managesChatInstance.toggleVoiceRecording();"
                            title="ضبط صوت"
                            class="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:opacity-90"
                            style="background:#ef4444;color:white;">
                            <i class="fas fa-microphone text-sm"></i>
                        </button>
                        <!-- ارسال -->
                        <button onclick="if(window.managesChatInstance)window.managesChatInstance.sendMessage();"
                            title="ارسال"
                            class="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:opacity-90"
                            style="background:#6366f1;color:white;">
                            <i class="fas fa-paper-plane text-sm"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <style>
            #managesChatMessages::-webkit-scrollbar { width:6px; }
            #managesChatMessages::-webkit-scrollbar-track { background:#f1f5f9; border-radius:3px; }
            #managesChatMessages::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:3px; }
            #managesChatMessages::-webkit-scrollbar-thumb:hover { background:#94a3b8; }
            #mgmt-participants-bar::-webkit-scrollbar { height:3px; }
            #mgmt-participants-bar::-webkit-scrollbar-thumb { background:#c7d2fe; border-radius:2px; }
            @keyframes mgmt-slideIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
            #managesChatMessages > div { animation: mgmt-slideIn .2s ease; }
        </style>

        <script>
            (function() {
                // destroy نمونه قبلی اگر وجود داشت
                if (window.managesChatInstance?.destroy) {
                    window.managesChatInstance.destroy();
                    window.managesChatInstance = null;
                }
                // ایجاد نمونه جدید بعد از mount شدن DOM
                setTimeout(async () => {
                    window.managesChatInstance = new ManagesChat();
                    // رندر شرکت‌کنندگان بعد از load
                    setTimeout(() => {
                        if (window.managesChatInstance?.renderParticipantsBar) {
                            window.managesChatInstance.renderParticipantsBar();
                        }
                    }, 800);

                    // بررسی وجود جدول — نمایش بنر هشدار اگر migration اجرا نشده
                    setTimeout(async () => {
                        try {
                            const client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : null;
                            if (!client) return;
                            const { error } = await client.from('management_messages').select('id').limit(1);
                            if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
                                const banner = document.getElementById('mgmt-migration-banner');
                                if (banner) banner.style.display = 'flex';
                            }
                        } catch {}
                    }, 1500);
                }, 100);
            })();
        </script>`;
    },

    // ── تعداد پیام‌های خوانده‌نشده ────────────────────────────
    async getUnreadCount() {
        try {
            const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
            if (!user?.id || typeof SupabaseDataModule === 'undefined') return 0;
            return await SupabaseDataModule.getUnreadManagementCount(user.id);
        } catch { return 0; }
    },

    // ── علامت‌گذاری خوانده‌شده ─────────────────────────────────
    async markAsRead() {
        try {
            const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
            if (!user?.id || typeof SupabaseDataModule === 'undefined') return;
            const msgs = window.managesChatInstance?.messages || [];
            const ids  = msgs.map(m => m.id).filter(Boolean);
            if (ids.length) await SupabaseDataModule.markManagementMessagesRead(user.id, ids);
        } catch {}
    }
};

// export برای محیط‌های module-based
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ManagementChatModule;
}
