// Personal Archive Module for Agents - بایگانی شخصی عامل‌ها
const PersonalArchiveModule = {
    // Current state
    selectedFolder: null,
    
    // Get personal archive content
    getPersonalArchiveContent(userId) {
        const folders = this.getFolders(userId);
        const files = this.getFiles(userId);
        
        return `
            <div class="space-y-6">
                <!-- Header -->
                <div class="flex justify-between items-center">
                    <h2 class="text-2xl font-bold text-white">
                        <i class="fas fa-folder-open text-indigo-400 ml-2"></i>
                        بایگانی شخصی من
                    </h2>
                    <div class="flex space-x-3 space-x-reverse">
                        <button onclick="PersonalArchiveModule.showNewFolderModal()" 
                                class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium">
                            <i class="fas fa-folder-plus ml-2"></i>
                            پوشه جدید
                        </button>
                        <button onclick="PersonalArchiveModule.showUploadFileModal()" 
                                class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium">
                            <i class="fas fa-upload ml-2"></i>
                            آپلود فایل
                        </button>
                    </div>
                </div>
                
                <!-- Stats Cards -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="bg-slate-800 rounded-lg p-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-gray-400 text-sm">تعداد پوشه‌ها</p>
                                <p class="text-2xl font-bold text-white">${folders.length}</p>
                            </div>
                            <i class="fas fa-folder text-3xl text-indigo-400"></i>
                        </div>
                    </div>
                    <div class="bg-slate-800 rounded-lg p-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-gray-400 text-sm">تعداد فایل‌ها</p>
                                <p class="text-2xl font-bold text-white">${files.length}</p>
                            </div>
                            <i class="fas fa-file text-3xl text-emerald-400"></i>
                        </div>
                    </div>
                    <div class="bg-slate-800 rounded-lg p-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-gray-400 text-sm">حجم کل</p>
                                <p class="text-2xl font-bold text-white">${this.getTotalSize(files)}</p>
                            </div>
                            <i class="fas fa-database text-3xl text-purple-400"></i>
                        </div>
                    </div>
                </div>
                
                <!-- Main Content -->
                <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <!-- Folders List -->
                    <div class="lg:col-span-1">
                        <div class="bg-slate-800 rounded-lg shadow-md p-4">
                            <h3 class="text-lg font-bold text-white mb-4">
                                <i class="fas fa-folder text-indigo-400 ml-2"></i>
                                پوشه‌ها
                            </h3>
                            <div class="space-y-2" id="folders-list">
                                ${folders.length === 0 ? `
                                    <div class="text-center py-4">
                                        <i class="fas fa-folder-open text-3xl text-gray-500 mb-2"></i>
                                        <p class="text-gray-400 text-sm">پوشه‌ای وجود ندارد</p>
                                    </div>
                                ` : folders.map(folder => this.getFolderCard(folder, userId)).join('')}
                            </div>
                        </div>
                    </div>
                    
                    <!-- Files Area -->
                    <div class="lg:col-span-3">
                        <div class="bg-slate-800 rounded-lg shadow-md p-4">
                            <div class="flex justify-between items-center mb-4">
                                <h3 class="text-lg font-bold text-white">
                                    <i class="fas fa-file text-emerald-400 ml-2"></i>
                                    ${this.selectedFolder ? this.selectedFolder.name : 'همه فایل‌ها'}
                                </h3>
                                ${this.selectedFolder ? `
                                    <button onclick="PersonalArchiveModule.clearFolderSelection()" 
                                            class="text-gray-400 hover:text-white text-sm">
                                        <i class="fas fa-times ml-1"></i>
                                        نمایش همه
                                    </button>
                                ` : ''}
                            </div>
                            
                            <div id="files-grid">
                                ${this.getFilesGrid(files, userId)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },
    
    // Get folder card
    getFolderCard(folder, userId) {
        const files = this.getFiles(userId).filter(f => f.folderId === folder.id);
        const isSelected = this.selectedFolder && this.selectedFolder.id === folder.id;
        
        return `
            <div onclick="PersonalArchiveModule.selectFolder('${folder.id}')" 
                 class="p-3 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-indigo-600' : 'bg-slate-700 hover:bg-slate-600'}">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-2 space-x-reverse">
                        <i class="fas fa-folder text-yellow-400"></i>
                        <span class="text-white font-medium">${folder.name}</span>
                    </div>
                    <span class="text-gray-400 text-sm">${files.length}</span>
                </div>
            </div>
        `;
    },
    
    // Get files grid
    getFilesGrid(files, userId) {
        const filteredFiles = this.selectedFolder 
            ? files.filter(f => f.folderId === this.selectedFolder.id)
            : files;
            
        if (filteredFiles.length === 0) {
            return `
                <div class="text-center py-12">
                    <i class="fas fa-file text-5xl text-gray-500 mb-4"></i>
                    <p class="text-gray-400">فایلی وجود ندارد</p>
                </div>
            `;
        }
        
        return `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${filteredFiles.map(file => this.getFileCard(file)).join('')}
            </div>
        `;
    },
    
    // Get file card
    getFileCard(file) {
        const icon = this.getFileIcon(file.type);
        const size = this.formatFileSize(file.size);
        
        return `
            <div class="bg-slate-700 rounded-lg p-4 hover:bg-slate-600 transition-colors">
                <div class="flex items-start justify-between mb-3">
                    <div class="flex items-center space-x-2 space-x-reverse">
                        <i class="${icon} text-2xl"></i>
                        <div>
                            <p class="text-white font-medium text-sm">${file.name}</p>
                            <p class="text-gray-400 text-xs">${size}</p>
                        </div>
                    </div>
                    <div class="flex space-x-1 space-x-reverse">
                        <button onclick="PersonalArchiveModule.downloadFile('${file.id}')" 
                                class="text-emerald-400 hover:text-emerald-300 p-1">
                            <i class="fas fa-download"></i>
                        </button>
                        <button onclick="PersonalArchiveModule.deleteFile('${file.id}')" 
                                class="text-red-400 hover:text-red-300 p-1">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="text-xs text-gray-400">
                    <i class="fas fa-calendar ml-1"></i>
                    ${new Date(file.uploadDate).toLocaleDateString('fa-IR')}
                </div>
            </div>
        `;
    },

    // Get file icon based on type
    getFileIcon(type) {
        const icons = {
            'pdf': 'fas fa-file-pdf text-red-400',
            'doc': 'fas fa-file-word text-blue-400',
            'docx': 'fas fa-file-word text-blue-400',
            'xls': 'fas fa-file-excel text-green-400',
            'xlsx': 'fas fa-file-excel text-green-400',
            'ppt': 'fas fa-file-powerpoint text-orange-400',
            'pptx': 'fas fa-file-powerpoint text-orange-400',
            'jpg': 'fas fa-file-image text-purple-400',
            'jpeg': 'fas fa-file-image text-purple-400',
            'png': 'fas fa-file-image text-purple-400',
            'gif': 'fas fa-file-image text-purple-400',
            'mp3': 'fas fa-file-audio text-pink-400',
            'wav': 'fas fa-file-audio text-pink-400',
            'mp4': 'fas fa-file-video text-indigo-400',
            'avi': 'fas fa-file-video text-indigo-400',
            'zip': 'fas fa-file-archive text-yellow-400',
            'rar': 'fas fa-file-archive text-yellow-400',
            'txt': 'fas fa-file-alt text-gray-400'
        };
        return icons[type] || 'fas fa-file text-gray-400';
    },
    
    // Format file size
    formatFileSize(bytes) {
        if (bytes === 0) return '0 بایت';
        const k = 1024;
        const sizes = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    },
    
    // Get total size
    getTotalSize(files) {
        const total = files.reduce((sum, file) => sum + file.size, 0);
        return this.formatFileSize(total);
    },
    
    // Get folders for user
    getFolders(userId) {
        const folders = JSON.parse(localStorage.getItem('personalArchive_folders') || '[]');
        return folders.filter(f => f.userId === userId);
    },
    
    // Get files for user
    getFiles(userId) {
        const files = JSON.parse(localStorage.getItem('personalArchive_files') || '[]');
        return files.filter(f => f.userId === userId);
    },
    
    // Select folder
    selectFolder(folderId) {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const folders = this.getFolders(currentUser.id);
        this.selectedFolder = folders.find(f => f.id === folderId);
        
        // Re-render content
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.innerHTML = this.getPersonalArchiveContent(currentUser.id);
        }
    },
    
    // Clear folder selection
    clearFolderSelection() {
        this.selectedFolder = null;
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        
        // Re-render content
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.innerHTML = this.getPersonalArchiveContent(currentUser.id);
        }
    },
    
    // Show new folder modal
    showNewFolderModal() {
        const modal = `
            <div id="newFolderModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div class="bg-slate-800 rounded-lg p-6 w-full max-w-md">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-xl font-bold text-white">
                            <i class="fas fa-folder-plus text-indigo-400 ml-2"></i>
                            پوشه جدید
                        </h3>
                        <button onclick="PersonalArchiveModule.closeModal('newFolderModal')" 
                                class="text-gray-400 hover:text-white">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="space-y-4">
                        <div>
                            <label class="block text-gray-300 mb-2">نام پوشه</label>
                            <input type="text" id="folderName" 
                                   class="w-full bg-slate-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                   placeholder="نام پوشه را وارد کنید">
                        </div>
                        
                        <div>
                            <label class="block text-gray-300 mb-2">توضیحات (اختیاری)</label>
                            <textarea id="folderDescription" 
                                      class="w-full bg-slate-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                      rows="3"
                                      placeholder="توضیحات پوشه را وارد کنید"></textarea>
                        </div>
                        
                        <div class="flex space-x-3 space-x-reverse">
                            <button onclick="PersonalArchiveModule.createFolder()" 
                                    class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium">
                                <i class="fas fa-check ml-2"></i>
                                ایجاد پوشه
                            </button>
                            <button onclick="PersonalArchiveModule.closeModal('newFolderModal')" 
                                    class="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-medium">
                                <i class="fas fa-times ml-2"></i>
                                انصراف
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modal);
    },
    
    // Create folder
    createFolder() {
        const name = document.getElementById('folderName').value.trim();
        const description = document.getElementById('folderDescription').value.trim();
        
        if (!name) {
            alert('لطفا نام پوشه را وارد کنید');
            return;
        }
        
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const folders = JSON.parse(localStorage.getItem('personalArchive_folders') || '[]');
        
        const newFolder = {
            id: 'folder_' + Date.now(),
            userId: currentUser.id,
            name: name,
            description: description,
            createdDate: new Date().toISOString()
        };
        
        folders.push(newFolder);
        localStorage.setItem('personalArchive_folders', JSON.stringify(folders));
        
        this.closeModal('newFolderModal');
        
        // Re-render content
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.innerHTML = this.getPersonalArchiveContent(currentUser.id);
        }
        
        alert('پوشه با موفقیت ایجاد شد');
    },
    
    // Show upload file modal
    showUploadFileModal() {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const folders = this.getFolders(currentUser.id);
        
        const modal = `
            <div id="uploadFileModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div class="bg-slate-800 rounded-lg p-6 w-full max-w-md">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-xl font-bold text-white">
                            <i class="fas fa-upload text-emerald-400 ml-2"></i>
                            آپلود فایل
                        </h3>
                        <button onclick="PersonalArchiveModule.closeModal('uploadFileModal')" 
                                class="text-gray-400 hover:text-white">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="space-y-4">
                        <div>
                            <label class="block text-gray-300 mb-2">انتخاب فایل</label>
                            <input type="file" id="fileInput" 
                                   class="w-full bg-slate-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                        </div>
                        
                        <div>
                            <label class="block text-gray-300 mb-2">پوشه</label>
                            <select id="fileFolderId" 
                                    class="w-full bg-slate-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                                <option value="">بدون پوشه</option>
                                ${folders.map(f => `<option value="${f.id}">${f.name}</option>`).join('')}
                            </select>
                        </div>
                        
                        <div>
                            <label class="block text-gray-300 mb-2">توضیحات (اختیاری)</label>
                            <textarea id="fileDescription" 
                                      class="w-full bg-slate-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                      rows="3"
                                      placeholder="توضیحات فایل را وارد کنید"></textarea>
                        </div>
                        
                        <div class="flex space-x-3 space-x-reverse">
                            <button onclick="PersonalArchiveModule.uploadFile()" 
                                    class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium">
                                <i class="fas fa-upload ml-2"></i>
                                آپلود
                            </button>
                            <button onclick="PersonalArchiveModule.closeModal('uploadFileModal')" 
                                    class="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-medium">
                                <i class="fas fa-times ml-2"></i>
                                انصراف
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modal);
    },
    
    // Upload file
    uploadFile() {
        const fileInput = document.getElementById('fileInput');
        const folderId = document.getElementById('fileFolderId').value;
        const description = document.getElementById('fileDescription').value.trim();
        
        if (!fileInput.files || fileInput.files.length === 0) {
            alert('لطفا یک فایل انتخاب کنید');
            return;
        }
        
        const file = fileInput.files[0];
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const files = JSON.parse(localStorage.getItem('personalArchive_files') || '[]');
        
        // Get file extension
        const fileName = file.name;
        const fileExtension = fileName.split('.').pop().toLowerCase();
        
        const newFile = {
            id: 'file_' + Date.now(),
            userId: currentUser.id,
            folderId: folderId || null,
            name: fileName,
            type: fileExtension,
            size: file.size,
            description: description,
            uploadDate: new Date().toISOString(),
            url: URL.createObjectURL(file) // For demo purposes
        };
        
        files.push(newFile);
        localStorage.setItem('personalArchive_files', JSON.stringify(files));
        
        this.closeModal('uploadFileModal');
        
        // Re-render content
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.innerHTML = this.getPersonalArchiveContent(currentUser.id);
        }
        
        alert('فایل با موفقیت آپلود شد');
    },
    
    // Download file
    downloadFile(fileId) {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const files = this.getFiles(currentUser.id);
        const file = files.find(f => f.id === fileId);
        
        if (file) {
            alert('دانلود فایل: ' + file.name);
            // In a real application, this would trigger an actual download
        }
    },
    
    // Delete file
    deleteFile(fileId) {
        if (!confirm('آیا از حذف این فایل اطمینان دارید؟')) {
            return;
        }
        
        const files = JSON.parse(localStorage.getItem('personalArchive_files') || '[]');
        const updatedFiles = files.filter(f => f.id !== fileId);
        localStorage.setItem('personalArchive_files', JSON.stringify(updatedFiles));
        
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        
        // Re-render content
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.innerHTML = this.getPersonalArchiveContent(currentUser.id);
        }
        
        alert('فایل با موفقیت حذف شد');
    },
    
    // Close modal
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.remove();
        }
    }
};
