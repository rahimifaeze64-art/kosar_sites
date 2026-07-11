// Archive Management Module
function archiveController() {
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
        
        // Load files from localStorage
        loadFiles() {
            const stored = localStorage.getItem('archiveFiles');
            if (stored) {
                this.files = JSON.parse(stored);
            } else {
                // Sample data
                this.files = [
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
                    },
                    {
                        id: 'f3',
                        name: 'رساله دکتری - تعدیل شده - علی محمدی.docx',
                        category: 'thesis-edited',
                        author: 'عامل علی محمدی',
                        type: 'docx',
                        size: '6.2 MB',
                        uploadDate: new Date(Date.now() - 172800000).toISOString(),
                        url: '#'
                    },
                    {
                        id: 'f4',
                        name: 'رساله - فایل منضده قبل مناقشه - علی محمدی.pdf',
                        category: 'thesis-pre-defense',
                        author: 'عامل علی محمدی',
                        type: 'pdf',
                        size: '4.5 MB',
                        uploadDate: new Date(Date.now() - 259200000).toISOString(),
                        url: '#'
                    },
                    {
                        id: 'f5',
                        name: 'مقاله علمی - زینب سجادی.pdf',
                        category: 'articles',
                        author: 'عامل زینب سجادی',
                        type: 'pdf',
                        size: '1.2 MB',
                        uploadDate: new Date(Date.now() - 345600000).toISOString(),
                        url: '#'
                    }
                ];
                this.saveFiles();
            }
        },
        
        // Save files to localStorage
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
        
        // Upload files
        uploadFiles() {
            if (!this.uploadCategory || !this.uploadAuthor || this.uploadQueue.length === 0) {
                alert('لطفاً تمام فیلدها را پر کنید');
                return;
            }
            
            this.uploadQueue.forEach(item => {
                const newFile = {
                    id: 'f' + Date.now() + Math.random().toString(36).substr(2, 9),
                    name: item.name,
                    category: this.uploadCategory,
                    author: this.uploadAuthor,
                    type: item.type,
                    size: item.size,
                    uploadDate: new Date().toISOString(),
                    url: URL.createObjectURL(item.file)
                };
                
                this.files.push(newFile);
            });
            
            this.saveFiles();
            this.uploadQueue = [];
            this.uploadCategory = '';
            this.uploadAuthor = '';
            
            // Reset file input
            document.querySelector('input[type="file"]').value = '';
            
            alert('فایل‌ها با موفقیت آپلود شدند');
        },
        
        // Download file
        downloadFile(file) {
            // In a real application, this would download the actual file
            alert(`دانلود فایل: ${file.name}`);
            // window.open(file.url, '_blank');
        },
        
        // View file
        viewFile(file) {
            // In a real application, this would open a file viewer
            alert(`مشاهده فایل: ${file.name}`);
            // window.open(file.url, '_blank');
        },
        
        // Delete file
        deleteFile(fileId) {
            if (confirm('آیا از حذف این فایل اطمینان دارید؟')) {
                this.files = this.files.filter(f => f.id !== fileId);
                this.saveFiles();
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
