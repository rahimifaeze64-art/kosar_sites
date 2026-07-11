// Archive Management Module
// ذخیره‌سازی: Supabase Storage (فایل واقعی) + archived_files جدول (متادیتا)
// + localStorage (cache/آفلاین)
function archiveController() {

    // ── Helper: Supabase در دسترس است؟ ──────────────────────
    function _sb() {
        return typeof SupabaseDataModule !== 'undefined' &&
               typeof SupabaseConnection !== 'undefined' &&
               SupabaseConnection.isOnline === true
               ? SupabaseDataModule : null;
    }

    function _currentUser() {
        try {
            return JSON.parse(
                localStorage.getItem('currentUser') ||
                localStorage.getItem('edu_system_current_user') || 'null'
            );
        } catch { return null; }
    }

    return {
        sidebarOpen: window.innerWidth >= 1024,
        selectedCategory: 'form1',
        viewMode: 'grid',
        searchQuery: '',
        uploadCategory: '',
        uploadAuthor: '',
        uploadQueue: [],
        
        // Archive Categories
        categories: [
            { id: 'form1', name: 'استماره 1', icon: 'fas fa-file-alt' },
            { id: 'form2', name: 'استماره 2', icon: 'fas fa-file-invoice' },
            { id: 'correspondence', name: 'همانندجویی‌ها', icon: 'fas fa-images' },
            { id: 'administrative', name: 'امر اداری‌ها', icon: 'fas fa-file-signature' },
            { id: 'thesis-original', name: 'رساله - فایل اولیه', icon: 'fas fa-book' },
            { id: 'thesis-edited', name: 'رساله - تعدیل شده', icon: 'fas fa-book-open' },
            { id: 'thesis-pre-defense', name: 'رساله - فایل منضده قبل مناقشه', icon: 'fas fa-file-contract' },
            { id: 'thesis-pre-defense-edit', name: 'رساله - تعدیل قبل مناقشه', icon: 'fas fa-edit' },
            { id: 'thesis-post-defense-edit', name: 'رساله - تعدیل بعد مناقشه', icon: 'fas fa-file-signature' },
            { id: 'thesis-iraqi-citation', name: 'رساله - استلال عراقی', icon: 'fas fa-quote-right' },
            { id: 'thesis-irandoc', name: 'رساله - تنضید ایران داک', icon: 'fas fa-file-pdf' },
            { id: 'articles', name: 'مقاله‌ها', icon: 'fas fa-newspaper' },
            { id: 'binding', name: 'تجلید', icon: 'fas fa-book-reader' },
            { id: 'files', name: 'فایل‌ها', icon: 'fas fa-folder' },
            { id: 'summary', name: 'تلخیص و ترجمه‌ها', icon: 'fas fa-language' },
            { id: 'other', name: 'سایر', icon: 'fas fa-ellipsis-h' }
        ],
        
        // Sample files data
        files: [],
        
        init() {
            this.loadFiles();
            this.setupResponsive();
        },
        
        // Load files — Supabase اگر آنلاین، localStorage اگر آفلاین
        async loadFiles() {
            const sb = _sb();
            if (sb) {
                try {
                    const cloudFiles = await sb.getArchiveFiles();
                    if (cloudFiles && cloudFiles.length > 0) {
                        this.files = cloudFiles;
                        console.log(`✅ ${cloudFiles.length} فایل آرشیو از Supabase بارگذاری شد`);
                        return;
                    }
                } catch (e) {
                    console.warn('⚠️ بارگذاری آرشیو از Supabase خطا:', e.message);
                }
            }
            // fallback به localStorage
            const stored = localStorage.getItem('archiveFiles');
            if (stored) {
                this.files = JSON.parse(stored);
            } else {
                this.files = this._getSampleFiles();
                this.saveFiles();
            }
        },

        // داده‌های نمونه اولیه
        _getSampleFiles() {
            return [
                {
                    id: 'f1',
                    name: 'استماره ثبت نام - احمد فتحی.pdf',
                    category: 'form1',
                    author: 'عامل احمد فتحی',
                    type: 'pdf',
                    size: '2.5 MB',
                    uploadDate: new Date().toISOString(),
                    url: '#'
                },
                {
                    id: 'f2',
                    name: 'رساله دکتری - فایل اولیه - علی محمدی.docx',
                    category: 'thesis-original',
                    author: 'عامل علی محمدی',
                    type: 'docx',
                    size: '5.8 MB',
                    uploadDate: new Date(Date.now() - 86400000).toISOString(),
                    url: '#'
                }
            ];
        },
        
        // Save files — localStorage + Supabase (فقط متادیتا، نه فایل واقعی)
        saveFiles() {
            localStorage.setItem('archiveFiles', JSON.stringify(this.files));
        },
        
        // Get filtered files based on category and search
        getFilteredFiles() {
            let filtered = this.files.filter(f => f.category === this.selectedCategory);
            
            if (this.searchQuery) {
                const query = this.searchQuery.toLowerCase();
                filtered = filtered.filter(f => 
                    f.name.toLowerCase().includes(query) ||
                    f.author.toLowerCase().includes(query)
                );
            }
            
            return filtered.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
        },
        
        // Get category count
        getCategoryCount(categoryId) {
            return this.files.filter(f => f.category === categoryId).length;
        },
        
        // Get total files count
        getTotalFiles() {
            return this.files.length;
        },
        
        // Get category name
        getCategoryName(categoryId) {
            const category = this.categories.find(c => c.id === categoryId);
            return category ? category.name : 'همه فایل‌ها';
        },
        
        // Get accepted file types based on selected category
        getAcceptedFileTypes() {
            // For correspondence and administrative categories, accept images and PDF
            if (this.uploadCategory === 'correspondence' || this.uploadCategory === 'administrative') {
                return 'image/*,.pdf';
            }
            // For other categories, accept all common file types
            return '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.bmp,.webp,.zip,.rar';
        },
        
        // Handle file upload
        handleFileUpload(event) {
            const files = Array.from(event.target.files);
            
            // Validate file types for correspondence and administrative categories
            if (this.uploadCategory === 'correspondence' || this.uploadCategory === 'administrative') {
                const invalidFiles = files.filter(file => 
                    !file.type.startsWith('image/') && file.type !== 'application/pdf'
                );
                if (invalidFiles.length > 0) {
                    alert('برای این دسته‌بندی فقط فایل‌های تصویری و PDF مجاز است');
                    event.target.value = '';
                    return;
                }
            }
            
            this.uploadQueue = files.map(file => ({
                file: file,
                name: file.name,
                size: this.formatFileSize(file.size),
                type: this.getFileType(file.name)
            }));
        },
        
        // Upload files — فایل واقعی به Storage + متادیتا به جدول
        async uploadFiles() {
            if (!this.uploadCategory || !this.uploadAuthor || this.uploadQueue.length === 0) {
                alert('لطفاً تمام فیلدها را پر کنید');
                return;
            }

            const sb = _sb();
            const user = _currentUser();

            for (const item of this.uploadQueue) {
                const fileId = 'f' + Date.now() + Math.random().toString(36).substr(2, 9);

                // ۱. آپلود فایل واقعی به Storage (اگر Supabase آنلاین)
                let fileUrl = URL.createObjectURL(item.file);
                let storagePath = null;

                if (sb) {
                    const uploaded = await sb.uploadArchiveFileToStorage(item.file, fileId);
                    if (uploaded) {
                        fileUrl = uploaded.url;
                        storagePath = uploaded.path;
                        console.log('✅ فایل در Storage آپلود شد:', storagePath);
                    } else {
                        console.warn('📴 آپلود Storage ناموفق — URL موقت استفاده می‌شود');
                    }
                }

                const newFile = {
                    id:          fileId,
                    name:        item.name,
                    category:    this.uploadCategory,
                    author:      this.uploadAuthor,
                    type:        item.type,
                    size:        item.size,
                    uploadDate:  new Date().toISOString(),
                    url:         fileUrl,
                    storagePath: storagePath,
                    uploadedById: user ? user.id : null
                };

                // ۲. ذخیره متادیتا — localStorage + Supabase
                this.files.unshift(newFile);
                if (sb) {
                    sb.saveArchiveFile(newFile)
                      .then(r => { if (r) console.log('✅ متادیتا در Supabase ذخیره شد:', fileId); })
                      .catch(e => console.warn('⚠️ saveArchiveFile خطا:', e.message));
                }
            }

            this.saveFiles();
            this.uploadQueue = [];
            this.uploadCategory = '';
            this.uploadAuthor = '';
            document.querySelector('input[type="file"]').value = '';

            const isOnline = typeof SupabaseConnection !== 'undefined' && SupabaseConnection.isOnline;
            alert(isOnline
                ? '✅ فایل‌ها در ابر ذخیره شدند'
                : '📴 فایل‌ها در حافظه محلی ذخیره شدند');
        },
        
        // Download file — اگر URL واقعی دارد دانلود می‌کند
        downloadFile(file) {
            if (!file.url || file.url === '#') {
                alert(`فایل "${file.name}" URL دانلود ندارد`);
                return;
            }
            const link = document.createElement('a');
            link.href = file.url;
            link.download = file.name;
            link.target = '_blank';
            link.click();
        },
        
        // View file — باز کردن در تب جدید
        viewFile(file) {
            if (!file.url || file.url === '#') {
                alert(`فایل "${file.name}" URL مشاهده ندارد`);
                return;
            }
            window.open(file.url, '_blank');
        },
        
        // Delete file — localStorage + Supabase Storage + جدول
        deleteFile(fileId) {
            if (!confirm('آیا از حذف این فایل اطمینان دارید؟')) return;

            const file = this.files.find(f => f.id === fileId);
            this.files = this.files.filter(f => f.id !== fileId);
            this.saveFiles();

            const sb = _sb();
            if (sb && file) {
                sb.deleteArchiveFile(fileId, file.storagePath || file.url)
                  .then(ok => { if (ok) console.log('✅ فایل از Supabase حذف شد:', fileId); })
                  .catch(e => console.warn('⚠️ deleteArchiveFile خطا:', e.message));
            }
        },
        
        // Filter files
        filterFiles() {
            // Filtering is handled by getFilteredFiles()
        },
        
        // Get file icon
        getFileIcon(type) {
            const icons = {
                'pdf': 'fas fa-file-pdf',
                'docx': 'fas fa-file-word',
                'doc': 'fas fa-file-word',
                'xlsx': 'fas fa-file-excel',
                'xls': 'fas fa-file-excel',
                'pptx': 'fas fa-file-powerpoint',
                'ppt': 'fas fa-file-powerpoint',
                'jpg': 'fas fa-file-image',
                'jpeg': 'fas fa-file-image',
                'png': 'fas fa-file-image',
                'gif': 'fas fa-file-image',
                'bmp': 'fas fa-file-image',
                'webp': 'fas fa-file-image',
                'svg': 'fas fa-file-image',
                'zip': 'fas fa-file-archive',
                'rar': 'fas fa-file-archive',
                'txt': 'fas fa-file-alt'
            };
            return icons[type] || 'fas fa-file';
        },
        
        // Get file color
        getFileColor(type) {
            const colors = {
                'pdf': '#e74c3c',
                'docx': '#3498db',
                'doc': '#3498db',
                'xlsx': '#27ae60',
                'xls': '#27ae60',
                'pptx': '#e67e22',
                'ppt': '#e67e22',
                'jpg': '#9b59b6',
                'jpeg': '#9b59b6',
                'png': '#9b59b6',
                'gif': '#9b59b6',
                'bmp': '#9b59b6',
                'webp': '#9b59b6',
                'svg': '#9b59b6',
                'zip': '#95a5a6',
                'rar': '#95a5a6',
                'txt': '#34495e'
            };
            return colors[type] || '#7f8c8d';
        },
        
        // Get file type from filename
        getFileType(filename) {
            const ext = filename.split('.').pop().toLowerCase();
            return ext;
        },
        
        // Format file size
        formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
        },
        
        // Format date
        formatDate(dateString) {
            const date = new Date(dateString);
            const now = new Date();
            const diff = now - date;
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            
            if (days === 0) return 'امروز';
            if (days === 1) return 'دیروز';
            if (days < 7) return `${days} روز پیش`;
            
            return date.toLocaleDateString('fa-IR');
        },
        
        // Setup responsive behavior
        setupResponsive() {
            window.addEventListener('resize', () => {
                if (window.innerWidth >= 1024) {
                    this.sidebarOpen = true;
                }
            });
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Archive module loaded');
});
