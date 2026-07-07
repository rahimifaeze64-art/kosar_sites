// File Manager Module - مدیریت آپلود و دانلود فایل‌ها
const FileManagerModule = {
    // Upload file
    async uploadFile(orderId) {
        try {
            debugLogger(`Starting file upload for order: ${orderId}`, 'info');
            
            const currentUser = getCurrentUser();
            if (!currentUser) {
                UTILS.showNotification('کاربر فعلی یافت نشد', 'error');
                return;
            }
            
            // Create file input
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif';
            fileInput.multiple = false;
            
            fileInput.onchange = async (event) => {
                const file = event.target.files[0];
                if (!file) return;
                
                // Validate file
                if (!this.validateFile(file)) {
                    return;
                }
                
                // Show upload progress
                UTILS.showNotification('در حال آپلود فایل...', 'info');
                
                try {
                    await this.processFileUpload(orderId, file, currentUser);
                } catch (error) {
                    debugLogger('Error processing file upload', 'error', error);
                    UTILS.showNotification('خطا در آپلود فایل', 'error');
                }
            };
            
            fileInput.click();
            
        } catch (error) {
            debugLogger('Error initiating file upload', 'error', error);
            UTILS.showNotification('خطا در شروع آپلود فایل', 'error');
        }
    },
    
    // Validate file
    validateFile(file) {
        const maxSize = 10 * 1024 * 1024; // 10MB
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif'
        ];
        
        if (file.size > maxSize) {
            UTILS.showNotification('حجم فایل نباید بیشتر از 10 مگابایت باشد', 'error');
            return false;
        }
        
        if (!allowedTypes.includes(file.type)) {
            UTILS.showNotification('فرمت فایل مجاز نیست', 'error');
            return false;
        }
        
        return true;
    },
    
    // Process file upload
    async processFileUpload(orderId, file, currentUser) {
        try {
            // Try API first
            let useAPI = false;
            let fileData = null;
            
            try {
                if (typeof APIDataModule !== 'undefined') {
                    fileData = await APIDataModule.uploadFile(orderId, file);
                    useAPI = true;
                    debugLogger('File uploaded via API', 'success', fileData);
                }
            } catch (apiError) {
                debugLogger('API file upload failed, using localStorage fallback', 'warning', apiError);
                useAPI = false;
            }
            
            // Fallback to localStorage (simulate file upload)
            if (!useAPI) {
                fileData = await this.simulateFileUpload(orderId, file, currentUser);
                debugLogger('File uploaded via localStorage simulation', 'success', fileData);
            }
            
            UTILS.showNotification('فایل با موفقیت آپلود شد', 'success');
            
            // Refresh the files tab content
            setTimeout(() => {
                this.refreshFilesContent(orderId);
            }, 500);
            
        } catch (error) {
            debugLogger('Error in file upload process', 'error', error);
            throw error;
        }
    },
    
    // Simulate file upload for localStorage mode
    async simulateFileUpload(orderId, file, currentUser) {
        return new Promise((resolve, reject) => {
            try {
                const orders = DataModule.getOrders();
                const orderIndex = orders.findIndex(o => o.id === orderId);
                
                if (orderIndex === -1) {
                    reject(new Error('سفارش یافت نشد'));
                    return;
                }
                
                // Initialize files array if not exists
                if (!orders[orderIndex].files) {
                    orders[orderIndex].files = [];
                }
                
                // Create file data
                const fileData = {
                    id: UTILS.generateId(),
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    uploadedBy: currentUser.id,
                    uploadedByName: currentUser.name,
                    uploadedAt: new Date().toLocaleString('fa-IR'),
                    orderId: orderId,
                    // In real implementation, this would be a server URL
                    url: `#file-${UTILS.generateId()}`,
                    // For localStorage, we'll store base64 data (only for small files)
                    data: null
                };
                
                // For demo purposes, read file as base64 (only for small files < 1MB)
                if (file.size < 1024 * 1024) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        fileData.data = e.target.result;
                        
                        // Add file to order
                        orders[orderIndex].files.push(fileData);
                        
                        // Add to work log
                        if (!orders[orderIndex].workLog) orders[orderIndex].workLog = [];
                        orders[orderIndex].workLog.push({
                            id: UTILS.generateId(),
                            type: 'file_upload',
                            message: `فایل جدید آپلود شد: ${file.name}`,
                            notes: `توسط ${currentUser.name} - حجم: ${this.formatFileSize(file.size)}`,
                            timestamp: new Date().toISOString(),
                            userId: currentUser.id
                        });
                        
                        DataModule.saveOrders(orders);
                        resolve(fileData);
                    };
                    reader.onerror = () => reject(new Error('خطا در خواندن فایل'));
                    reader.readAsDataURL(file);
                } else {
                    // For larger files, just store metadata
                    orders[orderIndex].files.push(fileData);
                    
                    // Add to work log
                    if (!orders[orderIndex].workLog) orders[orderIndex].workLog = [];
                    orders[orderIndex].workLog.push({
                        id: UTILS.generateId(),
                        type: 'file_upload',
                        message: `فایل جدید آپلود شد: ${file.name}`,
                        notes: `توسط ${currentUser.name} - حجم: ${this.formatFileSize(file.size)}`,
                        timestamp: new Date().toISOString(),
                        userId: currentUser.id
                    });
                    
                    DataModule.saveOrders(orders);
                    resolve(fileData);
                }
                
            } catch (error) {
                reject(error);
            }
        });
    },
    
    // Download file
    async downloadFile(fileId) {
        try {
            debugLogger(`Starting file download: ${fileId}`, 'info');
            
            // Try API first
            let useAPI = false;
            try {
                if (typeof APIDataModule !== 'undefined') {
                    await APIDataModule.downloadFile(fileId);
                    useAPI = true;
                    debugLogger('File downloaded via API', 'success');
                }
            } catch (apiError) {
                debugLogger('API file download failed, using localStorage fallback', 'warning', apiError);
                useAPI = false;
            }
            
            // Fallback to localStorage
            if (!useAPI) {
                this.simulateFileDownload(fileId);
            }
            
        } catch (error) {
            debugLogger('Error downloading file', 'error', error);
            UTILS.showNotification('خطا در دانلود فایل', 'error');
        }
    },
    
    // Simulate file download for localStorage mode
    simulateFileDownload(fileId) {
        try {
            const orders = DataModule.getOrders();
            let fileData = null;
            
            // Find file in orders
            for (const order of orders) {
                if (order.files) {
                    fileData = order.files.find(f => f.id === fileId);
                    if (fileData) break;
                }
            }
            
            if (!fileData) {
                UTILS.showNotification('فایل یافت نشد', 'error');
                return;
            }
            
            if (fileData.data) {
                // Download base64 data
                const link = document.createElement('a');
                link.href = fileData.data;
                link.download = fileData.name;
                link.click();
                
                UTILS.showNotification('فایل دانلود شد', 'success');
            } else {
                // Simulate download for files without data
                UTILS.showNotification(`دانلود ${fileData.name} (شبیه‌سازی)`, 'info');
            }
            
            debugLogger('File download simulated', 'success', fileData);
            
        } catch (error) {
            debugLogger('Error in file download simulation', 'error', error);
            UTILS.showNotification('خطا در دانلود فایل', 'error');
        }
    },
    
    // Refresh files content
    refreshFilesContent(orderId) {
        try {
            const orders = DataModule.getOrders();
            const order = orders.find(o => o.id === orderId);
            
            if (!order) return;
            
            const currentUser = getCurrentUser();
            const contentArea = document.getElementById('order-page-content');
            
            if (contentArea) {
                // Reload the files tab
                contentArea.innerHTML = OrderTabsModule.getFilesTab(order, currentUser);
            }
            
        } catch (error) {
            debugLogger('Error refreshing files content', 'error', error);
        }
    },
    
    // Format file size
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    // Get file icon based on type
    getFileIcon(fileType) {
        const iconMap = {
            'application/pdf': 'fa-file-pdf',
            'application/msword': 'fa-file-word',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'fa-file-word',
            'text/plain': 'fa-file-text',
            'image/jpeg': 'fa-file-image',
            'image/jpg': 'fa-file-image',
            'image/png': 'fa-file-image',
            'image/gif': 'fa-file-image'
        };
        
        return iconMap[fileType] || 'fa-file';
    },
    
    // Delete file (for managers/assigned doctors)
    async deleteFile(fileId, orderId) {
        try {
            const currentUser = getCurrentUser();
            if (!currentUser) {
                UTILS.showNotification('کاربر فعلی یافت نشد', 'error');
                return;
            }
            
            if (!confirm('آیا مطمئن هستید که می‌خواهید این فایل را حذف کنید؟')) {
                return;
            }
            
            debugLogger(`Deleting file: ${fileId} from order: ${orderId}`, 'info');
            
            // Try API first
            let useAPI = false;
            try {
                if (typeof APIDataModule !== 'undefined') {
                    await APIDataModule.deleteFile(fileId);
                    useAPI = true;
                    debugLogger('File deleted via API', 'success');
                }
            } catch (apiError) {
                debugLogger('API file deletion failed, using localStorage fallback', 'warning', apiError);
                useAPI = false;
            }
            
            // Fallback to localStorage
            if (!useAPI) {
                const orders = DataModule.getOrders();
                const order = orders.find(o => o.id === orderId);
                
                if (!order || !order.files) {
                    UTILS.showNotification('فایل یافت نشد', 'error');
                    return;
                }
                
                const fileIndex = order.files.findIndex(f => f.id === fileId);
                if (fileIndex === -1) {
                    UTILS.showNotification('فایل یافت نشد', 'error');
                    return;
                }
                
                const fileName = order.files[fileIndex].name;
                order.files.splice(fileIndex, 1);
                
                // Add to work log
                if (!order.workLog) order.workLog = [];
                order.workLog.push({
                    id: UTILS.generateId(),
                    type: 'file_delete',
                    message: `فایل حذف شد: ${fileName}`,
                    notes: `توسط ${currentUser.name}`,
                    timestamp: new Date().toISOString(),
                    userId: currentUser.id
                });
                
                DataModule.saveOrders(orders);
                debugLogger('File deleted via localStorage', 'success');
            }
            
            UTILS.showNotification('فایل با موفقیت حذف شد', 'success');
            
            // Refresh the files content
            setTimeout(() => {
                this.refreshFilesContent(orderId);
            }, 500);
            
        } catch (error) {
            debugLogger('Error deleting file', 'error', error);
            UTILS.showNotification('خطا در حذف فایل', 'error');
        }
    }
};