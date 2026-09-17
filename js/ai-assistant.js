// ============================================================
// AI Assistant Module — دستیار هوشمند مدیریت دانشجویان (آزمایشی)
// لایه صدا: Web Speech API (fa-IR)  |  لایه درک دستور: NLP محلی
// لایه داده: EmployeeModule.getAllStudents() + مراحل ساختارمند
// بدون LLM API — سریع، آفلاین و بدون هزینه
// ============================================================

const AiAssistantModule = {

    // ── مسیرهای سیستم (هم‌راستا با EmployeeModule._getAllPathTypes) ──
    PATHS: {
        studying:     { label: 'در حال تحصیل',  icon: 'fa-book-reader',      color: '#22d3ee' },
        defense:      { label: 'گردش دفاع',     icon: 'fa-shield-halved',    color: '#60a5fa' },
        requirements: { label: 'ملزومات',       icon: 'fa-clipboard-check',  color: '#fb923c' },
        educational:  { label: 'فارغ‌التحصیلی', icon: 'fa-graduation-cap',   color: '#4ade80' },
    },

    // ── سرویس محلی تبدیل متن به گفتار فارسی (pocket-tts-farsi) ──
    // اگر سرویس در دسترس نباشد، خودکار به Web Speech مرورگر برمی‌گردد.
    // راه‌اندازی: python tts_service/tts_server.py
    TTS_SERVICE_URL: 'http://127.0.0.1:8765',

    // ── کلمات پرتکرار که برای تشخیص «نام مرحله» حذف می‌شوند ──
    STOPWORDS: [
        'مرحله', 'مرحله‌ی', 'مرحله‌ای', 'در', 'حال', 'درحال', 'هستن', 'هستند', 'هست',
        'که', 'و', 'با', 'برای', 'از', 'را', 'به', 'توی', 'داخل', 'فعلا', 'الان', 'حالا',
        'دانشجو', 'دانشجوها', 'دانشجویی', 'دانشجویانی', 'دانشجویان', 'دانشجوهای',
        'لیست', 'اسم', 'اسامی', 'نام', 'نفر', 'نفرند', 'چند', 'چندتا', 'تعداد', 'شمار',
        'بگو', 'بخوان', 'بخوانی', 'بخون', 'صدا', 'بلند', 'قرائت', 'نمایش', 'بده', 'نشان',
        'کن', 'بکن', 'کنید', 'بدید', 'بدین', 'بیار', 'بیاور', 'بگیر', 'چک', 'بررسی', 'لیستش',
        'وضعیت', 'برام', 'برایم', 'لطفا', 'میشه', 'می‌شه', 'میتونی', 'می‌تونی', 'یک', 'تا',
        'همه', 'همه‌ی', 'کل', 'تمام', 'آن', 'این', 'چه', 'کدام', 'چقدر', 'چیا', 'چی',
        'اطلاعات', 'مشخصات', 'پرونده', 'پروفایل', 'کیست', 'کیه', 'بیشتر', 'کامل',
        // کلمات مربوط به مسیرها (نباید بخشی از نام مرحله شوند)
        'دفاع', 'گردش', 'ملزومات', 'ملزوم', 'فارغ', 'التحصیلی', 'فارغالتحصیلی', 'تحصیل', 'مشغول'
    ],

    state: {
        messages: [],
        listening: false,
        speakEnabled: true,
        busy: false,
        recognition: null,
        ttsOnline: null,      // null = نامشخص | true = سرویس محلی پاسخ می‌دهد | false = فقط Web Speech
        audio: null,          // پخش‌کننده فعلی سرویس محلی
        useService: true,     // تلاش برای سرویس محلی
        serviceFailedOnce: false,
        voiceWarned: false,
    },

    // ═══════════════════════════════════════════════════════════
    //  UI
    // ═══════════════════════════════════════════════════════════
    getContent() {
        return `
        <div class="space-y-4" dir="rtl" style="font-family:Vazirmatn,Tahoma,sans-serif;">

            <!-- بازگشت -->
            <div class="flex items-center gap-3">
                <button onclick="window._alpineSetPage && window._alpineSetPage('students')"
                        class="flex items-center gap-2 text-lime-400 hover:text-lime-300 text-sm font-medium transition-all">
                    <i class="fas fa-arrow-right"></i> بازگشت به مدیریت دانشجویان
                </button>
            </div>

            <div class="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden shadow-xl">

                <!-- هدر -->
                <div class="flex items-center gap-3 p-4 border-b border-slate-700"
                     style="background:linear-gradient(to left, rgba(101,163,13,.35), rgba(22,163,74,.25), rgba(30,41,59,1));">
                    <div class="w-12 h-12 rounded-full overflow-hidden bg-white/10 ring-2 ring-lime-400/50 flex-shrink-0">
                        <img src="assets/logooo.png" alt="دستیار هوشمند" class="w-full h-full object-cover">
                    </div>
                    <div class="flex-1 min-w-0">
                        <h2 class="text-white font-bold text-lg flex items-center gap-2">
                            دستیار هوشمند دانشجویان
                            <span class="text-[10px] bg-lime-500 text-gray-900 px-2 py-0.5 rounded-full font-bold">آزمایشی</span>
                        </h2>
                        <p class="text-xs text-gray-400 truncate flex items-center gap-2">
                            با دستور متنی یا صوتی جستجو کن و نتایج را بشنو
                            <span id="ai-tts-status" class="hidden items-center gap-1 text-[10px] border border-slate-600 rounded-full px-2 py-0.5"></span>
                        </p>
                    </div>
                    <button id="ai-voice-btn" onclick="AiAssistantModule.toggleSpeak()"
                            title="خواندن پاسخ با صدا"
                            class="w-10 h-10 rounded-full flex items-center justify-center transition-all bg-lime-600 text-gray-900 hover:bg-lime-500">
                        <i class="fas fa-volume-high"></i>
                    </button>
                    <button onclick="AiAssistantModule.testVoice()"
                            title="تست صدا"
                            class="w-10 h-10 rounded-full flex items-center justify-center transition-all bg-slate-700 text-gray-200 hover:bg-slate-600">
                        <i class="fas fa-bell"></i>
                    </button>
                </div>

                <!-- پیام‌ها -->
                <div id="ai-messages" class="p-4 space-y-3 overflow-y-auto"
                     style="height:52vh;min-height:320px;background:rgba(15,23,42,.35);"></div>

                <!-- پیشنهادها -->
                <div id="ai-suggestions" class="px-4 pb-3 pt-1 flex flex-wrap gap-2"></div>

                <!-- ورودی -->
                <div class="p-4 border-t border-slate-700 bg-slate-800/80">
                    <div class="flex items-center gap-2">
                        <button id="ai-mic-btn" onclick="AiAssistantModule.toggleMic()"
                                title="دستور صوتی"
                                class="w-11 h-11 rounded-full flex items-center justify-center transition-all bg-slate-700 text-gray-200 hover:bg-slate-600 flex-shrink-0">
                            <i class="fas fa-microphone"></i>
                        </button>
                        <input id="ai-input" type="text" autocomplete="off"
                               placeholder="مثلاً: اسم دانشجویانی که در مرحله استلال هستند را بخوان"
                               onkeydown="if(event.key==='Enter'){event.preventDefault();AiAssistantModule.ask();}"
                               class="flex-1 bg-slate-700 text-white border border-slate-600 rounded-xl px-4 py-2.5 text-sm
                                      focus:outline-none focus:ring-2 focus:ring-lime-500 placeholder-gray-500">
                        <button onclick="AiAssistantModule.ask()"
                                title="ارسال"
                                class="w-11 h-11 rounded-full flex items-center justify-center bg-lime-600 text-gray-900 hover:bg-lime-500 transition-all flex-shrink-0">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                    <p id="ai-support-note" class="text-[11px] text-gray-500 mt-2"></p>
                </div>
            </div>
        </div>`;
    },

    SUGGESTIONS: [
        'اسم دانشجویانی که در مرحله استلال هستند را بخوان',
        'چند دانشجو در مرحله گردش دفاع هستند؟',
        'دانشجویان در حال تحصیل را لیست کن',
        'اسم دانشجویان مرحله فارغ‌التحصیلی را بخوان',
        'راهنما',
    ],

    init() {
        if (this.state.messages.length === 0) {
            this._pushMessage('ai',
                'سلام 👋 من دستیار هوشمند مدیریت دانشجویان هستم.\n' +
                'می‌تونی تایپ کنی یا با میکروفون بگی؛ مثلاً:\n' +
                '«اسم دانشجویانی که در مرحله استلال هستند را بخوان»');
        }
        this._render();
        this._renderSuggestions();

        const note = document.getElementById('ai-support-note');
        const sttOk = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
        if (note) {
            if (!sttOk) note.textContent = 'تشخیص گفتار در این مرورگر پشتیبانی نمی‌شود؛ دستور متنی کار می‌کند.';
        }
        this._syncVoiceButton();
        this._syncMicButton();
        this._renderTtsStatus();
        this.checkTtsService();
        this._ensureVoices().then(() => this._renderDiagNote());

        const inp = document.getElementById('ai-input');
        if (inp) setTimeout(() => inp.focus(), 80);
    },

    // ── خط تشخیص: وضعیت صدا (سرویس محلی + صدای فارسی مرورگر) ──
    _renderDiagNote() {
        const note = document.getElementById('ai-support-note');
        if (!note) return;
        const sttOk = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
        const speakOk = !!window.speechSynthesis;
        const faVoice = this._pickVoice();
        const svc = this.state.ttsOnline;

        const parts = [];
        if (svc === true) parts.push('🔊 سرویس محلی: متصل');
        else if (svc === false) parts.push('🔊 سرویس محلی: غیرفعال');
        else parts.push('🔊 سرویس محلی: …');
        if (speakOk) parts.push(faVoice ? 'صدای فارسی مرورگر: دارد' : 'صدای فارسی مرورگر: ندارد');
        else parts.push('صدای مرورگر: پشتیبانی نمی‌شود');
        if (!sttOk) parts.push('میکروفون: پشتیبانی نمی‌شود');

        note.textContent = parts.join('  •  ');
    },

    _renderSuggestions() {
        const box = document.getElementById('ai-suggestions');
        if (!box) return;
        box.innerHTML = this.SUGGESTIONS.map(s =>
            `<button onclick="AiAssistantModule.ask(this.dataset.q)" data-q="${this._escAttr(s)}"
                     class="text-xs bg-slate-700/70 hover:bg-lime-600/80 text-gray-300 hover:text-gray-900
                            border border-slate-600 rounded-full px-3 py-1.5 transition-all">${this._esc(s)}</button>`
        ).join('');
    },

    // ═══════════════════════════════════════════════════════════
    //  Chat
    // ═══════════════════════════════════════════════════════════
    _pushMessage(role, text) {
        this.state.messages.push({ role, text: String(text == null ? '' : text) });
    },

    _render() {
        const box = document.getElementById('ai-messages');
        if (!box) return;
        box.innerHTML = this.state.messages.map(m => this._messageHtml(m)).join('');
        box.scrollTop = box.scrollHeight;
    },

    _messageHtml(m) {
        if (m.role === 'user') {
            return `<div class="flex justify-end">
                <div class="max-w-[85%] bg-lime-600 text-gray-900 rounded-2xl rounded-tl-sm px-4 py-2 text-sm leading-7 whitespace-pre-line">${this._esc(m.text)}</div>
            </div>`;
        }
        return `<div class="flex justify-start gap-2">
            <div class="w-8 h-8 rounded-full overflow-hidden bg-white/10 flex-shrink-0 mt-0.5">
                <img src="assets/logooo.png" class="w-full h-full object-cover" alt="">
            </div>
            <div class="max-w-[85%] bg-slate-700 text-gray-100 rounded-2xl rounded-tr-sm px-4 py-2 text-sm leading-7 whitespace-pre-line">${this._esc(m.text)}</div>
        </div>`;
    },

    ask(presetText) {
        const inp = document.getElementById('ai-input');
        const text = (typeof presetText === 'string' && presetText.trim())
            ? presetText.trim()
            : (inp ? inp.value.trim() : '');
        if (!text) return;
        if (inp) inp.value = '';

        this._pushMessage('user', text);
        this._render();
        this._stopSpeak();
        this._setBusy(true);

        setTimeout(() => {
            let res;
            try {
                res = this._execute(this._parse(text));
            } catch (err) {
                console.error('AiAssistant error:', err);
                res = { text: 'خطا در پردازش دستور: ' + (err && err.message ? err.message : 'نامشخص'), speak: '' };
            }
            this._setBusy(false);
            this._pushMessage('ai', res.text);
            this._render();
            if (this.state.speakEnabled) {
                const toSay = res.speak || this._plainForSpeech(res.text);
                if (toSay) this._speak(toSay);
            }
        }, 200);
    },

    _setBusy(on) {
        this.state.busy = on;
        const box = document.getElementById('ai-messages');
        const old = document.getElementById('ai-typing');
        if (on && box && !old) {
            const el = document.createElement('div');
            el.id = 'ai-typing';
            el.className = 'flex justify-start gap-2';
            el.innerHTML = `<div class="w-8 h-8 rounded-full overflow-hidden bg-white/10 flex-shrink-0 mt-0.5">
                    <img src="assets/logooo.png" class="w-full h-full object-cover" alt=""></div>
                <div class="bg-slate-700 text-gray-400 rounded-2xl rounded-tr-sm px-4 py-2 text-sm">
                    <i class="fas fa-ellipsis fa-fade"></i> در حال جستجو…
                </div>`;
            box.appendChild(el);
            box.scrollTop = box.scrollHeight;
        } else if (!on && old) {
            old.remove();
        }
    },

    // ═══════════════════════════════════════════════════════════
    //  Voice — STT / TTS
    // ═══════════════════════════════════════════════════════════
    toggleSpeak() {
        this.state.speakEnabled = !this.state.speakEnabled;
        if (!this.state.speakEnabled) this._stopSpeak();
        this._syncVoiceButton();
    },

    _syncVoiceButton() {
        const btn = document.getElementById('ai-voice-btn');
        if (!btn) return;
        const on = this.state.speakEnabled;
        btn.className = 'w-10 h-10 rounded-full flex items-center justify-center transition-all ' +
            (on ? 'bg-lime-600 text-gray-900 hover:bg-lime-500' : 'bg-slate-700 text-gray-400 hover:bg-slate-600');
        btn.innerHTML = `<i class="fas ${on ? 'fa-volume-high' : 'fa-volume-xmark'}"></i>`;
    },

    _pickVoice() {
        if (!window.speechSynthesis) return null;
        const voices = window.speechSynthesis.getVoices() || [];
        // اولویت: fa-IR دقیق، سپس هر صدای fa
        return voices.find(v => (v.lang || '').toLowerCase() === 'fa-ir')
            || voices.find(v => (v.lang || '').toLowerCase().startsWith('fa'))
            || null;
    },

    // صداهای مرورگر ممکن است با تأخیر لود شوند (voiceschanged)
    _ensureVoices(timeoutMs) {
        const limit = timeoutMs || 1500;
        if (!window.speechSynthesis) return Promise.resolve([]);
        const now = window.speechSynthesis.getVoices() || [];
        if (now.length) return Promise.resolve(now);
        return new Promise(resolve => {
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                try { window.speechSynthesis.onvoiceschanged = null; } catch (e) {}
                resolve(window.speechSynthesis.getVoices() || []);
            };
            try { window.speechSynthesis.onvoiceschanged = finish; } catch (e) {}
            setTimeout(finish, limit);
        });
    },

    // ── خواندن با سرویس محلی pocket-tts-farsi (fallback: Web Speech) ──
    _speak(text) {
        const t = String(text == null ? '' : text).trim();
        if (!t) return;
        if (this.state.useService) {
            this._speakFromService(t).catch(() => {
                this._markTtsOffline();
                if (!this.state.serviceFailedOnce) {
                    this.state.serviceFailedOnce = true;
                    console.warn('[AI] سرویس محلی TTS در دسترس نیست؛ استفاده از صدای مرورگر.');
                }
                this._speakLocal(t).catch(() => this._reportSpeechFailure());
            });
        } else {
            this._speakLocal(t).catch(() => this._reportSpeechFailure());
        }
    },

    _speakFromService(text) {
        const url = this.TTS_SERVICE_URL;
        if (!url || typeof fetch !== 'function') return Promise.reject(new Error('no-service'));
        return fetch(url.replace(/\/+$/, '') + '/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text })
        }).then(res => {
            if (!res.ok) throw new Error('tts-http-' + res.status);
            return res.blob();
        }).then(blob => {
            if (!blob || !blob.size) throw new Error('tts-empty');
            return new Promise((resolve, reject) => {
                try {
                    this._stopAudio();
                    const a = new Audio(URL.createObjectURL(blob));
                    this.state.audio = a;
                    a.onended = () => { this.state.audio = null; resolve(true); };
                    a.onerror = () => { this.state.audio = null; reject(new Error('audio-play')); };
                    a.play().catch(reject);
                    this._markTtsOnline();
                } catch (e) { reject(e); }
            });
        });
    },

    _speakLocal(text) {
        return new Promise((resolve, reject) => {
            if (!text) { reject(new Error('empty')); return; }
            if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
                reject(new Error('no-speech-synthesis'));
                return;
            }
            this._ensureVoices().then(() => {
                const voices = window.speechSynthesis.getVoices() || [];
                if (!voices.length) { reject(new Error('no-voices')); return; }
                try { window.speechSynthesis.cancel(); } catch (e) {}
                // نکته: Chrome اگر بلافاصله پس از cancel، speak صدا زده شود utterance را نادیده می‌گیرد
                setTimeout(() => {
                    try {
                        const utt = new SpeechSynthesisUtterance(String(text));
                        utt.lang = 'fa-IR';
                        utt.rate = 1.0;
                        utt.pitch = 1.0;
                        const v = this._pickVoice();
                        if (v) utt.voice = v;
                        let started = false;
                        const startTimer = setTimeout(() => {
                            if (started) return;
                            try { window.speechSynthesis.cancel(); } catch (e) {}
                            reject(new Error('speech-not-started'));
                        }, 3000);
                        utt.onstart = () => { started = true; clearTimeout(startTimer); };
                        utt.onend = () => { clearTimeout(startTimer); resolve(true); };
                        utt.onerror = (e) => {
                            clearTimeout(startTimer);
                            reject(new Error('speech-' + ((e && e.error) || 'error')));
                        };
                        window.speechSynthesis.speak(utt);
                    } catch (e) { reject(e); }
                }, 60);
            });
        });
    },

    // ── گزارش یک‌بارهٔ علت پخش‌نشدن صدا ──
    _reportSpeechFailure() {
        if (this.state.voiceWarned) return;
        this.state.voiceWarned = true;
        const hasFa = !!(this._pickVoice());
        const msg = (this.state.ttsOnline === false)
            ? (hasFa
                ? 'صدا پخش نشد. مرورگر یک صدای فارسی دارد؛ اگر تب را کلیک کرده‌ای و باز هم بی‌صداست، صدای سیستم را بررسی کن.'
                : 'صدا پخش نشد چون نه سرویس محلی TTS فعال است و نه مرورگر «صدای فارسی» دارد.\n' +
                  'دو راه: ۱) اجرای سرویس محلی: «python tts_service/tts_server.py» ۲) استفاده از Edge یا نصب پک صدای فارسی ویندوز.')
            : 'صدا پخش نشد. اگر سرویس محلی را تازه شروع کرده‌ای، یک‌بار صفحه را رفرش کن.';
        this._pushMessage('ai', '🔇 ' + msg);
        this._render();
    },

    testVoice() {
        this.state.voiceWarned = false;
        this._stopSpeak();
        const sample = 'سلام، این یک آزمایش صدا است. یک، دو، سه.';
        if (this.state.useService) {
            this._speakFromService(sample)
                .then(() => { this._pushMessage('ai', '🔊 تست صدا پخش شد (سرویس محلی).'); this._render(); })
                .catch(() => this._speakLocal(sample)
                    .then(() => { this._pushMessage('ai', '🔊 تست صدا پخش شد (صدای مرورگر).'); this._render(); })
                    .catch(() => this._reportSpeechFailure()));
        } else {
            this._speakLocal(sample)
                .then(() => { this._pushMessage('ai', '🔊 تست صدا پخش شد (صدای مرورگر).'); this._render(); })
                .catch(() => this._reportSpeechFailure());
        }
    },

    _stopAudio() {
        try {
            if (this.state.audio) {
                this.state.audio.pause();
                this.state.audio.currentTime = 0;
                this.state.audio = null;
            }
        } catch (e) { /* silent */ }
    },

    _stopSpeak() {
        try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
        this._stopAudio();
    },

    // ── بررسی سلامت سرویس محلی TTS ──
    checkTtsService() {
        const url = this.TTS_SERVICE_URL;
        if (!url || typeof fetch !== 'function') { this._markTtsOffline(); return; }
        const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = setTimeout(() => { if (ctrl) ctrl.abort(); }, 2500);
        fetch(url.replace(/\/+$/, '') + '/health', { signal: ctrl ? ctrl.signal : undefined })
            .then(r => r.ok ? r.json() : Promise.reject(new Error('http')))
            .then(() => { clearTimeout(timer); this._markTtsOnline(); })
            .catch(() => { clearTimeout(timer); this._markTtsOffline(); });
    },

    _markTtsOnline() {
        this.state.ttsOnline = true;
        this._renderTtsStatus();
        this._renderDiagNote();
    },

    _markTtsOffline() {
        if (this.state.ttsOnline === false) return;
        this.state.ttsOnline = false;
        this._renderTtsStatus();
        this._renderDiagNote();
    },

    _renderTtsStatus() {
        const el = document.getElementById('ai-tts-status');
        if (!el) return;
        if (this.state.ttsOnline === null) { el.className = 'hidden'; return; }
        el.className = 'inline-flex items-center gap-1 text-[10px] border rounded-full px-2 py-0.5 ' +
            (this.state.ttsOnline
                ? 'border-lime-500/60 text-lime-300'
                : 'border-amber-500/60 text-amber-300');
        el.innerHTML = this.state.ttsOnline
            ? '<i class="fas fa-circle" style="font-size:6px"></i> صدای هوشمند فارسی متصل'
            : '<i class="fas fa-circle" style="font-size:6px"></i> صدای مرورگر';
        el.title = this.state.ttsOnline
            ? 'سرویس محلی pocket-tts-farsi در دسترس است'
            : 'سرویس محلی در دسترس نیست؛ از صدای مرورگر استفاده می‌شود';
    },

    toggleMic() {
        if (this.state.listening) { this._stopMic(); return; }
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
            this._pushMessage('ai', 'مرورگر شما از تشخیص گفتار پشتیبانی نمی‌کند. لطفاً از Chrome یا Edge استفاده کنید یا دستور را تایپ کنید.');
            this._render();
            return;
        }
        const rec = new SR();
        rec.lang = 'fa-IR';
        rec.continuous = false;
        rec.interimResults = true;
        this.state.recognition = rec;
        let finalText = '';

        rec.onstart = () => this._setListening(true);
        rec.onresult = (e) => {
            let interim = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                if (e.results[i].isFinal) finalText += e.results[i][0].transcript + ' ';
                else interim += e.results[i][0].transcript;
            }
            const inp = document.getElementById('ai-input');
            if (inp) inp.value = (finalText + interim).trim();
        };
        rec.onerror = (ev) => {
            this._setListening(false);
            if (ev && ev.error === 'not-allowed') {
                this._pushMessage('ai', 'دسترسی به میکروفون داده نشد. از تنظیمات مرورگر اجازه بده.');
                this._render();
            }
        };
        rec.onend = () => {
            this._setListening(false);
            const inp = document.getElementById('ai-input');
            const text = (finalText || (inp ? inp.value : '')).trim();
            if (text) setTimeout(() => this.ask(text), 150);
        };

        try { rec.start(); }
        catch (e) { this._setListening(false); }
    },

    _stopMic() {
        try { if (this.state.recognition) this.state.recognition.stop(); } catch (e) {}
        this._setListening(false);
    },

    _setListening(on) {
        this.state.listening = on;
        this._syncMicButton();
    },

    _syncMicButton() {
        const btn = document.getElementById('ai-mic-btn');
        if (!btn) return;
        const on = this.state.listening;
        btn.className = 'w-11 h-11 rounded-full flex items-center justify-center transition-all flex-shrink-0 ' +
            (on ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-700 text-gray-200 hover:bg-slate-600');
        btn.innerHTML = `<i class="fas ${on ? 'fa-stop' : 'fa-microphone'}"></i>`;
    },

    // ═══════════════════════════════════════════════════════════
    //  NLP — نرمال‌سازی و تشخیص intent
    // ═══════════════════════════════════════════════════════════
    _norm(text) {
        if (!text) return '';
        let s = String(text);
        s = s.replace(/[\u064B-\u065F\u0670]/g, '');                 // اعراب
        s = s.replace(/\u064A/g, '\u06CC');                          // ي → ی
        s = s.replace(/\u0643/g, '\u06A9');                          // ك → ک
        s = s.replace(/\u0629/g, '\u0647');                          // ة → ه
        s = s.replace(/\u200c/g, ' ');                               // نیم‌فاصله → فاصله
        s = s.replace(/[\u0660-\u0669]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48)); // ارقام عربی
        s = s.replace(/[\u06F0-\u06F9]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x06F0 + 48)); // ارقام فارسی
        s = s.replace(/[.,!?؟:؛\-_/\\()\[\]{}"'`«»…]+/g, ' ');
        s = s.replace(/\s+/g, ' ').trim().toLowerCase();
        return s;
    },

    _detectPath(norm) {
        if (!norm) return null;
        if (/(^|\s)در\s*حال\s*تحصیل(\s|$)|درحال\s*تحصیل/.test(norm)) return 'studying';
        if (/ملزوم/.test(norm)) return 'requirements';
        if (/دفاع/.test(norm)) return 'defense';
        if (/فارغ\s*التحصیلی|فارغالتحصیلی/.test(norm)) return 'educational';
        return null;
    },

    _stripStopwords(norm) {
        const stop = new Set(this.STOPWORDS);
        return String(norm || '')
            .split(' ')
            .filter(t => t && t.length >= 2 && !stop.has(t))
            .join(' ')
            .trim();
    },

    _allStepNames() {
        const EM = window.EmployeeModule || {};
        const names = [];
        const push = (n) => {
            if (!n) return;
            const nn = this._norm(n);
            if (!names.some(x => this._norm(x) === nn)) names.push(String(n));
        };
        const addArr = (arr) => (arr || []).forEach(x => push(typeof x === 'string' ? x : (x && x.name)));
        try {
            if (EM.getDefaultEducationalSteps) addArr(EM.getDefaultEducationalSteps());
            if (EM.getDefaultDefenseSteps2)     addArr(EM.getDefaultDefenseSteps2());
            if (EM.getDefaultStudyingSteps)     addArr(EM.getDefaultStudyingSteps());
            if (EM.getDefaultRequirementsSteps) addArr(EM.getDefaultRequirementsSteps());
        } catch (e) { /* ignore */ }
        try {
            const students = EM.getAllStudents ? EM.getAllStudents() : [];
            students.forEach(s => {
                ['educationalSteps', 'defenseSteps', 'requirementsSteps', 'studyingSteps'].forEach(k => {
                    if (Array.isArray(s[k])) addArr(s[k]);
                });
            });
        } catch (e) { /* ignore */ }
        return names;
    },

    _matchSteps(phrase) {
        const p = this._norm(phrase);
        if (!p) return null;
        const names = this._allStepNames();
        if (!names.length) return null;

        const exact = names.filter(n => this._norm(n) === p);
        if (exact.length) return { names: exact, label: exact[0], exact: true };

        const contains = names.filter(n => {
            const nn = this._norm(n);
            if (p.length < 3) return false;
            return nn.includes(p) || p.includes(nn);
        });
        if (contains.length) {
            contains.sort((a, b) => this._norm(a).length - this._norm(b).length);
            return { names: contains, label: contains[0], exact: false };
        }

        if (p.length < 3) return null;
        const pt = p.split(' ').filter(Boolean);
        let best = null, bestScore = 0;
        names.forEach(n => {
            const nt = this._norm(n).split(' ').filter(Boolean);
            let hit = 0;
            pt.forEach(t => { if (nt.some(x => x.includes(t) || t.includes(x))) hit++; });
            const score = hit / Math.max(pt.length, 1);
            if (score > bestScore) { bestScore = score; best = n; }
        });
        if (best && bestScore >= 0.6) return { names: [best], label: best, exact: false, fuzzy: true };
        return null;
    },

    _parse(raw) {
        const norm = this._norm(raw);
        const path = this._detectPath(norm);
        const phrase = this._stripStopwords(norm);
        const stepMatch = this._matchSteps(phrase);

        let intent;
        if (/راهنما|کمک|چیکار|چه کار|چطور کار/.test(norm)) intent = 'help';
        else if (/اطلاعات|مشخصات|پرونده|پروفایل|کیست|کیه/.test(norm)) intent = 'info';
        else if (stepMatch || path) intent = 'list';
        else if (/همه\s*دانشجو|کل\s*دانشجو|تمام\s*دانشجو|همه\s*ی\s*دانشجو/.test(norm)) intent = 'all';
        else intent = 'list';

        const wantsCount = /چند|چندتا|تعداد|شمار/.test(norm);

        return {
            raw,
            norm,
            path,
            phrase,
            stepMatch,
            intent,
            wantsCount,
        };
    },

    // ═══════════════════════════════════════════════════════════
    //  Query — کوئری ساختارمند روی داده دانشجویان
    // ═══════════════════════════════════════════════════════════
    _studentPath(s) {
        const EM = window.EmployeeModule;
        if (EM && typeof EM._getStudentActivePath === 'function') {
            try { return EM._getStudentActivePath(s); } catch (e) { /* fallback */ }
        }
        return s.currentPath || 'defense';
    },

    _getSteps(s, path) {
        const EM = window.EmployeeModule || {};
        if (path === 'defense')      return s.defenseSteps      || (EM.getDefaultDefenseSteps2 ? EM.getDefaultDefenseSteps2() : []);
        if (path === 'requirements') return s.requirementsSteps || (EM.getDefaultRequirementsSteps ? EM.getDefaultRequirementsSteps() : []);
        if (path === 'studying')     return s.studyingSteps || s.educationalSteps || (EM.getDefaultEducationalSteps ? EM.getDefaultEducationalSteps() : []);
        return s.educationalSteps || (EM.getDefaultEducationalSteps ? EM.getDefaultEducationalSteps() : []);
    },

    _pathLabel(p) { return (this.PATHS[p] && this.PATHS[p].label) || p || '—'; },

    _execute(parsed) {
        const EM = window.EmployeeModule;
        if (!EM || typeof EM.getAllStudents !== 'function') {
            return { text: 'ماژول دانشجویان یافت نشد. ابتدا وارد صفحه مدیریت دانشجویان شوید.', speak: '' };
        }

        const students = (EM.getAllStudents() || []).filter(s => s.active !== false);
        const mode = parsed.wantsCount ? 'count' : 'list';

        // ── راهنما ──
        if (parsed.intent === 'help') return { text: this._helpText(), speak: 'می‌توانی بگویی اسم دانشجویان یک مرحله را بخوان، تعداد آن‌ها را بپرس، یا نام یک مسیر مثل گردش دفاع را بگو.' };

        // ── اطلاعات یک دانشجو ──
        if (parsed.intent === 'info') {
            const q = parsed.phrase;
            const found = q ? students.filter(s =>
                this._norm(s.name || '').includes(q) ||
                (s.studentId && this._norm(s.studentId).includes(q))
            ) : [];
            if (!found.length) {
                return { text: `دانشجویی با «${parsed.phrase || parsed.raw}» پیدا نشد.\n\n` + this._helpText(), speak: 'دانشجویی با این نام پیدا نشد.' };
            }
            return this._infoResult(found);
        }

        // ── همه دانشجوها ──
        if (parsed.intent === 'all') {
            return this._listResult(students.map(s => ({ student: s, path: this._studentPath(s) })), 'همه دانشجویان', false, mode);
        }

        // ── کوئری مرحله ──
        if (parsed.stepMatch) {
            const stepNorms = parsed.stepMatch.names.map(n => this._norm(n));
            const exact = parsed.stepMatch.exact;
            const hits = [];

            students.forEach(s => {
                const activePath = this._studentPath(s);
                const order = parsed.path
                    ? [parsed.path]
                    : [activePath];

                for (const path of order) {
                    const steps = this._getSteps(s, path);
                    if (!Array.isArray(steps) || !steps.length) continue;
                    const idx = steps.findIndex(x => x && !x.completed);
                    if (idx === -1) continue;
                    const nm = this._norm(steps[idx].name);
                    const isHit = stepNorms.some(t =>
                        exact ? (nm === t) : (nm === t || nm.includes(t) || t.includes(nm))
                    );
                    if (isHit) {
                        hits.push({ student: s, path, step: steps[idx], isActivePath: path === activePath });
                        break;
                    }
                }
            });

            const desc = `مرحله «${parsed.stepMatch.label}»` +
                (parsed.path ? ` در مسیر ${this._pathLabel(parsed.path)}` : '');
            if (!hits.length) {
                return {
                    text: `دانشجویی در ${desc} پیدا نشد.\n\n` + this._hintSteps(),
                    speak: `دانشجویی در ${desc} پیدا نشد.`
                };
            }
            return this._listResult(hits, desc, !parsed.path, mode);
        }

        // ── کوئری مسیر ──
        if (parsed.path) {
            const hits = students
                .filter(s => this._studentPath(s) === parsed.path)
                .map(s => ({ student: s, path: parsed.path, isActivePath: true }));
            const desc = `مسیر «${this._pathLabel(parsed.path)}»`;
            if (!hits.length) return { text: `در ${desc} دانشجوی فعالی وجود ندارد.`, speak: `در ${desc} دانشجوی فعالی وجود ندارد.` };
            return this._listResult(hits, desc, false, mode);
        }

        // ── احتمالاً نام دانشجو ──
        if (parsed.phrase) {
            const found = students.filter(s => this._norm(s.name || '').includes(parsed.phrase));
            if (found.length) return this._infoResult(found);
        }

        return { text: this._helpText(), speak: 'دستور را متوجه نشدم. یک مثال بگو.' };
    },

    _listResult(items, desc, showPath, mode) {
        if (mode === 'count') {
            const n = this._faNum(items.length);
            const t = (desc === 'همه دانشجویان')
                ? `تعداد همه دانشجویان: ${n} نفر`
                : `تعداد دانشجویان ${desc}: ${n} نفر`;
            return { text: t, speak: t };
        }
        const header = `دانشجویان ${desc}: ${this._faNum(items.length)} نفر`;
        const lines = items.map((h, i) => {
            const name = (h.student && h.student.name) || 'بی‌نام';
            const extra = (showPath || (h.path && !h.isActivePath)) ? ` — ${this._pathLabel(h.path)}` : '';
            const cur = h.step && h.step.name ? ` (${h.step.name})` : '';
            return `${this._faNum(i + 1)}. ${name}${extra}${cur}`;
        });
        const text = `${header}\n\n${lines.join('\n')}`;
        const names = items.map(h => (h.student && h.student.name) || '').filter(Boolean);
        const speak = `${this._faNum(items.length)} دانشجو ${desc}. ` + names.join('، ');
        return { text, speak };
    },

    _infoResult(found) {
        const lines = found.slice(0, 10).map(s => {
            const path = this._studentPath(s);
            const steps = this._getSteps(s, path);
            const idx = Array.isArray(steps) ? steps.findIndex(x => x && !x.completed) : -1;
            const cur = idx === -1 ? 'تکمیل شده' : (steps[idx] && steps[idx].name) || '—';
            const done = Array.isArray(steps) ? steps.filter(x => x && x.completed).length : 0;
            const pct = steps && steps.length ? Math.round(done / steps.length * 100) : 0;
            return [
                `👤 ${s.name || 'بی‌نام'}`,
                `شماره دانشجویی: ${s.studentId || '—'}`,
                `مقطع: ${s.degree || '—'}`,
                `مسیر: ${this._pathLabel(path)}`,
                `مرحله فعلی: ${cur}`,
                `پیشرفت: ${this._faNum(pct)}٪ (${this._faNum(done)}/${this._faNum(steps ? steps.length : 0)})`,
                s.phone ? `تلفن: ${s.phone}` : null,
                s.email ? `ایمیل: ${s.email}` : null,
            ].filter(Boolean).join('\n');
        });
        const tail = found.length > 10 ? `\n\n… و ${this._faNum(found.length - 10)} مورد دیگر.` : '';
        return {
            text: lines.join('\n\n') + tail,
            speak: found.slice(0, 5).map(s => s.name).filter(Boolean).join('، ')
        };
    },

    _helpText() {
        return 'راهنمای دستورات:\n' +
            '• «اسم دانشجویانی که در مرحله استلال هستند را بخوان»\n' +
            '• «چند دانشجو در مرحله گردش دفاع هستند؟»\n' +
            '• «دانشجویان در حال تحصیل را لیست کن»\n' +
            '• «اسم دانشجویان مرحله فارغ‌التحصیلی را بخوان»\n' +
            '• «اطلاعات سجاد مصطفی»\n\n' +
            'می‌تونی دستور رو تایپ کنی یا با میکروفون بگی.';
    },

    _hintSteps() {
        const names = this._allStepNames();
        const sample = names.slice(0, 12).map(n => `• ${n}`).join('\n');
        return 'چند مرحله موجود:\n' + sample + (names.length > 12 ? '\n…' : '');
    },

    _faNum(n) {
        const digits = '۰۱۲۳۴۵۶۷۸۹';
        return String(n).replace(/\d/g, d => digits[+d]);
    },

    _plainForSpeech(text) {
        return String(text || '')
            .replace(/[•👤]/g, ' ')
            .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 500);
    },

    _esc(t) {
        return String(t == null ? '' : t)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },

    _escAttr(t) {
        return this._esc(t).replace(/"/g, '&quot;');
    },

}; // ← پایان AiAssistantModule
