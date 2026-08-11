// ============================================================
// Personal Notes Module — ماژول یادداشت شخصی
// ذخیره‌سازی: localStorage | رنگ‌بندی موضوعی | جستجو | پین
// ============================================================

const PersonalNotesModule = {

    // ─── ثوابت ───────────────────────────────────────────────
    STORAGE_KEY: 'personalNotes_v1',
    CATEGORIES_KEY: 'personalNotes_categories_v1',

    // رنگ‌های پیش‌فرض هر دسته‌بندی
    CATEGORY_COLORS: {
        'عمومی':      { bg: '#3b82f6', light: '#eff6ff', border: '#93c5fd', text: '#1d4ed8' },
        'کاری':       { bg: '#10b981', light: '#ecfdf5', border: '#6ee7b7', text: '#047857' },
        'شخصی':       { bg: '#8b5cf6', light: '#f5f3ff', border: '#c4b5fd', text: '#6d28d9' },
        'ایده':       { bg: '#f59e0b', light: '#fffbeb', border: '#fcd34d', text: '#b45309' },
        'مهم':        { bg: '#ef4444', light: '#fef2f2', border: '#fca5a5', text: '#b91c1c' },
        'یادآوری':    { bg: '#06b6d4', light: '#ecfeff', border: '#67e8f9', text: '#0e7490' },
    },

    // ─── وضعیت داخلی ─────────────────────────────────────────
    state: {
        notes: [],
        categories: [],
        activeCategory: 'همه',
        searchQuery: '',
        editingNote: null,      // null = جدید | id = ویرایش
        sortMode: 'newest',     // newest | oldest | alpha | pinned
        viewMode: 'grid',       // grid | list
        showForm: false,
    },


    // ─── بارگذاری / ذخیره داده ───────────────────────────────
    loadNotes() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            this.state.notes = raw ? JSON.parse(raw) : [];
        } catch(e) { this.state.notes = []; }
    },

    saveNotes() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state.notes));
    },

    loadCategories() {
        try {
            const raw = localStorage.getItem(this.CATEGORIES_KEY);
            const saved = raw ? JSON.parse(raw) : [];
            // دسته‌های پیش‌فرض را همیشه اول بگذار
            const defaults = Object.keys(this.CATEGORY_COLORS);
            const custom = saved.filter(c => !defaults.includes(c));
            this.state.categories = [...defaults, ...custom];
        } catch(e) {
            this.state.categories = Object.keys(this.CATEGORY_COLORS);
        }
    },

    saveCategories() {
        localStorage.setItem(this.CATEGORIES_KEY, JSON.stringify(this.state.categories));
    },

    // ─── رنگ دسته ────────────────────────────────────────────
    getCategoryColor(cat) {
        return this.CATEGORY_COLORS[cat] || {
            bg: '#64748b', light: '#f8fafc', border: '#cbd5e1', text: '#334155'
        };
    },

    // ─── تبدیل تاریخ میلادی به شمسی ─────────────────────────
    toJalali(dateStr) {
        try {
            if (typeof moment !== 'undefined' && moment.loadPersian) {
                return moment(dateStr).locale('fa').format('jD jMMMM jYYYY');
            }
            const d = new Date(dateStr);
            return d.toLocaleDateString('fa-IR', { year:'numeric', month:'long', day:'numeric' });
        } catch(e) { return dateStr; }
    },

    timeAgo(dateStr) {
        const now = new Date();
        const d   = new Date(dateStr);
        const diff = Math.floor((now - d) / 1000);
        if (diff < 60)   return 'همین الان';
        if (diff < 3600) return `${Math.floor(diff/60)} دقیقه پیش`;
        if (diff < 86400) return `${Math.floor(diff/3600)} ساعت پیش`;
        if (diff < 604800) return `${Math.floor(diff/86400)} روز پیش`;
        return this.toJalali(dateStr);
    },


    // ─── فیلتر و مرتب‌سازی ───────────────────────────────────
    getFilteredNotes() {
        let notes = [...this.state.notes];

        // فیلتر دسته‌بندی
        if (this.state.activeCategory !== 'همه') {
            notes = notes.filter(n => n.category === this.state.activeCategory);
        }

        // فیلتر جستجو
        if (this.state.searchQuery.trim()) {
            const q = this.state.searchQuery.trim().toLowerCase();
            notes = notes.filter(n =>
                n.title.toLowerCase().includes(q) ||
                n.content.toLowerCase().includes(q) ||
                (n.tags || []).some(t => t.toLowerCase().includes(q))
            );
        }

        // مرتب‌سازی
        switch (this.state.sortMode) {
            case 'newest':
                notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
                break;
            case 'oldest':
                notes.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                break;
            case 'alpha':
                notes.sort((a, b) => a.title.localeCompare(b.title, 'fa'));
                break;
            case 'pinned':
                notes.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
                break;
        }

        // پین‌شده‌ها همیشه اول (در همه حالت‌ها)
        const pinned   = notes.filter(n => n.pinned);
        const unpinned = notes.filter(n => !n.pinned);
        return [...pinned, ...unpinned];
    },

    // ─── عملیات یادداشت ──────────────────────────────────────
    createNote(data) {
        const now = new Date().toISOString();
        const note = {
            id: 'note_' + Date.now(),
            title:    data.title    || 'یادداشت بدون عنوان',
            content:  data.content  || '',
            category: data.category || 'عمومی',
            tags:     data.tags     || [],
            pinned:   false,
            color:    data.color    || null,
            createdAt: now,
            updatedAt: now,
        };
        this.state.notes.unshift(note);
        this.saveNotes();
        return note;
    },

    updateNote(id, data) {
        const idx = this.state.notes.findIndex(n => n.id === id);
        if (idx === -1) return;
        this.state.notes[idx] = {
            ...this.state.notes[idx],
            ...data,
            updatedAt: new Date().toISOString(),
        };
        this.saveNotes();
    },

    deleteNote(id) {
        this.state.notes = this.state.notes.filter(n => n.id !== id);
        this.saveNotes();
        this.render();
    },

    togglePin(id) {
        const note = this.state.notes.find(n => n.id === id);
        if (note) {
            note.pinned = !note.pinned;
            note.updatedAt = new Date().toISOString();
            this.saveNotes();
            this.render();
        }
    },

    addCategory(name) {
        name = name.trim();
        if (!name || this.state.categories.includes(name)) return false;
        this.state.categories.push(name);
        this.saveCategories();
        return true;
    },

    deleteCategory(name) {
        const defaults = Object.keys(this.CATEGORY_COLORS);
        if (defaults.includes(name)) return false;
        this.state.categories = this.state.categories.filter(c => c !== name);
        // یادداشت‌های این دسته → عمومی
        this.state.notes.forEach(n => { if (n.category === name) n.category = 'عمومی'; });
        this.saveNotes();
        this.saveCategories();
        this.render();
        return true;
    },


    // ─── HTML اصلی صفحه ──────────────────────────────────────
    getPersonalNotesContent() {
        this.loadNotes();
        this.loadCategories();
        setTimeout(() => this.init(), 80);
        return `<div id="pnRoot" style="font-family:'Vazirmatn',sans-serif; direction:rtl; min-height:80vh;"></div>`;
    },

    init() {
        this.render();
    },

    render() {
        const root = document.getElementById('pnRoot');
        if (!root) return;
        root.innerHTML = this.buildPageHTML();
        this.attachEvents();
    },

    // ─── ساخت کل صفحه ────────────────────────────────────────
    buildPageHTML() {
        const notes    = this.getFilteredNotes();
        const total    = this.state.notes.length;
        const pinCount = this.state.notes.filter(n => n.pinned).length;

        return `
        <div style="max-width:1200px; margin:0 auto;">

          ${this.buildStatsBar(total, pinCount)}
          ${this.buildToolbar()}
          ${this.buildCategoryTabs()}

          <div style="display:flex; gap:20px; align-items:flex-start;">
            <div style="flex:1; min-width:0;">
              ${this.state.showForm ? this.buildNoteForm() : ''}
              ${notes.length === 0 ? this.buildEmptyState() : this.buildNotesList(notes)}
            </div>
          </div>
        </div>
        ${this.buildStyles()}`;
    },


    // ─── نوار آمار ───────────────────────────────────────────
    buildStatsBar(total, pinCount) {
        const catCounts = {};
        this.state.notes.forEach(n => {
            catCounts[n.category] = (catCounts[n.category] || 0) + 1;
        });
        const topCat = Object.entries(catCounts).sort((a,b)=>b[1]-a[1])[0];

        return `
        <div class="pn-stats-bar">
          <div class="pn-stat-card" style="background:linear-gradient(135deg,#f59e0b,#d97706);">
            <i class="fas fa-thumbtack" style="font-size:1.5rem;opacity:.8;"></i>
            <div>
              <div style="font-size:1.8rem;font-weight:700;">${total}</div>
              <div style="font-size:.75rem;opacity:.85;">کل یادداشت‌ها</div>
            </div>
          </div>
          <div class="pn-stat-card" style="background:linear-gradient(135deg,#f59e0b,#d97706);">
            <i class="fas fa-thumbtack" style="font-size:1.5rem;opacity:.8;"></i>
            <div>
              <div style="font-size:1.8rem;font-weight:700;">${pinCount}</div>
              <div style="font-size:.75rem;opacity:.85;">پین‌شده</div>
            </div>
          </div>
          <div class="pn-stat-card" style="background:linear-gradient(135deg,#f59e0b,#d97706);">
            <i class="fas fa-thumbtack" style="font-size:1.5rem;opacity:.8;"></i>
            <div>
              <div style="font-size:1.8rem;font-weight:700;">${this.state.categories.length}</div>
              <div style="font-size:.75rem;opacity:.85;">دسته‌بندی</div>
            </div>
          </div>
          <div class="pn-stat-card" style="background:linear-gradient(135deg,#f59e0b,#d97706);">
            <i class="fas fa-thumbtack" style="font-size:1.5rem;opacity:.8;"></i>
            <div>
              <div style="font-size:1.1rem;font-weight:700;">${topCat ? topCat[0] : '—'}</div>
              <div style="font-size:.75rem;opacity:.85;">پرکارترین دسته</div>
            </div>
          </div>
        </div>`;
    },


    // ─── نوار ابزار ──────────────────────────────────────────
    buildToolbar() {
        return `
        <div class="pn-toolbar">
          <!-- جستجو -->
          <div style="position:relative;flex:1;min-width:200px;">
            <i class="fas fa-search" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);color:#94a3b8;"></i>
            <input id="pnSearch" type="text" placeholder="جستجو در یادداشت‌ها..."
                   value="${this.escHtml(this.state.searchQuery)}"
                   style="width:100%;padding:10px 38px 10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;
                          font-family:inherit;font-size:.9rem;outline:none;background:#fff;color:#1e293b;
                          box-sizing:border-box;">
          </div>

          <!-- مرتب‌سازی -->
          <select id="pnSort" style="padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;
                                     font-family:inherit;font-size:.85rem;background:#fff;color:#334155;cursor:pointer;">
            <option value="newest"  ${this.state.sortMode==='newest' ?'selected':''}>جدیدترین</option>
            <option value="oldest"  ${this.state.sortMode==='oldest' ?'selected':''}>قدیمی‌ترین</option>
            <option value="alpha"   ${this.state.sortMode==='alpha'  ?'selected':''}>الفبایی</option>
            <option value="pinned"  ${this.state.sortMode==='pinned' ?'selected':''}>پین‌شده اول</option>
          </select>

          <!-- نمای گرید/لیست -->
          <div style="display:flex;gap:4px;border:1.5px solid #e2e8f0;border-radius:10px;overflow:hidden;">
            <button id="pnViewGrid" class="pn-view-btn ${this.state.viewMode==='grid'?'active':''}" title="نمای کارت">
              <i class="fas fa-th-large"></i>
            </button>
            <button id="pnViewList" class="pn-view-btn ${this.state.viewMode==='list'?'active':''}" title="نمای لیست">
              <i class="fas fa-list"></i>
            </button>
          </div>

          <!-- دکمه یادداشت جدید -->
          <button id="pnBtnNew" class="pn-btn-primary">
            <i class="fas fa-plus"></i> یادداشت جدید
          </button>
        </div>`;
    },


    // ─── تب‌های دسته‌بندی ─────────────────────────────────────
    buildCategoryTabs() {
        const all = ['همه', ...this.state.categories];
        const tabs = all.map(cat => {
            const count = cat === 'همه'
                ? this.state.notes.length
                : this.state.notes.filter(n => n.category === cat).length;
            const col = cat === 'همه' ? {bg:'#64748b',text:'#fff'} : {bg: this.getCategoryColor(cat).bg, text:'#fff'};
            const isActive = this.state.activeCategory === cat;
            return `
            <button class="pn-cat-tab ${isActive?'active':''}"
                    data-cat="${this.escHtml(cat)}"
                    style="${isActive ? `background:${col.bg};color:${col.text};border-color:${col.bg};` : ''}">
              ${this.escHtml(cat)}
              <span class="pn-cat-badge" style="${isActive?`background:rgba(255,255,255,.3);color:#fff;`:''}">
                ${count}
              </span>
            </button>`;
        }).join('');

        return `
        <div style="margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            ${tabs}
            <button id="pnBtnAddCat" class="pn-cat-tab" title="افزودن دسته‌بندی جدید"
                    style="border-style:dashed;color:#94a3b8;">
              <i class="fas fa-plus" style="font-size:.7rem;"></i> دسته جدید
            </button>
          </div>
        </div>`;
    },


    // ─── فرم ایجاد / ویرایش یادداشت ─────────────────────────
    buildNoteForm() {
        const isEdit = this.state.editingNote !== null;
        const note   = isEdit ? this.state.notes.find(n => n.id === this.state.editingNote) : null;

        const catOptions = this.state.categories.map(c =>
            `<option value="${this.escHtml(c)}" ${note && note.category===c ? 'selected' : (!note && c==='عمومی' ? 'selected' : '')}>
                ${this.escHtml(c)}
             </option>`
        ).join('');

        const noteColors = [
            {val:'',    bg:'#ffffff', label:'سفید'},
            {val:'yellow', bg:'#fef9c3', label:'زرد'},
            {val:'green',  bg:'#dcfce7', label:'سبز'},
            {val:'blue',   bg:'#dbeafe', label:'آبی'},
            {val:'pink',   bg:'#fce7f3', label:'صورتی'},
            {val:'purple', bg:'#f3e8ff', label:'بنفش'},
            {val:'orange', bg:'#ffedd5', label:'نارنجی'},
        ];
        const colorPickers = noteColors.map(c => `
            <button type="button" class="pn-color-pick ${note && note.color===c.val?'selected':(!note&&c.val===''?'selected':'')}"
                    data-color="${c.val}"
                    style="background:${c.bg}; width:26px; height:26px; border-radius:50%;
                           border: 2px solid ${note && note.color===c.val ? '#3b82f6' : (!note&&c.val===''?'#3b82f6':'#d1d5db')};
                           cursor:pointer; transition:transform .15s;"
                    title="${c.label}"></button>
        `).join('');

        return `
        <div class="pn-form-card" id="pnFormCard">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <h3 style="font-size:1.1rem;font-weight:700;color:#1e293b;margin:0;">
              <i class="fas ${isEdit?'fa-edit':'fa-plus-circle'}" style="color:#3b82f6;margin-left:8px;"></i>
              ${isEdit ? 'ویرایش یادداشت' : 'یادداشت جدید'}
            </h3>
            <button id="pnBtnCancelForm" style="background:none;border:none;cursor:pointer;color:#94a3b8;font-size:1.2rem;">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <!-- عنوان -->
          <input id="pnFormTitle" type="text" placeholder="عنوان یادداشت..."
                 value="${this.escHtml(note ? note.title : '')}"
                 style="width:100%;padding:12px;border:1.5px solid #e2e8f0;border-radius:10px;
                        font-family:inherit;font-size:1rem;margin-bottom:12px;box-sizing:border-box;
                        color:#1e293b;outline:none;">

          <!-- متن -->
          <textarea id="pnFormContent" placeholder="متن یادداشت را اینجا بنویسید..."
                    rows="6"
                    style="width:100%;padding:12px;border:1.5px solid #e2e8f0;border-radius:10px;
                           font-family:inherit;font-size:.95rem;resize:vertical;box-sizing:border-box;
                           color:#1e293b;outline:none;line-height:1.7;">${this.escHtml(note ? note.content : '')}</textarea>

          <!-- ردیف دسته / رنگ / برچسب -->
          <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px;align-items:flex-end;">
            <!-- دسته‌بندی -->
            <div style="flex:1;min-width:140px;">
              <label style="font-size:.8rem;color:#64748b;display:block;margin-bottom:4px;">دسته‌بندی</label>
              <select id="pnFormCategory"
                      style="width:100%;padding:9px 10px;border:1.5px solid #e2e8f0;border-radius:8px;
                             font-family:inherit;font-size:.9rem;background:#fff;color:#334155;">
                ${catOptions}
              </select>
            </div>

            <!-- برچسب‌ها -->
            <div style="flex:2;min-width:180px;">
              <label style="font-size:.8rem;color:#64748b;display:block;margin-bottom:4px;">برچسب‌ها <span style="color:#94a3b8;">(با کاما جدا کنید)</span></label>
              <input id="pnFormTags" type="text" placeholder="مثال: مهم، پروژه، ایده"
                     value="${note && note.tags ? note.tags.join(', ') : ''}"
                     style="width:100%;padding:9px 10px;border:1.5px solid #e2e8f0;border-radius:8px;
                            font-family:inherit;font-size:.9rem;box-sizing:border-box;color:#334155;outline:none;">
            </div>
          </div>

          <!-- رنگ پس‌زمینه -->
          <div style="margin-top:12px;">
            <label style="font-size:.8rem;color:#64748b;display:block;margin-bottom:6px;">رنگ یادداشت</label>
            <div id="pnColorPickers" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
              ${colorPickers}
            </div>
          </div>

          <!-- دکمه‌های فرم -->
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
            <button id="pnBtnCancelForm2" class="pn-btn-secondary">انصراف</button>
            <button id="pnBtnSaveNote" class="pn-btn-primary">
              <i class="fas fa-save" style="margin-left:6px;"></i>
              ${isEdit ? 'ذخیره تغییرات' : 'ذخیره یادداشت'}
            </button>
          </div>
        </div>`;
    },


    // ─── کارت‌های یادداشت (گرید) ─────────────────────────────
    buildNotesList(notes) {
        if (this.state.viewMode === 'list') return this.buildNotesListView(notes);

        const cards = notes.map(n => this.buildNoteCard(n)).join('');
        return `<div class="pn-grid">${cards}</div>`;
    },

    buildNoteCard(n) {
        const col  = this.getCategoryColor(n.category);
        const bgMap = {
            yellow:'#fef9c3', green:'#dcfce7', blue:'#dbeafe',
            pink:'#fce7f3',   purple:'#f3e8ff', orange:'#ffedd5'
        };
        const cardBg = n.color && bgMap[n.color] ? bgMap[n.color] : '#ffffff';
        const preview = n.content.length > 120 ? n.content.substring(0,120) + '...' : n.content;
        const tags = (n.tags || []).map(t =>
            `<span class="pn-tag">${this.escHtml(t)}</span>`
        ).join('');

        return `
        <div class="pn-card" data-id="${n.id}" style="background:${cardBg};">
          <!-- هدر کارت -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
            <span class="pn-cat-label" style="background:${col.light};color:${col.text};border:1px solid ${col.border};">
              ${this.escHtml(n.category)}
            </span>
            <div style="display:flex;gap:6px;">
              <button class="pn-icon-btn pn-pin-btn ${n.pinned?'pinned':''}" data-id="${n.id}" title="${n.pinned?'برداشتن پین':'پین کردن'}">
                <i class="fas fa-thumbtack"></i>
              </button>
              <button class="pn-icon-btn pn-edit-btn" data-id="${n.id}" title="ویرایش">
                <i class="fas fa-edit"></i>
              </button>
              <button class="pn-icon-btn pn-del-btn" data-id="${n.id}" title="حذف" style="color:#ef4444;">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          </div>

          <!-- عنوان -->
          <h4 style="font-size:.98rem;font-weight:700;color:#1e293b;margin:0 0 6px;
                     white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${this.escHtml(n.title)}">
            ${n.pinned ? '<i class="fas fa-thumbtack" style="color:#f59e0b;font-size:.75rem;margin-left:4px;"></i>' : ''}
            ${this.escHtml(n.title)}
          </h4>

          <!-- پیش‌نمایش متن -->
          <p style="font-size:.85rem;color:#475569;line-height:1.6;margin:0 0 10px;
                    white-space:pre-wrap;word-break:break-word;">
            ${this.escHtml(preview)}
          </p>

          <!-- برچسب‌ها -->
          ${tags ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">${tags}</div>` : ''}

          <!-- تاریخ -->
          <div style="font-size:.75rem;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:8px;margin-top:auto;">
            <i class="fas fa-clock" style="margin-left:4px;"></i>
            ${this.timeAgo(n.updatedAt)}
          </div>
        </div>`;
    },

    buildNotesListView(notes) {
        const rows = notes.map(n => {
            const col = this.getCategoryColor(n.category);
            const tags = (n.tags || []).map(t => `<span class="pn-tag">${this.escHtml(t)}</span>`).join('');
            return `
            <div class="pn-list-row" data-id="${n.id}">
              <div style="width:4px;border-radius:4px;background:${col.bg};flex-shrink:0;"></div>
              <div style="flex:1;min-width:0;padding:0 12px;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                  ${n.pinned ? '<i class="fas fa-thumbtack" style="color:#f59e0b;font-size:.75rem;"></i>' : ''}
                  <strong style="font-size:.95rem;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    ${this.escHtml(n.title)}
                  </strong>
                  <span class="pn-cat-label" style="background:${col.light};color:${col.text};border:1px solid ${col.border};flex-shrink:0;">
                    ${this.escHtml(n.category)}
                  </span>
                </div>
                <p style="font-size:.82rem;color:#64748b;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${this.escHtml(n.content.substring(0,100))}
                </p>
                ${tags ? `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:4px;">${tags}</div>` : ''}
              </div>
              <div style="display:flex;gap:6px;flex-shrink:0;align-items:center;">
                <span style="font-size:.72rem;color:#94a3b8;white-space:nowrap;">${this.timeAgo(n.updatedAt)}</span>
                <button class="pn-icon-btn pn-pin-btn ${n.pinned?'pinned':''}" data-id="${n.id}" title="پین">
                  <i class="fas fa-thumbtack"></i>
                </button>
                <button class="pn-icon-btn pn-edit-btn" data-id="${n.id}" title="ویرایش">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="pn-icon-btn pn-del-btn" data-id="${n.id}" title="حذف" style="color:#ef4444;">
                  <i class="fas fa-trash-alt"></i>
                </button>
              </div>
            </div>`;
        }).join('');

        return `<div class="pn-list-container">${rows}</div>`;
    },

    buildEmptyState() {
        const isFiltered = this.state.searchQuery || this.state.activeCategory !== 'همه';
        return `
        <div style="text-align:center;padding:60px 20px;color:#94a3b8;">
          <i class="fas ${isFiltered ? 'fa-search' : 'fa-sticky-note'}"
             style="font-size:3.5rem;margin-bottom:16px;display:block;opacity:.4;"></i>
          <h3 style="font-size:1.1rem;color:#64748b;margin-bottom:8px;">
            ${isFiltered ? 'یادداشتی پیدا نشد' : 'هنوز یادداشتی ندارید'}
          </h3>
          <p style="font-size:.85rem;margin-bottom:20px;">
            ${isFiltered ? 'فیلترها را تغییر دهید یا جستجوی جدیدی انجام دهید.' : 'اولین یادداشت خود را بنویسید!'}
          </p>
          ${!isFiltered ? `<button id="pnEmptyNew" class="pn-btn-primary"><i class="fas fa-plus" style="margin-left:6px;"></i>یادداشت جدید</button>` : ''}
        </div>`;
    },


    // ─── رویدادها ─────────────────────────────────────────────
    attachEvents() {
        // جستجو
        const search = document.getElementById('pnSearch');
        if (search) {
            search.addEventListener('input', e => {
                this.state.searchQuery = e.target.value;
                this.render();
            });
        }

        // مرتب‌سازی
        const sort = document.getElementById('pnSort');
        if (sort) {
            sort.addEventListener('change', e => {
                this.state.sortMode = e.target.value;
                this.render();
            });
        }

        // نمای گرید / لیست
        const btnGrid = document.getElementById('pnViewGrid');
        const btnList = document.getElementById('pnViewList');
        if (btnGrid) btnGrid.addEventListener('click', () => { this.state.viewMode = 'grid'; this.render(); });
        if (btnList) btnList.addEventListener('click', () => { this.state.viewMode = 'list'; this.render(); });

        // دکمه یادداشت جدید
        const btnNew = document.getElementById('pnBtnNew');
        if (btnNew) btnNew.addEventListener('click', () => {
            this.state.showForm = true;
            this.state.editingNote = null;
            this.render();
            document.getElementById('pnFormTitle')?.focus();
        });

        // دکمه empty state
        const btnEmptyNew = document.getElementById('pnEmptyNew');
        if (btnEmptyNew) btnEmptyNew.addEventListener('click', () => {
            this.state.showForm = true;
            this.state.editingNote = null;
            this.render();
            document.getElementById('pnFormTitle')?.focus();
        });

        // لغو فرم
        ['pnBtnCancelForm','pnBtnCancelForm2'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.addEventListener('click', () => {
                this.state.showForm = false;
                this.state.editingNote = null;
                this.render();
            });
        });

        // ذخیره یادداشت
        const btnSave = document.getElementById('pnBtnSaveNote');
        if (btnSave) btnSave.addEventListener('click', () => this.handleSaveNote());

        // انتخاب رنگ در فرم
        document.querySelectorAll('.pn-color-pick').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.pn-color-pick').forEach(b => {
                    b.style.border = '2px solid #d1d5db';
                    b.classList.remove('selected');
                });
                btn.style.border = '2px solid #3b82f6';
                btn.classList.add('selected');
            });
        });

        // تب‌های دسته‌بندی
        document.querySelectorAll('.pn-cat-tab[data-cat]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.state.activeCategory = btn.dataset.cat;
                this.render();
            });
        });

        // افزودن دسته جدید
        const btnAddCat = document.getElementById('pnBtnAddCat');
        if (btnAddCat) btnAddCat.addEventListener('click', () => this.promptAddCategory());

        // دکمه‌های کارت (پین / ویرایش / حذف)
        document.querySelectorAll('.pn-pin-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                this.togglePin(btn.dataset.id);
            });
        });

        document.querySelectorAll('.pn-edit-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                this.state.editingNote = btn.dataset.id;
                this.state.showForm = true;
                this.render();
                document.getElementById('pnFormTitle')?.focus();
            });
        });

        document.querySelectorAll('.pn-del-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                this.handleDeleteNote(btn.dataset.id);
            });
        });

        // کلیک روی کارت → باز کردن ویرایش
        document.querySelectorAll('.pn-card, .pn-list-row').forEach(card => {
            card.addEventListener('click', () => {
                this.state.editingNote = card.dataset.id;
                this.state.showForm = true;
                this.render();
                setTimeout(() => document.getElementById('pnFormContent')?.focus(), 50);
            });
        });
    },

    // ─── ذخیره فرم ───────────────────────────────────────────
    handleSaveNote() {
        const title    = document.getElementById('pnFormTitle')?.value.trim();
        const content  = document.getElementById('pnFormContent')?.value.trim();
        const category = document.getElementById('pnFormCategory')?.value;
        const tagsRaw  = document.getElementById('pnFormTags')?.value;
        const tags     = tagsRaw ? tagsRaw.split(',').map(t=>t.trim()).filter(Boolean) : [];
        const colorBtn = document.querySelector('.pn-color-pick.selected');
        const color    = colorBtn ? colorBtn.dataset.color : '';

        if (!title && !content) {
            this.showToast('لطفاً عنوان یا متن یادداشت را وارد کنید.', 'warning');
            return;
        }

        const data = { title: title || 'یادداشت بدون عنوان', content, category, tags, color };

        if (this.state.editingNote) {
            this.updateNote(this.state.editingNote, data);
            this.showToast('یادداشت ویرایش شد ✓', 'success');
        } else {
            this.createNote(data);
            this.showToast('یادداشت ذخیره شد ✓', 'success');
        }

        this.state.showForm = false;
        this.state.editingNote = null;
        this.render();
    },

    // ─── حذف با تأیید ────────────────────────────────────────
    handleDeleteNote(id) {
        const note = this.state.notes.find(n => n.id === id);
        if (!note) return;
        if (confirm(`یادداشت "${note.title}" حذف شود؟`)) {
            this.deleteNote(id);
            this.showToast('یادداشت حذف شد.', 'info');
        }
    },

    // ─── افزودن دسته‌بندی ─────────────────────────────────────
    promptAddCategory() {
        const name = prompt('نام دسته‌بندی جدید:');
        if (!name) return;
        if (this.addCategory(name)) {
            this.showToast(`دسته "${name}" اضافه شد ✓`, 'success');
            this.render();
        } else {
            this.showToast('این دسته‌بندی قبلاً وجود دارد.', 'warning');
        }
    },


    // ─── Toast notification ──────────────────────────────────
    showToast(msg, type = 'info') {
        const colors = {
            success: '#10b981', warning: '#f59e0b',
            info:    '#3b82f6', error:   '#ef4444'
        };
        const icons = {
            success: 'fa-check-circle', warning: 'fa-exclamation-triangle',
            info:    'fa-info-circle',  error:   'fa-times-circle'
        };
        const toast = document.createElement('div');
        toast.style.cssText = `
            position:fixed; bottom:24px; left:50%; transform:translateX(-50%) translateY(20px);
            background:${colors[type]||colors.info}; color:#fff; padding:12px 20px;
            border-radius:10px; font-family:Vazirmatn,sans-serif; font-size:.9rem;
            z-index:99999; display:flex; align-items:center; gap:8px;
            box-shadow:0 4px 20px rgba(0,0,0,.2); opacity:0;
            transition: opacity .3s, transform .3s; direction:rtl;`;
        toast.innerHTML = `<i class="fas ${icons[type]||icons.info}"></i> ${msg}`;
        document.body.appendChild(toast);
        requestAnimationFrame(() => {
            toast.style.opacity  = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)';
        });
        setTimeout(() => {
            toast.style.opacity   = '0';
            toast.style.transform = 'translateX(-50%) translateY(20px)';
            setTimeout(() => toast.remove(), 350);
        }, 2800);
    },

    // ─── escape HTML ─────────────────────────────────────────
    escHtml(str) {
        return String(str || '')
            .replace(/&/g,'&amp;').replace(/</g,'&lt;')
            .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    },


    // ─── استایل‌های داخلی ─────────────────────────────────────
    buildStyles() {
        return `
        <style>
        /* ── Layout ── */
        .pn-stats-bar {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 14px;
            margin-bottom: 20px;
        }
        .pn-stat-card {
            border-radius: 14px;
            padding: 16px 18px;
            color: #fff;
            display: flex;
            align-items: center;
            gap: 14px;
            box-shadow: 0 2px 12px rgba(0,0,0,.12);
        }
        .pn-toolbar {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            align-items: center;
            margin-bottom: 16px;
            background: #fff;
            padding: 12px 16px;
            border-radius: 14px;
            box-shadow: 0 1px 6px rgba(0,0,0,.06);
        }
        /* ── Grid / List ── */
        .pn-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
            gap: 16px;
        }
        .pn-card {
            border-radius: 14px;
            padding: 16px;
            box-shadow: 0 1px 8px rgba(0,0,0,.07);
            border: 1px solid #f1f5f9;
            transition: transform .15s, box-shadow .15s;
            cursor: pointer;
            display: flex;
            flex-direction: column;
        }
        .pn-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,.1); }
        .pn-list-container { display: flex; flex-direction: column; gap: 8px; }
        .pn-list-row {
            display: flex;
            align-items: center;
            background: #fff;
            border-radius: 12px;
            padding: 12px 14px;
            gap: 0;
            box-shadow: 0 1px 5px rgba(0,0,0,.05);
            cursor: pointer;
            transition: box-shadow .15s;
            border: 1px solid #f1f5f9;
        }
        .pn-list-row:hover { box-shadow: 0 3px 14px rgba(0,0,0,.09); }
        /* ── Form ── */
        .pn-form-card {
            background: #fff;
            border-radius: 16px;
            padding: 22px;
            box-shadow: 0 4px 24px rgba(0,0,0,.1);
            margin-bottom: 20px;
            border: 1px solid #e2e8f0;
        }
        .pn-form-card input:focus,
        .pn-form-card textarea:focus,
        .pn-form-card select:focus {
            border-color: #3b82f6 !important;
            box-shadow: 0 0 0 3px rgba(59,130,246,.12);
        }
        /* ── Tabs ── */
        .pn-cat-tab {
            padding: 6px 14px;
            border-radius: 20px;
            border: 1.5px solid #e2e8f0;
            background: #fff;
            font-family: Vazirmatn, sans-serif;
            font-size: .82rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all .15s;
            color: #475569;
        }
        .pn-cat-tab:hover { border-color: #93c5fd; background: #eff6ff; }
        .pn-cat-tab.active { font-weight: 600; }
        .pn-cat-badge {
            background: #f1f5f9;
            color: #64748b;
            border-radius: 10px;
            padding: 1px 7px;
            font-size: .72rem;
        }
        /* ── Labels / Tags ── */
        .pn-cat-label {
            font-size: .72rem;
            padding: 2px 8px;
            border-radius: 8px;
            font-weight: 600;
            white-space: nowrap;
        }
        .pn-tag {
            background: #f1f5f9;
            color: #475569;
            font-size: .72rem;
            padding: 2px 8px;
            border-radius: 8px;
        }
        /* ── Buttons ── */
        .pn-btn-primary {
            background: linear-gradient(135deg, #8cff49ff, #64f75eff);
            color: #fff;
            border: none;
            padding: 10px 18px;
            border-radius: 10px;
            font-family: Vazirmatn, sans-serif;
            font-size: .9rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            white-space: nowrap;
            transition: opacity .15s, transform .1s;
            font-weight: 600;
        }
        .pn-btn-primary:hover { opacity: .9; transform: translateY(-1px); }
        .pn-btn-secondary {
            background: #f8fafc;
            color: #64748b;
            border: 1.5px solid #e2e8f0;
            padding: 10px 18px;
            border-radius: 10px;
            font-family: Vazirmatn, sans-serif;
            font-size: .9rem;
            cursor: pointer;
            transition: background .15s;
        }
        .pn-btn-secondary:hover { background: #f1f5f9; }
        .pn-icon-btn {
            background: none;
            border: none;
            cursor: pointer;
            color: #94a3b8;
            padding: 4px 6px;
            border-radius: 6px;
            font-size: .85rem;
            transition: color .15s, background .15s;
            line-height: 1;
        }
        .pn-icon-btn:hover { background: #f1f5f9; color: #475569; }
        .pn-icon-btn.pinned { color: #f59e0b; }
        .pn-view-btn {
            background: #f8fafc;
            border: none;
            padding: 8px 12px;
            cursor: pointer;
            color: #94a3b8;
            font-size: .85rem;
            transition: all .15s;
        }
        .pn-view-btn.active { background: #3b82f6; color: #fff; }
        .pn-view-btn:hover:not(.active) { background: #e2e8f0; }
        /* ── Responsive ── */
        @media (max-width: 600px) {
            .pn-grid { grid-template-columns: 1fr; }
            .pn-stats-bar { grid-template-columns: repeat(2, 1fr); }
            .pn-toolbar { flex-direction: column; align-items: stretch; }
        }
        </style>`;
    },

}; // ← پایان PersonalNotesModule

// ─── تابع global برای استفاده در index.html ──────────────────
function getPersonalNotesContent() {
    return PersonalNotesModule.getPersonalNotesContent();
}
