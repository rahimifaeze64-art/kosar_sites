/**
 * سیستم مدیریت پیشرفت کار رساله دانشگاهی
 * Thesis Workflow Management System
 */

class ThesisWorkflow {
    constructor() {
        this.currentStep = 0;
        this.workflowData = {};
        this.selectedStepIndex = null; // مرحله انتخاب شده برای نمایش جزئیات
        this.init();
    }

    // تعریف مراحل کاری
    getWorkflowSteps() {
        return [
            {
                id: 'start',
                title: 'شروع',
                description: 'آغاز فرآیند نوشتن رساله',
                status: 'pending',
                actor: 'system',
                canEdit: true,
                canTerminate: true
            },
            {
                id: 'title_proposal',
                title: 'طرح عنوان',
                description: 'ارائه و تعیین عنوان رساله',
                status: 'pending',
                actor: 'student',
                canEdit: true,
                canTerminate: true,
                requirements: []
            },
            {
                id: 'company_review_1',
                title: 'شرکت (بررسی اولیه)',
                description: 'بررسی عنوان توسط شرکت',
                status: 'pending',
                actor: 'company',
                canEdit: true,
                canTerminate: true
            },
            {
                id: 'scientific_group',
                title: 'گروه علمی',
                description: 'بررسی و تایید عنوان توسط گروه علمی',
                status: 'pending',
                actor: 'scientific_group',
                canEdit: true,
                canTerminate: true,
                canReject: true,
                rejectTo: 'title_proposal'
            },
            {
                id: 'company_send_to_author',
                title: 'شرکت (ارسال به نویسنده)',
                description: 'ارسال طرح تصویب شده به نویسنده',
                status: 'pending',
                actor: 'company',
                canEdit: true,
                canTerminate: true
            },
            {
                id: 'company_student_collab',
                title: 'شرکت (همکاری دانشجو)',
                description: 'همکاری دانشجو یا معقب با شرکت',
                status: 'pending',
                actor: 'student_company',
                canEdit: true,
                canTerminate: true
            },
            {
                id: 'scientific_group_2',
                title: 'گروه علمی (مرحله دوم)',
                description: 'بررسی مجدد توسط گروه علمی',
                status: 'pending',
                actor: 'scientific_group',
                canEdit: true,
                canTerminate: true
            },
            {
                id: 'company_admin',
                title: 'شرکت (امور اداری)',
                description: 'انجام امور اداری',
                status: 'pending',
                actor: 'company',
                canEdit: true,
                canTerminate: true
            },
            {
                id: 'admin_order',
                title: 'امر اداری',
                description: 'صدور امر اداری',
                status: 'pending',
                actor: 'admin',
                canEdit: true,
                canTerminate: true
            },
            {
                id: 'author_writing',
                title: 'نگارش پایان‌نامه',
                description: 'نوشتن پایان‌نامه توسط نویسنده',
                status: 'pending',
                actor: 'author',
                canEdit: true,
                canTerminate: true,
                requirements: ['summary_translation', 'two_articles']
            },
            {
                id: 'company_delivery',
                title: 'شرکت (تحویل به منضد)',
                description: 'تحویل پایان‌نامه به منضد',
                status: 'pending',
                actor: 'company',
                canEdit: true,
                canTerminate: true
            },
            {
                id: 'company_student_final',
                title: 'شرکت (دانشجو - مرحله نهایی)',
                description: 'همکاری نهایی دانشجو',
                status: 'pending',
                actor: 'student_company',
                canEdit: true,
                canTerminate: true
            },
            {
                id: 'professor_review',
                title: 'استاد (بررسی نهایی)',
                description: 'بررسی و تایید نهایی توسط استاد',
                status: 'pending',
                actor: 'professor',
                canEdit: true,
                canTerminate: true,
                canReject: true,
                rejectTo: 'typesetting'
            },
            {
                id: 'company_final',
                title: 'شرکت (مرحله نهایی)',
                description: 'تکمیل فرآیند توسط شرکت',
                status: 'pending',
                actor: 'company',
                canEdit: true,
                canTerminate: true
            },
            {
                id: 'reasoning',
                title: 'استدلال',
                description: 'ارائه استدلال نهایی',
                status: 'pending',
                actor: 'student',
                canEdit: true,
                canTerminate: true
            },
            {
                id: 'typesetting',
                title: 'تنضید',
                description: 'تنضید نهایی پایان‌نامه',
                status: 'pending',
                actor: 'typesetter',
                canEdit: true,
                canTerminate: true
            },
            {
                id: 'completion',
                title: 'پایان',
                description: 'تکمیل فرآیند نوشتن رساله',
                status: 'pending',
                actor: 'system',
                canEdit: false,
                canTerminate: false
            }
        ];
    }

    // تعریف نیازمندی‌های اضافی
    getAdditionalRequirements() {
        return {
            summary_translation: {
                id: 'summary_translation',
                title: 'تلخیص و ترجمه',
                description: 'تهیه تلخیص و ترجمه',
                status: 'pending'
            },
            two_articles: {
                id: 'two_articles',
                title: 'دو مقاله',
                description: 'تهیه دو مقاله (اختیاری)',
                status: 'pending',
                optional: true
            },
            admin_order_req: {
                id: 'admin_order_req',
                title: 'امر اداری',
                description: 'انجام امور اداری مورد نیاز',
                status: 'pending'
            }
        };
    }

    init() {
        this.steps = this.getWorkflowSteps();
        this.requirements = this.getAdditionalRequirements();
        this.loadWorkflowData();
        
        // فقط اگر کانتینر وجود داشت رندر کن
        const container = document.getElementById('thesis-workflow-container');
        if (container) {
            this.renderWorkflow();
        } else {
            console.warn('Thesis workflow container not found. Waiting for container...');
            // تلاش مجدد بعد از کمی تاخیر
            setTimeout(() => {
                const retryContainer = document.getElementById('thesis-workflow-container');
                if (retryContainer) {
                    this.renderWorkflow();
                    this.bindEvents();
                }
            }, 200);
            return;
        }
        
        this.bindEvents();
    }
    // بارگذاری داده‌های ذخیره شده
    loadWorkflowData() {
        const savedData = localStorage.getItem('thesis_workflow_data');
        if (savedData) {
            this.workflowData = JSON.parse(savedData);
            this.currentStep = this.workflowData.currentStep || 0;
            
            // بروزرسانی وضعیت مراحل
            if (this.workflowData.steps) {
                this.steps.forEach((step, index) => {
                    if (this.workflowData.steps[step.id]) {
                        Object.assign(step, this.workflowData.steps[step.id]);
                    }
                });
            }
        }
    }

    // ذخیره داده‌ها
    saveWorkflowData() {
        this.workflowData.currentStep = this.currentStep;
        this.workflowData.steps = {};
        
        this.steps.forEach(step => {
            this.workflowData.steps[step.id] = {
                status: step.status,
                completedAt: step.completedAt,
                notes: step.notes,
                assignedTo: step.assignedTo
            };
        });
        
        localStorage.setItem('thesis_workflow_data', JSON.stringify(this.workflowData));
    }

    // رندر کردن رابط کاربری
    renderWorkflow() {
        const container = document.getElementById('thesis-workflow-container');
        if (!container) return;

        // اگر مرحله‌ای انتخاب شده، جزئیات آن را نمایش بده
        if (this.selectedStepIndex !== null) {
            container.innerHTML = this.renderStepDetails(this.selectedStepIndex);
            return;
        }

        // نمایش نمای کلی مراحل (2 ستونی)
        container.innerHTML = `
            <div class="workflow-header">
                <h3><i class="fas fa-tasks"></i> پیشرفت کار رساله</h3>
                <div class="workflow-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${this.getProgressPercentage()}%"></div>
                    </div>
                    <span class="progress-text">${this.getProgressPercentage()}% تکمیل شده</span>
                </div>
            </div>
            
            <!-- نمایش 2 ستونی مراحل -->
            <div class="workflow-steps-two-columns">
                ${this.renderStepsTwoColumns()}
            </div>
            
            <!-- دکمه‌های عملیات -->
            <div class="workflow-actions">
                <button class="btn btn-dark" onclick="window.currentThesisWorkflow.showStepEditor()">
                    <i class="fas fa-edit"></i> ویرایش مرحله فعلی
                </button>
                <button class="btn btn-warning" onclick="window.currentThesisWorkflow.showTerminateDialog()">
                    <i class="fas fa-stop"></i> خاتمه فرآیند
                </button>
                <button class="btn btn-info" onclick="window.currentThesisWorkflow.exportReport()">
                    <i class="fas fa-download"></i> گزارش پیشرفت
                </button>
                <button class="btn btn-secondary" onclick="window.currentThesisWorkflow.resetWorkflow()">
                    <i class="fas fa-redo"></i> بازنشانی
                </button>
            </div>
        `;
    }

    // رندر کردن مراحل به صورت 2 ستونی
    renderStepsTwoColumns() {
        const midPoint = Math.ceil(this.steps.length / 2);
        const column1 = this.steps.slice(0, midPoint);
        const column2 = this.steps.slice(midPoint);
        
        return `
            <div class="workflow-columns">
                <!-- ستون اول -->
                <div class="workflow-column">
                    ${column1.map((step, index) => this.renderStepCard(step, index)).join('')}
                </div>
                
                <!-- ستون دوم -->
                <div class="workflow-column">
                    ${column2.map((step, index) => this.renderStepCard(step, index + midPoint)).join('')}
                </div>
            </div>
        `;
    }

    // رندر کردن کارت هر مرحله
    renderStepCard(step, index) {
        const isCompleted = step.status === 'completed';
        const isActive = index === this.currentStep;
        const isRejected = step.status === 'rejected';
        
        let statusClass = 'pending';
        if (isCompleted) {
            statusClass = 'completed';
        } else if (isRejected) {
            statusClass = 'rejected';
        } else if (isActive) {
            statusClass = 'active';
        }
        
        return `
            <div class="step-wrapper">
                <div class="step-card-simple ${statusClass}" 
                     onclick="window.currentThesisWorkflow.selectStep(${index})"
                     title="کلیک کنید برای مشاهده جزئیات">
                    <div class="step-number-circle ${statusClass}">
                        ${isCompleted ? '<i class="fas fa-check"></i>' : index + 1}
                    </div>
                    <div class="step-title-simple">${step.title}</div>
                </div>
                ${index < this.steps.length - 1 ? `
                    <div class="step-add-container">
                        <div class="step-connector-simple"></div>
                        <button class="btn-add-step" 
                                onclick="event.stopPropagation(); window.currentThesisWorkflow.showAddStepModal(${index + 1})"
                                title="افزودن مرحله جدید">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }

    // رندر کردن مراحل به صورت افقی
    renderStepsHorizontal() {
        return `
            <div class="steps-timeline">
                ${this.steps.map((step, index) => {
                    const isCompleted = step.status === 'completed';
                    const isActive = index === this.currentStep;
                    const isRejected = step.status === 'rejected';
                    
                    let statusClass = 'pending';
                    if (isCompleted) statusClass = 'completed';
                    else if (isRejected) statusClass = 'rejected';
                    else if (isActive) statusClass = 'active';
                    
                    return `
                        <div class="timeline-step ${statusClass}" 
                             onclick="window.currentThesisWorkflow.selectStep(${index})"
                             title="${step.title}">
                            <div class="step-circle">
                                ${isCompleted ? '<i class="fas fa-check"></i>' : index + 1}
                            </div>
                            <div class="step-label">${step.title}</div>
                            ${index < this.steps.length - 1 ? '<div class="step-line"></div>' : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    // انتخاب مرحله برای نمایش جزئیات
    selectStep(stepIndex) {
        this.selectedStepIndex = stepIndex;
        this.renderWorkflow();
    }

    // بازگشت به نمای کلی
    backToOverview() {
        this.selectedStepIndex = null;
        this.renderWorkflow();
    }

    // رندر کردن جزئیات یک مرحله
    renderStepDetails(stepIndex) {
        const step = this.steps[stepIndex];
        const isCompleted = step.status === 'completed';
        const isActive = stepIndex === this.currentStep;
        
        return `
            <div class="step-details-container">
                <!-- هدر جزئیات -->
                <div class="step-details-header">
                    <button class="btn btn-secondary" onclick="window.currentThesisWorkflow.backToOverview()">
                        <i class="fas fa-arrow-right"></i> بازگشت به نمای کلی
                    </button>
                    <h3>
                        <span class="step-number-badge ${step.status}">${stepIndex + 1}</span>
                        ${step.title}
                    </h3>
                    <span class="step-status-badge status-${step.status}">${this.getStatusName(step.status)}</span>
                </div>

                <!-- محتوای جزئیات -->
                <div class="step-details-content">
                    <!-- بخش 1: توضیحات -->
                    <div class="detail-section">
                        <h4><i class="fas fa-info-circle"></i> توضیحات</h4>
                        <div class="detail-box">
                            <p>${step.description}</p>
                            <div class="mt-3">
                                <strong>مسئول انجام:</strong> ${this.getActorName(step.actor)}
                            </div>
                            ${step.notes ? `
                                <div class="mt-3">
                                    <strong>یادداشت:</strong>
                                    <p class="text-muted">${step.notes}</p>
                                </div>
                            ` : ''}
                            <div class="mt-3">
                                <label class="form-label">افزودن/ویرایش یادداشت:</label>
                                <textarea class="form-control" id="step-notes-${stepIndex}" rows="3" 
                                          placeholder="یادداشت خود را وارد کنید...">${step.notes || ''}</textarea>
                                <button class="btn btn-sm btn-dark mt-2" 
                                        onclick="window.currentThesisWorkflow.saveStepNotes(${stepIndex})">
                                    <i class="fas fa-save"></i> ذخیره یادداشت
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- بخش 2: ارجاع به کارمند -->
                    <div class="detail-section">
                        <h4><i class="fas fa-user-tie"></i> ارجاع به کارمند</h4>
                        <div class="detail-box">
                            ${step.assignedTo ? `
                                <div class="alert alert-info">
                                    <i class="fas fa-user-check"></i>
                                    ارجاع شده به: <strong>${step.assignedTo}</strong>
                                    ${step.assignedAt ? `<br><small>تاریخ ارجاع: ${new Date(step.assignedAt).toLocaleDateString('fa-IR')}</small>` : ''}
                                </div>
                            ` : ''}
                            <div class="form-group">
                                <label class="form-label">انتخاب کارمند:</label>
                                <select class="form-select" id="employee-select-${stepIndex}">
                                    <option value="">انتخاب کنید...</option>
                                    <option value="employee1">کارمند 1</option>
                                    <option value="employee2">کارمند 2</option>
                                    <option value="employee3">کارمند 3</option>
                                </select>
                                <button class="btn btn-sm btn-success mt-2" 
                                        onclick="window.currentThesisWorkflow.assignemployee(${stepIndex})">
                                    <i class="fas fa-paper-plane"></i> ارجاع دادن
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- بخش 3: زمان تحویل -->
                    <div class="detail-section">
                        <h4><i class="fas fa-calendar-alt"></i> زمان تحویل</h4>
                        <div class="detail-box">
                            ${step.deadline ? `
                                <div class="alert alert-warning">
                                    <i class="fas fa-clock"></i>
                                    مهلت تحویل: <strong>${step.deadline}</strong>
                                </div>
                            ` : ''}
                            <div class="form-group">
                                <label class="form-label">تعیین/ویرایش مهلت:</label>
                                <input type="date" class="form-control" id="deadline-${stepIndex}" 
                                       value="${step.deadline || ''}">
                                <button class="btn btn-sm btn-warning mt-2" 
                                        onclick="window.currentThesisWorkflow.saveDeadline(${stepIndex})">
                                    <i class="fas fa-save"></i> ذخیره مهلت
                                </button>
                            </div>
                            ${step.completedAt ? `
                                <div class="mt-3 alert alert-success">
                                    <i class="fas fa-check-circle"></i>
                                    تاریخ تکمیل: <strong>${new Date(step.completedAt).toLocaleDateString('fa-IR')}</strong>
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <!-- بخش 4: اطلاعات مالی -->
                    <div class="detail-section">
                        <h4><i class="fas fa-money-bill-wave"></i> اطلاعات مالی</h4>
                        <div class="detail-box">
                            <div class="financial-summary">
                                <div class="financial-item">
                                    <span class="label">هزینه مرحله:</span>
                                    <span class="value">${step.cost || 0} تومان</span>
                                </div>
                                <div class="financial-item">
                                    <span class="label">وضعیت پرداخت:</span>
                                    <span class="value ${step.isPaid ? 'text-success' : 'text-danger'}">
                                        ${step.isPaid ? 'پرداخت شده' : 'پرداخت نشده'}
                                    </span>
                                </div>
                            </div>
                            <div class="form-group mt-3">
                                <label class="form-label">هزینه (تومان):</label>
                                <input type="number" class="form-control" id="cost-${stepIndex}" 
                                       value="${step.cost || 0}" placeholder="0">
                            </div>
                            <div class="form-check mt-2">
                                <input class="form-check-input" type="checkbox" id="paid-${stepIndex}" 
                                       ${step.isPaid ? 'checked' : ''}>
                                <label class="form-check-label" for="paid-${stepIndex}">
                                    پرداخت شده
                                </label>
                            </div>
                            <button class="btn btn-sm btn-info mt-2" 
                                    onclick="window.currentThesisWorkflow.saveFinancialInfo(${stepIndex})">
                                <i class="fas fa-save"></i> ذخیره اطلاعات مالی
                            </button>
                        </div>
                    </div>
                </div>

                <!-- اکشن‌های مرحله -->
                <div class="step-details-actions">
                    ${isActive && step.status === 'pending' ? `
                        <button class="btn btn-success" onclick="window.currentThesisWorkflow.completeStep(${stepIndex})">
                            <i class="fas fa-check"></i> تکمیل مرحله
                        </button>
                    ` : ''}
                    ${step.canReject && isActive ? `
                        <button class="btn btn-danger" onclick="window.currentThesisWorkflow.rejectStep(${stepIndex})">
                            <i class="fas fa-times"></i> رد مرحله
                        </button>
                    ` : ''}
                    ${step.canTerminate ? `
                        <button class="btn btn-warning" onclick="window.currentThesisWorkflow.terminateAt(${stepIndex})">
                            <i class="fas fa-stop"></i> خاتمه در این مرحله
                        </button>
                    ` : ''}
                    ${step.isCustom ? `
                        <button class="btn btn-danger" onclick="window.currentThesisWorkflow.deleteCustomStep(${stepIndex})">
                            <i class="fas fa-trash"></i> حذف مرحله سفارشی
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // رندر کردن مراحل
    renderSteps() {
        return this.steps.map((step, index) => {
            const isActive = index === this.currentStep;
            const isCompleted = step.status === 'completed';
            const isPending = step.status === 'pending';
            const isRejected = step.status === 'rejected';
            
            return `
                <div class="workflow-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isRejected ? 'rejected' : ''}" 
                     data-step-id="${step.id}" data-step-index="${index}">
                    <div class="step-indicator">
                        <div class="step-number">
                            ${isCompleted ? '<i class="fas fa-check"></i>' : 
                              isRejected ? '<i class="fas fa-times"></i>' : 
                              index + 1}
                        </div>
                        <div class="step-connector"></div>
                    </div>
                    
                    <div class="step-content">
                        <div class="step-header">
                            <h4 class="step-title">${step.title}</h4>
                            <div class="step-meta">
                                <span class="step-actor">${this.getActorName(step.actor)}</span>
                                <span class="step-status status-${step.status}">${this.getStatusName(step.status)}</span>
                            </div>
                        </div>
                        
                        <p class="step-description">${step.description}</p>
                        
                        ${step.requirements ? this.renderStepRequirements(step.requirements) : ''}
                        
                        ${step.notes ? `<div class="step-notes"><strong>یادداشت:</strong> ${step.notes}</div>` : ''}
                        
                        <div class="step-actions">
                            ${step.canEdit ? `<button class="btn btn-sm btn-outline-primary" onclick="thesisWorkflow.editStep(${index})">
                                <i class="fas fa-edit"></i> ویرایش
                            </button>` : ''}
                            
                            ${isActive && isPending ? `<button class="btn btn-sm btn-success" onclick="thesisWorkflow.completeStep(${index})">
                                <i class="fas fa-check"></i> تکمیل
                            </button>` : ''}
                            
                            ${step.canReject && isActive ? `<button class="btn btn-sm btn-danger" onclick="thesisWorkflow.rejectStep(${index})">
                                <i class="fas fa-times"></i> رد
                            </button>` : ''}
                            
                            ${step.canTerminate ? `<button class="btn btn-sm btn-warning" onclick="thesisWorkflow.terminateAt(${index})">
                                <i class="fas fa-stop"></i> خاتمه
                            </button>` : ''}
                        </div>
                        
                        ${step.completedAt ? `<div class="step-timestamp">
                            <i class="fas fa-clock"></i> ${new Date(step.completedAt).toLocaleDateString('fa-IR')}
                        </div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    // رندر کردن نیازمندی‌های مرحله
    renderStepRequirements(requirements) {
        if (!requirements || requirements.length === 0) return '';
        
        return `
            <div class="step-requirements">
                <h5>نیازمندی‌ها:</h5>
                <ul>
                    ${requirements.map(reqId => {
                        const req = this.requirements[reqId];
                        return `<li class="requirement-item status-${req.status}">
                            <i class="fas fa-${req.status === 'completed' ? 'check-circle' : 'circle'}"></i>
                            ${req.title} ${req.optional ? '(اختیاری)' : ''}
                        </li>`;
                    }).join('')}
                </ul>
            </div>
        `;
    }

    // رندر کردن نیازمندی‌های اضافی
    renderRequirements() {
        return Object.values(this.requirements).map(req => `
            <div class="requirement-card status-${req.status}" data-req-id="${req.id}">
                <div class="requirement-header">
                    <h5>${req.title} ${req.optional ? '(اختیاری)' : ''}</h5>
                    <span class="requirement-status">${this.getStatusName(req.status)}</span>
                </div>
                <p>${req.description}</p>
                <div class="requirement-actions">
                    <button class="btn btn-sm btn-success" onclick="thesisWorkflow.toggleRequirement('${req.id}')">
                        <i class="fas fa-${req.status === 'completed' ? 'undo' : 'check'}"></i>
                        ${req.status === 'completed' ? 'لغو تکمیل' : 'تکمیل'}
                    </button>
                </div>
            </div>
        `).join('');
    }
    // محاسبه درصد پیشرفت
    getProgressPercentage() {
        const completedSteps = this.steps.filter(step => step.status === 'completed').length;
        return Math.round((completedSteps / this.steps.length) * 100);
    }

    // دریافت نام بازیگر
    getActorName(actor) {
        const actors = {
            'system': 'سیستم',
            'student': 'دانشجو',
            'company': 'شرکت',
            'scientific_group': 'گروه علمی',
            'student_company': 'دانشجو/شرکت',
            'admin': 'امور اداری',
            'author': 'نویسنده',
            'professor': 'استاد',
            'typesetter': 'منضد'
        };
        return actors[actor] || actor;
    }

    // دریافت نام وضعیت
    getStatusName(status) {
        const statuses = {
            'pending': 'در انتظار',
            'in_progress': 'در حال انجام',
            'completed': 'تکمیل شده',
            'rejected': 'رد شده',
            'terminated': 'خاتمه یافته'
        };
        return statuses[status] || status;
    }

    // تکمیل مرحله
    completeStep(stepIndex) {
        if (stepIndex !== this.currentStep) return;
        
        const step = this.steps[stepIndex];
        step.status = 'completed';
        step.completedAt = new Date().toISOString();
        
        // انتقال به مرحله بعدی
        if (stepIndex < this.steps.length - 1) {
            this.currentStep = stepIndex + 1;
            this.steps[this.currentStep].status = 'in_progress';
        }
        
        this.saveWorkflowData();
        this.renderWorkflow();
        this.showNotification('مرحله با موفقیت تکمیل شد', 'success');
    }

    // رد کردن مرحله
    rejectStep(stepIndex) {
        const step = this.steps[stepIndex];
        if (!step.canReject) return;
        
        const reason = prompt('دلیل رد را وارد کنید:');
        if (!reason) return;
        
        step.status = 'rejected';
        step.rejectionReason = reason;
        step.rejectedAt = new Date().toISOString();
        
        // بازگشت به مرحله مشخص شده
        if (step.rejectTo) {
            const targetStepIndex = this.steps.findIndex(s => s.id === step.rejectTo);
            if (targetStepIndex !== -1) {
                this.currentStep = targetStepIndex;
                this.steps[targetStepIndex].status = 'pending';
            }
        }
        
        this.saveWorkflowData();
        this.renderWorkflow();
        this.showNotification('مرحله رد شد و به مرحله قبلی بازگشت', 'warning');
    }

    // ویرایش مرحله
    editStep(stepIndex) {
        const step = this.steps[stepIndex];
        this.showStepEditModal(step, stepIndex);
    }

    // نمایش مودال ویرایش مرحله
    showStepEditModal(step, stepIndex) {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">ویرایش مرحله: ${step.title}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="step-edit-form">
                            <div class="mb-3">
                                <label class="form-label">وضعیت</label>
                                <select class="form-select" name="status">
                                    <option value="pending" ${step.status === 'pending' ? 'selected' : ''}>در انتظار</option>
                                    <option value="in_progress" ${step.status === 'in_progress' ? 'selected' : ''}>در حال انجام</option>
                                    <option value="completed" ${step.status === 'completed' ? 'selected' : ''}>تکمیل شده</option>
                                    <option value="rejected" ${step.status === 'rejected' ? 'selected' : ''}>رد شده</option>
                                </select>
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label">مسئول انجام</label>
                                <input type="text" class="form-control" name="assignedTo" 
                                       value="${step.assignedTo || ''}" placeholder="نام مسئول">
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label">یادداشت</label>
                                <textarea class="form-control" name="notes" rows="3" 
                                          placeholder="یادداشت‌های مربوط به این مرحله">${step.notes || ''}</textarea>
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label">تاریخ تکمیل</label>
                                <input type="datetime-local" class="form-control" name="completedAt" 
                                       value="${step.completedAt ? new Date(step.completedAt).toISOString().slice(0, 16) : ''}">
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">انصراف</button>
                        <button type="button" class="btn btn-primary" onclick="thesisWorkflow.saveStepEdit(${stepIndex})">
                            ذخیره تغییرات
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        
        modal.addEventListener('hidden.bs.modal', () => {
            document.body.removeChild(modal);
        });
    }

    // ذخیره ویرایش مرحله
    saveStepEdit(stepIndex) {
        const form = document.getElementById('step-edit-form');
        const formData = new FormData(form);
        const step = this.steps[stepIndex];
        
        step.status = formData.get('status');
        step.assignedTo = formData.get('assignedTo');
        step.notes = formData.get('notes');
        
        const completedAt = formData.get('completedAt');
        if (completedAt) {
            step.completedAt = new Date(completedAt).toISOString();
        }
        
        this.saveWorkflowData();
        this.renderWorkflow();
        
        // بستن مودال
        const modal = document.querySelector('.modal.show');
        if (modal) {
            bootstrap.Modal.getInstance(modal).hide();
        }
        
        this.showNotification('تغییرات ذخیره شد', 'success');
    }

    // ذخیره یادداشت مرحله
    saveStepNotes(stepIndex) {
        const notes = document.getElementById(`step-notes-${stepIndex}`).value;
        this.steps[stepIndex].notes = notes;
        this.saveWorkflowData();
        this.showNotification('یادداشت ذخیره شد', 'success');
    }

    // ارجاع به کارمند
    assignemployee(stepIndex) {
        const employee = document.getElementById(`employee-select-${stepIndex}`).value;
        if (!employee) {
            alert('لطفاً یک کارمند انتخاب کنید');
            return;
        }
        
        this.steps[stepIndex].assignedTo = employee;
        this.steps[stepIndex].assignedAt = new Date().toISOString();
        this.saveWorkflowData();
        this.renderWorkflow();
        this.showNotification('ارجاع با موفقیت انجام شد', 'success');
    }

    // ذخیره مهلت
    saveDeadline(stepIndex) {
        const deadline = document.getElementById(`deadline-${stepIndex}`).value;
        if (!deadline) {
            alert('لطفاً یک تاریخ انتخاب کنید');
            return;
        }
        
        this.steps[stepIndex].deadline = deadline;
        this.saveWorkflowData();
        this.showNotification('مهلت ذخیره شد', 'success');
    }

    // ذخیره اطلاعات مالی
    saveFinancialInfo(stepIndex) {
        const cost = document.getElementById(`cost-${stepIndex}`).value;
        const isPaid = document.getElementById(`paid-${stepIndex}`).checked;
        
        this.steps[stepIndex].cost = parseInt(cost) || 0;
        this.steps[stepIndex].isPaid = isPaid;
        
        if (isPaid && !this.steps[stepIndex].paidAt) {
            this.steps[stepIndex].paidAt = new Date().toISOString();
        }
        
        this.saveWorkflowData();
        this.showNotification('اطلاعات مالی ذخیره شد', 'success');
    }

    // نمایش مودال افزودن مرحله جدید
    showAddStepModal(afterIndex) {
        // ایجاد overlay
        const overlay = document.createElement('div');
        overlay.className = 'custom-modal-overlay';
        overlay.id = 'add-step-modal-overlay';
        
        // ایجاد مودال
        const modal = document.createElement('div');
        modal.className = 'custom-modal';
        modal.id = 'add-step-modal';
        modal.innerHTML = `
            <div class="custom-modal-content">
                <div class="custom-modal-header">
                    <h5 class="custom-modal-title">
                        <i class="fas fa-plus-circle"></i>
                        افزودن مرحله جدید بعد از "${this.steps[afterIndex - 1].title}"
                    </h5>
                    <button type="button" class="custom-modal-close" onclick="window.currentThesisWorkflow.closeAddStepModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="custom-modal-body">
                    <form id="add-step-form">
                        <div class="mb-3">
                            <label class="form-label">عنوان مرحله *</label>
                            <input type="text" class="form-control" name="title" 
                                   placeholder="عنوان مرحله را وارد کنید" required>
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label">توضیحات *</label>
                            <textarea class="form-control" name="description" rows="3" 
                                      placeholder="توضیحات مرحله را وارد کنید" required></textarea>
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label">مسئول انجام</label>
                            <select class="form-select" name="actor">
                                <option value="system">سیستم</option>
                                <option value="student">دانشجو</option>
                                <option value="company">شرکت</option>
                                <option value="scientific_group">گروه علمی</option>
                                <option value="student_company">دانشجو/شرکت</option>
                                <option value="admin">امور اداری</option>
                                <option value="author">نویسنده</option>
                                <option value="professor">استاد</option>
                                <option value="typesetter">منضد</option>
                            </select>
                        </div>
                        
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label class="form-label">مهلت تحویل</label>
                                <input type="date" class="form-control" name="deadline">
                            </div>
                            
                            <div class="col-md-6 mb-3">
                                <label class="form-label">هزینه (تومان)</label>
                                <input type="number" class="form-control" name="cost" 
                                       placeholder="0" value="0">
                            </div>
                        </div>
                        
                        <div class="form-check mb-3">
                            <input class="form-check-input" type="checkbox" name="canEdit" checked>
                            <label class="form-check-label">قابل ویرایش</label>
                        </div>
                        
                        <div class="form-check mb-3">
                            <input class="form-check-input" type="checkbox" name="canTerminate">
                            <label class="form-check-label">قابل خاتمه</label>
                        </div>
                        
                        <div class="form-check mb-3">
                            <input class="form-check-input" type="checkbox" name="canReject">
                            <label class="form-check-label">قابل رد</label>
                        </div>
                    </form>
                </div>
                <div class="custom-modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="window.currentThesisWorkflow.closeAddStepModal()">
                        انصراف
                    </button>
                    <button type="button" class="btn btn-success" 
                            onclick="window.currentThesisWorkflow.addNewStep(${afterIndex})">
                        <i class="fas fa-plus"></i> افزودن مرحله
                    </button>
                </div>
            </div>
        `;
        
        // اضافه کردن به صفحه
        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        
        // نمایش با انیمیشن
        setTimeout(() => {
            overlay.classList.add('show');
            modal.classList.add('show');
        }, 10);
        
        // بستن با کلیک روی overlay
        overlay.addEventListener('click', () => {
            this.closeAddStepModal();
        });
    }

    // بستن مودال افزودن مرحله
    closeAddStepModal() {
        const overlay = document.getElementById('add-step-modal-overlay');
        const modal = document.getElementById('add-step-modal');
        
        if (overlay && modal) {
            overlay.classList.remove('show');
            modal.classList.remove('show');
            
            setTimeout(() => {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                if (modal.parentNode) modal.parentNode.removeChild(modal);
            }, 300);
        }
    }

    // افزودن مرحله جدید
    addNewStep(afterIndex) {
        const form = document.getElementById('add-step-form');
        
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        
        const formData = new FormData(form);
        
        const newStep = {
            id: 'custom_step_' + Date.now(),
            title: formData.get('title'),
            description: formData.get('description'),
            status: 'pending',
            actor: formData.get('actor'),
            canEdit: formData.get('canEdit') === 'on',
            canTerminate: formData.get('canTerminate') === 'on',
            canReject: formData.get('canReject') === 'on',
            deadline: formData.get('deadline') || null,
            cost: parseInt(formData.get('cost')) || 0,
            isPaid: false,
            isCustom: true,
            createdAt: new Date().toISOString()
        };
        
        // اضافه کردن مرحله جدید در موقعیت مشخص شده
        this.steps.splice(afterIndex, 0, newStep);
        
        // بروزرسانی شماره مرحله فعلی اگر لازم باشد
        if (this.currentStep >= afterIndex) {
            this.currentStep++;
        }
        
        this.saveWorkflowData();
        this.renderWorkflow();
        
        // بستن مودال
        this.closeAddStepModal();
        
        this.showNotification('مرحله جدید با موفقیت اضافه شد', 'success');
    }

    // حذف مرحله سفارشی
    deleteCustomStep(stepIndex) {
        const step = this.steps[stepIndex];
        
        if (!step.isCustom) {
            alert('فقط مراحل سفارشی قابل حذف هستند');
            return;
        }
        
        if (!confirm(`آیا مطمئن هستید که می‌خواهید مرحله "${step.title}" را حذف کنید؟`)) {
            return;
        }
        
        this.steps.splice(stepIndex, 1);
        
        // بروزرسانی شماره مرحله فعلی
        if (this.currentStep >= stepIndex) {
            this.currentStep = Math.max(0, this.currentStep - 1);
        }
        
        // بازگشت به نمای کلی
        this.selectedStepIndex = null;
        
        this.saveWorkflowData();
        this.renderWorkflow();
        this.showNotification('مرحله حذف شد', 'success');
    }

    // تغییر وضعیت نیازمندی
    toggleRequirement(reqId) {
        const req = this.requirements[reqId];
        req.status = req.status === 'completed' ? 'pending' : 'completed';
        
        if (req.status === 'completed') {
            req.completedAt = new Date().toISOString();
        } else {
            delete req.completedAt;
        }
        
        this.saveWorkflowData();
        this.renderWorkflow();
        this.showNotification(`وضعیت "${req.title}" تغییر کرد`, 'info');
    }

    // خاتمه فرآیند در مرحله مشخص
    terminateAt(stepIndex) {
        const step = this.steps[stepIndex];
        const reason = prompt(`آیا مطمئن هستید که می‌خواهید فرآیند را در مرحله "${step.title}" خاتمه دهید؟\nدلیل خاتمه را وارد کنید:`);
        
        if (!reason) return;
        
        step.status = 'terminated';
        step.terminationReason = reason;
        step.terminatedAt = new Date().toISOString();
        
        // تمام مراحل بعدی را غیرفعال کن
        for (let i = stepIndex + 1; i < this.steps.length; i++) {
            this.steps[i].status = 'terminated';
        }
        
        this.saveWorkflowData();
        this.renderWorkflow();
        this.showNotification('فرآیند خاتمه یافت', 'warning');
    }
    // نمایش ویرایشگر مرحله فعلی
    showStepEditor() {
        if (this.currentStep >= this.steps.length) return;
        this.editStep(this.currentStep);
    }

    // نمایش دیالوگ خاتمه
    showTerminateDialog() {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">خاتمه فرآیند</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p>در کدام مرحله می‌خواهید فرآیند را خاتمه دهید؟</p>
                        <select class="form-select" id="terminate-step-select">
                            ${this.steps.map((step, index) => 
                                `<option value="${index}">${step.title}</option>`
                            ).join('')}
                        </select>
                        <div class="mt-3">
                            <label class="form-label">دلیل خاتمه</label>
                            <textarea class="form-control" id="terminate-reason" rows="3" 
                                      placeholder="دلیل خاتمه فرآیند را وارد کنید"></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">انصراف</button>
                        <button type="button" class="btn btn-danger" onclick="thesisWorkflow.confirmTerminate()">
                            خاتمه فرآیند
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        
        modal.addEventListener('hidden.bs.modal', () => {
            document.body.removeChild(modal);
        });
    }

    // تایید خاتمه
    confirmTerminate() {
        const stepIndex = parseInt(document.getElementById('terminate-step-select').value);
        const reason = document.getElementById('terminate-reason').value;
        
        if (!reason.trim()) {
            alert('لطفاً دلیل خاتمه را وارد کنید');
            return;
        }
        
        this.terminateAt(stepIndex);
        
        // بستن مودال
        const modal = document.querySelector('.modal.show');
        if (modal) {
            bootstrap.Modal.getInstance(modal).hide();
        }
    }

    // صادرات گزارش
    exportReport() {
        const report = {
            title: 'گزارش پیشرفت رساله',
            generatedAt: new Date().toISOString(),
            progress: this.getProgressPercentage(),
            currentStep: this.steps[this.currentStep]?.title || 'تکمیل شده',
            steps: this.steps.map(step => ({
                title: step.title,
                status: this.getStatusName(step.status),
                actor: this.getActorName(step.actor),
                completedAt: step.completedAt,
                notes: step.notes,
                assignedTo: step.assignedTo
            })),
            requirements: Object.values(this.requirements).map(req => ({
                title: req.title,
                status: this.getStatusName(req.status),
                optional: req.optional,
                completedAt: req.completedAt
            }))
        };
        
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `thesis-progress-report-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification('گزارش صادر شد', 'success');
    }

    // بازنشانی فرآیند
    resetWorkflow() {
        if (!confirm('آیا مطمئن هستید که می‌خواهید فرآیند را بازنشانی کنید؟ تمام اطلاعات حذف خواهد شد.')) {
            return;
        }
        
        localStorage.removeItem('thesis_workflow_data');
        this.currentStep = 0;
        this.workflowData = {};
        this.steps = this.getWorkflowSteps();
        this.requirements = this.getAdditionalRequirements();
        this.renderWorkflow();
        this.showNotification('فرآیند بازنشانی شد', 'info');
    }

    // اتصال رویدادها
    bindEvents() {
        // رویداد تغییر اندازه صفحه
        window.addEventListener('resize', () => {
            this.renderWorkflow();
        });
        
        // رویداد کلیدهای میانبر
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 's':
                        e.preventDefault();
                        this.saveWorkflowData();
                        this.showNotification('داده‌ها ذخیره شد', 'success');
                        break;
                    case 'e':
                        e.preventDefault();
                        this.showStepEditor();
                        break;
                }
            }
        });
    }

    // نمایش اعلان
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} notification-toast`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 
                                type === 'warning' ? 'exclamation-triangle' : 
                                type === 'danger' ? 'times-circle' : 'info-circle'}"></i>
            ${message}
        `;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            min-width: 300px;
            animation: slideInRight 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// ایجاد نمونه سراسری
let thesisWorkflow;

// توجه: راه‌اندازی خودکار غیرفعال شده است
// سیستم باید به صورت دستی از طریق order-pages.js راه‌اندازی شود

// صادرات برای استفاده در ماژول‌های دیگر
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThesisWorkflow;
}