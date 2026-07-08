// Order Wizard Module - ماژول فرم سفارش 3 مرحله‌ای
const OrderWizardModule = {
    // لیست کامل انواع کارها
    workTypes: [
        'عناوین رساله ارشد', 'عناوین رساله عاملی', 'عناوین مقاله',
        'پروپوزال رساله ارشد', 'پروپوزال رساله عاملی', 'پروپوزال مقاله',
        'رساله ارشد', 'رساله عاملی', 'تعدیل', 'تنضید', 'ترجمه',
        'استلال عراقی', 'استلال ایرانی', 'علاج استلال ایرانی', 'علاج استلال عراقی',
        'ترجمه و تصدیق مباشره', 'ترجمه و تصدیق قبول نهایی', 'ترجمه و تصدیق دانشنامه',
        'ترجمه مدرک', 'تجلید', 'همانند جویی',
        'ایران داک عنوان', 'ایران داک پروپوزال', 'ایران داک پایان نامه',
        'سائورگ', 'تلخیص متن', 'ساخت پاور پوینت',
        'تعقیب اجراعات قبل مباشره', 'تعقیب اجراعات بعد مباشره',
        'تصدیق مجلدات', 'تعقیب استماره 1', 'تعقیب پروپوزال',
        'گرفتن امر اداری', 'تعقیب رساله', 'تعقیب اجراعات روز مناقشه',
        'سایر'
    ],
    
    // Get the complete 4-step wizard modal
    getWizardModal() {
        return `
            <div x-data="orderWizardData()">
                <div class="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-100 to-gray-200 relative">
                    <button @click="$dispatch('close-modal')" 
                            class="absolute left-4 top-4 text-gray-600 hover:text-gray-800 text-2xl"
                            type="button">
                        <i class="fas fa-times"></i>
                    </button>
                    <h3 class="text-xl font-bold text-gray-900">سفارش جدید</h3>
                    ${this.getStepIndicator()}
                </div>
                <div class="p-6 bg-transparent">
                    ${this.getStep1()}
                    ${this.getStep2()}
                    ${this.getStep3()}
                    ${this.getStep4()}
                    ${this.getNavigationButtons()}
                </div>
            </div>
        `;
    },
    
    // Step indicator
    getStepIndicator() {
        return `
            <div class="flex items-center justify-center gap-3 mt-6 px-4">
                <template x-for="(step, index) in [{num: 1, name: 'مشخصات'}, {num: 2, name: 'نوع کار'}, {num: 3, name: 'مالی'}, {num: 4, name: 'تخصیص'}]" :key="index">
                    <div class="flex-1">
                        <div :class="currentStep > index ? 'bg-green-500 border-green-500' : (currentStep === index ? 'bg-gray-600 border-gray-600' : 'bg-gray-200 border-gray-300')"
                             class="relative border-2 rounded-lg p-4 transition-all duration-300 shadow-sm hover:shadow-md">
                            <!-- Step Number Badge -->
                            <div class="absolute -top-3 right-4 w-8 h-8 rounded-full flex items-center justify-center font-bold text-base border-2"
                                 :class="currentStep > index ? 'bg-white text-green-600 border-green-500' : (currentStep === index ? 'bg-white text-gray-600 border-gray-600' : 'bg-gray-100 text-gray-400 border-gray-300')">
                                <span x-text="step.num"></span>
                            </div>
                            
                            <!-- Step Name -->
                            <div class="text-center mt-2">
                                <span :class="currentStep > index ? 'text-white' : (currentStep === index ? 'text-white' : 'text-gray-500')" 
                                      class="font-bold text-lg" x-text="step.name"></span>
                            </div>
                            
                            <!-- Checkmark for completed steps -->
                            <div x-show="currentStep > index" class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                                <i class="fas fa-check-circle text-white text-3xl"></i>
                            </div>
                        </div>
                    </div>
                </template>
            </div>
        `;
    },
    
    // Alpine.js data - now returns an object, not a string
    getAlpineData() {
        return {
            currentStep: 0,
            showModal: false,
            newOrder: { 
                workList: [],
                workDetails: {},
                workPrices: {},
                customFields1: [],
                customFields2: [],
                customFields3: [],
                currency: 'تومان',
                assignedDoctorId: null,
                assignedDoctor: null
            },
            showCustomUniversity: false,
            showCustomField: false,
            showCustomDegree: false,
            showCustomPhone: false,
            passportPreview: null,
            selectedWork: '',
            customWorkName: '',
            selectedDoctor: '',
            
            addWork() {
                let workName = this.selectedWork;
                if (workName === 'سایر' && this.customWorkName) {
                    workName = this.customWorkName;
                    this.customWorkName = '';
                }
                if (workName && !this.newOrder.workList.includes(workName)) {
                    this.newOrder.workList.push(workName);
                    this.newOrder.workDetails[workName] = { deadline: '', price: 0 };
                    this.newOrder.workPrices[workName] = 0;
                    this.selectedWork = '';
                }
            },
            removeWork(index) {
                const workName = this.newOrder.workList[index];
                this.newOrder.workList.splice(index, 1);
                delete this.newOrder.workDetails[workName];
                delete this.newOrder.workPrices[workName];
                this.calculateTotalAmount();
            },
            moveWorkUp(index) {
                if (index > 0) {
                    const temp = this.newOrder.workList[index];
                    this.newOrder.workList[index] = this.newOrder.workList[index - 1];
                    this.newOrder.workList[index - 1] = temp;
                }
            },
            moveWorkDown(index) {
                if (index < this.newOrder.workList.length - 1) {
                    const temp = this.newOrder.workList[index];
                    this.newOrder.workList[index] = this.newOrder.workList[index + 1];
                    this.newOrder.workList[index + 1] = temp;
                }
            },
            calculateTotalAmount() {
                let total = 0;
                for (const workName in this.newOrder.workPrices) {
                    total += parseFloat(this.newOrder.workPrices[workName] || 0);
                }
                this.newOrder.totalAmount = total;
            },
            updateWorkPrice(workName, price) {
                this.newOrder.workPrices[workName] = parseFloat(price || 0);
                this.calculateTotalAmount();
            },
            addCustomField(step) {
                const fieldName = 'customFields' + step;
                if (!this.newOrder[fieldName]) this.newOrder[fieldName] = [];
                this.newOrder[fieldName].push({ label: '', value: '' });
            },
            removeCustomField(step, index) {
                const fieldName = 'customFields' + step;
                this.newOrder[fieldName].splice(index, 1);
            },
            validateStep1() {
                return this.newOrder.studentName && this.newOrder.nickname && 
                       this.newOrder.birthDate && this.newOrder.passportNumber && 
                       this.newOrder.gender && this.newOrder.university && 
                       this.newOrder.field && this.newOrder.degree && 
                       this.newOrder.phone && this.newOrder.behestanUsername && 
                       this.newOrder.behestanPassword && this.newOrder.studentId && 
                       this.newOrder.passportImage;
            },
            validateStep2() {
                if (!this.newOrder.workList || this.newOrder.workList.length === 0) return false;
                for (const work of this.newOrder.workList) {
                    if (!this.newOrder.workDetails[work] || !this.newOrder.workDetails[work].deadline) {
                        return false;
                    }
                }
                return true;
            },
            nextStep() {
                if (this.currentStep === 0 && !this.validateStep1()) {
                    alert('لطفاً تمام فیلدهای الزامی را پر کنید');
                    return;
                }
                if (this.currentStep === 1 && !this.validateStep2()) {
                    alert('لطفاً حداقل یک کار اضافه کنید و برای هر کار زمان تحویل مشخص کنید');
                    return;
                }
                if (this.currentStep < 3) this.currentStep++;
            },
            prevStep() {
                if (this.currentStep > 0) this.currentStep--;
            }
        };
    },
    
    // Step 1: مشخصات
    getStep1() {
        return `
            <div x-show="currentStep === 0" class="space-y-4">
                <h4 class="text-lg font-semibold text-gray-700 mb-4 border-b pb-2">
                    <i class="fas fa-user text-indigo-500 ml-2"></i>
                    مشخصات دانشجو
                </h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xl font-bold text-gray-800 mb-2">نام ثلاثی <span class="text-red-500">*</span></label>
                        <input type="text" x-model="newOrder.studentName" 
                               class="form-control" required placeholder="نام کامل (سه قسمتی)">
                    </div>
                    <div>
                        <label class="block text-xl font-bold text-gray-800 mb-2">لقب <span class="text-red-500">*</span></label>
                        <input type="text" x-model="newOrder.nickname" 
                               class="form-control" required placeholder="لقب">
                    </div>
                    <div>
                        <label class="block text-xl font-bold text-gray-800 mb-2">تاریخ تولد <span class="text-red-500">*</span></label>
                        <input type="date" x-model="newOrder.birthDate" class="form-control" required>
                    </div>
                    <div>
                        <label class="block text-xl font-bold text-gray-800 mb-2">شماره پاسپورت <span class="text-red-500">*</span></label>
                        <input type="text" x-model="newOrder.passportNumber" 
                               class="form-control" required placeholder="شماره پاسپورت">
                    </div>
                    <div>
                        <label class="block text-xl font-bold text-gray-800 mb-2">جنسیت <span class="text-red-500">*</span></label>
                        <select x-model="newOrder.gender" class="form-control" required>
                            <option value="">انتخاب کنید</option>
                            <option value="مرد">مرد</option>
                            <option value="زن">زن</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xl font-bold text-gray-800 mb-2">مقطع تحصیلی <span class="text-red-500">*</span></label>
                        <select x-model="newOrder.degreeSelect" class="form-control" required
                                @change="showCustomDegree = (newOrder.degreeSelect === 'سایر'); 
                                         if(!showCustomDegree) newOrder.degree = newOrder.degreeSelect;">
                            <option value="">انتخاب کنید</option>
                            <option value="کارشناسی">کارشناسی</option>
                            <option value="کارشناسی ارشد">کارشناسی ارشد</option>
                            <option value="عاملا">عاملا</option>
                            <option value="سایر">سایر</option>
                        </select>
                    </div>
                    <div x-show="showCustomDegree">
                        <label class="block text-xl font-bold text-gray-800 mb-2">نام مقطع</label>
                        <input type="text" x-model="newOrder.degree" 
                               class="form-control" placeholder="نام مقطع را وارد کنید">
                    </div>
                    <div>
                        <label class="block text-xl font-bold text-gray-800 mb-2">دانشگاه <span class="text-red-500">*</span></label>
                        <select x-model="newOrder.universitySelect" class="form-control" required
                                @change="showCustomUniversity = (newOrder.universitySelect === 'سایر'); 
                                         if(!showCustomUniversity) newOrder.university = newOrder.universitySelect;">
                            <option value="">انتخاب کنید</option>
                            <option value="دانشگاه قم">دانشگاه قم</option>
                            <option value="جامعه المصطفی">جامعه المصطفی</option>
                            <option value="سایر">سایر</option>
                        </select>
                    </div>
                    <div x-show="showCustomUniversity">
                        <label class="block text-xl font-bold text-gray-800 mb-2">نام دانشگاه</label>
                        <input type="text" x-model="newOrder.university" 
                               class="form-control" placeholder="نام دانشگاه را وارد کنید">
                    </div>
                    <div>
                        <label class="block text-xl font-bold text-gray-800 mb-2">رشته تحصیلی <span class="text-red-500">*</span></label>
                        <select x-model="newOrder.fieldSelect" class="form-control" required
                                @change="showCustomField = (newOrder.fieldSelect === 'سایر'); 
                                         if(!showCustomField) newOrder.field = newOrder.fieldSelect;">
                            <option value="">انتخاب کنید</option>
                            <option value="حقوق محض">حقوق محض</option>
                            <option value="حقوق عمومی">حقوق عمومی</option>
                            <option value="حقوق خصوصی">حقوق خصوصی</option>
                            <option value="حقوق بین‌الملل">حقوق بین‌الملل</option>
                            <option value="سایر">سایر</option>
                        </select>
                    </div>
                    <div x-show="showCustomField">
                        <label class="block text-xl font-bold text-gray-800 mb-2">نام رشته</label>
                        <input type="text" x-model="newOrder.field" 
                               class="form-control" placeholder="نام رشته را وارد کنید">
                    </div>
                    <div>
                        <label class="block text-xl font-bold text-gray-800 mb-2">شماره تماس <span class="text-red-500">*</span></label>
                        <div class="flex space-x-2 space-x-reverse">
                            <input type="tel" x-model="newOrder.phone" 
                                   class="form-control flex-1" required placeholder="شماره تماس"
                                   x-show="!showCustomPhone">
                            <input type="text" x-model="newOrder.phone" 
                                   class="form-control flex-1" placeholder="شماره تماس دیگر"
                                   x-show="showCustomPhone">
                            <button type="button" @click="showCustomPhone = !showCustomPhone"
                                    class="px-3 py-2 text-base bg-gray-100 hover:bg-gray-200 rounded-lg border">
                                سایر
                            </button>
                        </div>
                    </div>
                    <div>
                        <label class="block text-xl font-bold text-gray-800 mb-2">نام کاربری بهستان <span class="text-red-500">*</span></label>
                        <input type="text" x-model="newOrder.behestanUsername" 
                               class="form-control" required placeholder="نام کاربری بهستان">
                    </div>
                    <div>
                        <label class="block text-xl font-bold text-gray-800 mb-2">رمز عبور بهستان <span class="text-red-500">*</span></label>
                        <input type="text" x-model="newOrder.behestanPassword" 
                               class="form-control" required placeholder="رمز عبور بهستان">
                    </div>
                    <div>
                        <label class="block text-xl font-bold text-gray-800 mb-2">شماره دانشجویی <span class="text-red-500">*</span></label>
                        <input type="text" x-model="newOrder.studentId" 
                               class="form-control" required placeholder="شماره دانشجویی">
                    </div>
                </div>
                
                <div class="mt-4">
                    <label class="block text-xl font-bold text-gray-800 mb-2">عکس پاسپورت <span class="text-red-500">*</span></label>
                    <div class="border-2 border-dashed border-gray-300 rounded-lg p-4">
                        <input type="file" id="passport-image-input" accept="image/*" class="hidden"
                               @change="
                                   const file = $event.target.files[0];
                                   if (file) {
                                       const reader = new FileReader();
                                       reader.onload = async (e) => {
                                           passportPreview = e.target.result;
                                           newOrder.passportImage = e.target.result;
                                           
                                           // Extract passport info using OCR
                                           if (typeof PassportOCR !== 'undefined') {
                                               try {
                                                   const passportInfo = await PassportOCR.extractPassportInfo(file);
                                                   if (passportInfo) {
                                                       // Auto-fill form fields
                                                       if (passportInfo.givenNames && passportInfo.surname) {
                                                           newOrder.studentName = passportInfo.givenNames + ' ' + passportInfo.surname;
                                                       }
                                                       if (passportInfo.passportNumber) {
                                                           newOrder.passportNumber = passportInfo.passportNumber;
                                                       }
                                                       if (passportInfo.dateOfBirth) {
                                                           newOrder.birthDate = passportInfo.dateOfBirth;
                                                       }
                                                       if (passportInfo.sex) {
                                                           newOrder.gender = passportInfo.sex === 'M' ? 'مرد' : passportInfo.sex === 'F' ? 'زن' : '';
                                                       }
                                                       
                                                       // Store extracted info
                                                       newOrder.passportExtractedInfo = PassportOCR.formatPassportInfo(passportInfo);
                                                   }
                                               } catch (error) {
                                                   console.error('OCR Error:', error);
                                               }
                                           }
                                       };
                                       reader.readAsDataURL(file);
                                   }
                               ">
                        <div x-show="!passportPreview" class="text-center">
                            <i class="fas fa-passport text-4xl text-gray-400 mb-2"></i>
                            <p class="text-gray-500 text-base mb-2">عکس پاسپورت را آپلود کنید</p>
                            <p class="text-sm text-gray-600 mb-2">
                                <i class="fas fa-magic ml-1"></i>
                                اطلاعات به صورت خودکار استخراج می‌شود
                            </p>
                            <button type="button" @click="document.getElementById('passport-image-input').click()"
                                    class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-base">
                                <i class="fas fa-upload ml-2"></i>
                                انتخاب فایل
                            </button>
                        </div>
                        <div x-show="passportPreview" class="text-center">
                            <img :src="passportPreview" class="max-h-32 mx-auto rounded-lg mb-2">
                            <div class="flex justify-center space-x-2 space-x-reverse">
                                <button type="button" @click="passportPreview = null; newOrder.passportImage = null; newOrder.passportExtractedInfo = null;"
                                        class="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 text-base">
                                    <i class="fas fa-trash ml-1"></i>
                                    حذف
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Extracted Passport Info -->
                <div x-show="newOrder.passportExtractedInfo" class="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                    <h5 class="font-semibold text-green-800 mb-2">
                        <i class="fas fa-check-circle ml-1"></i>
                        اطلاعات استخراج شده از پاسپورت
                    </h5>
                    <pre class="text-base text-green-700 whitespace-pre-wrap font-mono" x-text="newOrder.passportExtractedInfo"></pre>
                </div>
                
                <div class="mt-4">
                    <label class="block text-xl font-bold text-gray-800 mb-2">توضیحات (اختیاری)</label>
                    <textarea x-model="newOrder.description" rows="2" class="form-control" placeholder="توضیحات اضافی..."></textarea>
                </div>
                
                <!-- فیلدهای سفارشی -->
                <div class="mt-4 border-t pt-4">
                    <div class="flex justify-between items-center mb-3">
                        <label class="block text-xl font-bold text-gray-800">فیلدهای اضافی</label>
                        <button type="button" @click="addCustomField(1)" 
                                class="px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 text-base">
                            <i class="fas fa-plus ml-1"></i>
                            افزودن فیلد
                        </button>
                    </div>
                    <div class="space-y-2">
                        <template x-for="(field, index) in newOrder.customFields1" :key="index">
                            <div class="flex space-x-2 space-x-reverse">
                                <input type="text" x-model="field.label" 
                                       class="form-control flex-1" placeholder="عنوان فیلد">
                                <input type="text" x-model="field.value" 
                                       class="form-control flex-1" placeholder="مقدار">
                                <button type="button" @click="removeCustomField(1, index)" 
                                        class="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </template>
                    </div>
                </div>
            </div>
        `;
    },
    
    // Step 2: نوع کار
    getStep2() {
        const workOptions = this.workTypes.map(w => `<option value="${w}">${w}</option>`).join('');
        
        return `
            <div x-show="currentStep === 1" class="space-y-4">
                <h4 class="text-lg font-semibold text-gray-700 mb-4 border-b pb-2">
                    <i class="fas fa-tasks text-indigo-500 ml-2"></i>
                    تعریف نوع کار
                </h4>
                
                <div class="mb-4">
                    <label class="block text-xl font-bold text-gray-800 mb-2">انتخاب نوع کار</label>
                    <div class="flex space-x-2 space-x-reverse">
                        <select x-model="selectedWork" class="form-control flex-1">
                            <option value="">یک کار انتخاب کنید...</option>
                            ${workOptions}
                        </select>
                        <button type="button" @click="addWork()" 
                                class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                            <i class="fas fa-plus ml-1"></i>
                            افزودن
                        </button>
                    </div>
                    
                    <!-- Custom Work Name Input -->
                    <div x-show="selectedWork === 'سایر'" class="mt-3">
                        <input type="text" x-model="customWorkName" 
                               class="form-control" placeholder="نام کار جدید را وارد کنید">
                    </div>
                </div>
                
                <div class="bg-gray-50 rounded-lg p-4 min-h-[200px]">
                    <h5 class="text-base font-medium text-gray-600 mb-3">
                        <i class="fas fa-list-ol ml-1"></i>
                        لیست کارها به ترتیب اولویت (با زمان تحویل)
                    </h5>
                    
                    <div x-show="newOrder.workList.length === 0" class="text-center py-8 text-gray-400">
                        <i class="fas fa-clipboard-list text-4xl mb-2"></i>
                        <p>هنوز کاری اضافه نشده است</p>
                    </div>
                    
                    <div class="space-y-3">
                        <template x-for="(work, index) in newOrder.workList" :key="index">
                            <div class="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                                <div class="flex items-start">
                                    <span class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg ml-3 flex-shrink-0"
                                          x-text="index + 1"></span>
                                    <div class="flex-1">
                                        <div class="flex items-center justify-between mb-3">
                                            <span class="font-bold text-lg text-gray-700" x-text="work"></span>
                                            <div class="flex space-x-1 space-x-reverse">
                                                <button type="button" @click="moveWorkUp(index)" 
                                                        :disabled="index === 0"
                                                        :class="index === 0 ? 'text-gray-300' : 'text-gray-500 hover:text-indigo-600'"
                                                        class="p-1 text-lg">
                                                    <i class="fas fa-chevron-up"></i>
                                                </button>
                                                <button type="button" @click="moveWorkDown(index)" 
                                                        :disabled="index === newOrder.workList.length - 1"
                                                        :class="index === newOrder.workList.length - 1 ? 'text-gray-300' : 'text-gray-500 hover:text-indigo-600'"
                                                        class="p-1 text-lg">
                                                    <i class="fas fa-chevron-down"></i>
                                                </button>
                                                <button type="button" @click="removeWork(index)" 
                                                        class="p-1 text-lg text-red-400 hover:text-red-600">
                                                    <i class="fas fa-trash"></i>
                                                </button>
                                            </div>
                                        </div>
                                        
                                        <!-- Deadline for this work -->
                                        <div class="grid grid-cols-1 gap-2">
                                            <div>
                                                <label class="block text-sm font-medium text-gray-600 mb-1">
                                                    <i class="fas fa-calendar-alt ml-1"></i>
                                                    زمان تحویل <span class="text-red-500">*</span>
                                                </label>
                                                <input type="date" 
                                                       x-model="newOrder.workDetails[work].deadline"
                                                       class="form-control text-base" required>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>
                
                <!-- فیلدهای سفارشی -->
                <div class="mt-4 border-t pt-4">
                    <div class="flex justify-between items-center mb-3">
                        <label class="block text-xl font-bold text-gray-800">فیلدهای اضافی</label>
                        <button type="button" @click="addCustomField(2)" 
                                class="px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 text-base">
                            <i class="fas fa-plus ml-1"></i>
                            افزودن فیلد
                        </button>
                    </div>
                    <div class="space-y-2">
                        <template x-for="(field, index) in newOrder.customFields2" :key="index">
                            <div class="flex space-x-2 space-x-reverse">
                                <input type="text" x-model="field.label" 
                                       class="form-control flex-1" placeholder="عنوان فیلد">
                                <input type="text" x-model="field.value" 
                                       class="form-control flex-1" placeholder="مقدار">
                                <button type="button" @click="removeCustomField(2, index)" 
                                        class="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </template>
                    </div>
                </div>
            </div>
        `;
    },
    
    // Step 3: مالی
    getStep3() {
        return `
            <div x-show="currentStep === 2" class="space-y-4">
                <h4 class="text-lg font-semibold text-gray-700 mb-4 border-b pb-2">
                    <i class="fas fa-calculator text-indigo-500 ml-2"></i>
                    اطلاعات مالی
                </h4>
                
                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                    <p class="text-base text-yellow-700">
                        <i class="fas fa-info-circle ml-1"></i>
                        این بخش توسط مدیر تکمیل می‌شود - برای هر کار قیمت مجزا تعیین کنید
                    </p>
                </div>
                
                <!-- انتخاب واحد پول -->
                <div class="mb-4">
                    <label class="block text-xl font-bold text-gray-800 mb-2">واحد پول</label>
                    <select x-model="newOrder.currency" class="form-control">
                        <option value="تومان">تومان</option>
                        <option value="دلار">دلار</option>
                        <option value="دینار">دینار</option>
                    </select>
                </div>
                
                <!-- قیمت برای هر کار -->
                <div class="bg-white border rounded-lg p-4 mb-4">
                    <h5 class="font-semibold text-gray-800 mb-3">
                        <i class="fas fa-money-bill-wave ml-1"></i>
                        قیمت هر کار
                    </h5>
                    <div class="space-y-3">
                        <template x-for="(work, index) in newOrder.workList" :key="index">
                            <div class="flex items-center bg-gray-50 rounded-lg p-3">
                                <span class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-base ml-3"
                                      x-text="index + 1"></span>
                                <div class="flex-1">
                                    <p class="font-medium text-gray-700 mb-1" x-text="work"></p>
                                    <input type="number" 
                                           x-model="newOrder.workPrices[work]"
                                           @input="updateWorkPrice(work, $event.target.value)"
                                           class="form-control text-base" 
                                           :placeholder="'قیمت به ' + newOrder.currency">
                                </div>
                            </div>
                        </template>
                        
                        <div x-show="newOrder.workList.length === 0" class="text-center py-4 text-gray-400">
                            <p class="text-base">ابتدا کارها را در مرحله قبل اضافه کنید</p>
                        </div>
                    </div>
                </div>
                
                <!-- مبلغ کل خودکار -->
                <div class="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 mb-4">
                    <div class="flex justify-between items-center">
                        <span class="text-xl font-bold text-gray-800">مبلغ کل (محاسبه خودکار)</span>
                        <span class="text-2xl font-bold text-green-600" x-text="(newOrder.totalAmount || 0).toLocaleString() + ' ' + newOrder.currency"></span>
                    </div>
                </div>
                
                <!-- سایر اطلاعات مالی -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xl font-bold text-gray-800 mb-2">سهم واسط (<span x-text="newOrder.currency"></span>)</label>
                        <input type="number" x-model="newOrder.agentShare" 
                               class="form-control" placeholder="سهم واسط">
                    </div>
                    <div>
                        <label class="block text-xl font-bold text-gray-800 mb-2">تخفیف (<span x-text="newOrder.currency"></span>)</label>
                        <input type="number" x-model="newOrder.discount" 
                               class="form-control" placeholder="مبلغ تخفیف">
                    </div>
                    <div>
                        <label class="block text-xl font-bold text-gray-800 mb-2">سهم شرکت (<span x-text="newOrder.currency"></span>)</label>
                        <input type="number" x-model="newOrder.companyShare" 
                               class="form-control" placeholder="سهم شرکت">
                    </div>
                    <div>
                        <label class="block text-xl font-bold text-gray-800 mb-2">سهم عامل/عامل (<span x-text="newOrder.currency"></span>)</label>
                        <input type="number" x-model="newOrder.doctorShare" 
                               class="form-control" placeholder="سهم عامل/عامل">
                    </div>
                </div>
                
                <!-- فیلدهای سفارشی مالی -->
                <div class="mt-4 border-t pt-4">
                    <div class="flex justify-between items-center mb-3">
                        <label class="block text-xl font-bold text-gray-800">فیلدهای اضافی مالی (سایر)</label>
                        <button type="button" @click="addCustomField(3)" 
                                class="px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 text-base">
                            <i class="fas fa-plus ml-1"></i>
                            افزودن فیلد
                        </button>
                    </div>
                    <div class="space-y-2">
                        <template x-for="(field, index) in newOrder.customFields3" :key="index">
                            <div class="flex space-x-2 space-x-reverse">
                                <input type="text" x-model="field.label" 
                                       class="form-control flex-1" placeholder="عنوان فیلد (مثلا: هزینه اضافی)">
                                <input type="text" x-model="field.value" 
                                       class="form-control flex-1" placeholder="توضیحات">
                                <button type="button" @click="removeCustomField(3, index)" 
                                        class="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </template>
                    </div>
                </div>
                
                <!-- خلاصه مالی -->
                <div class="bg-gray-50 rounded-lg p-4 mt-4" x-show="newOrder.totalAmount">
                    <h5 class="font-semibold text-gray-700 mb-3">خلاصه مالی (<span x-text="newOrder.currency"></span>)</h5>
                    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-base">
                        <div class="text-center p-2 bg-white rounded-lg">
                            <p class="text-gray-500 text-sm">مبلغ کل</p>
                            <p class="font-bold text-xl" x-text="(newOrder.totalAmount || 0).toLocaleString()"></p>
                        </div>
                        <div class="text-center p-2 bg-white rounded-lg">
                            <p class="text-gray-500 text-sm">تخفیف</p>
                            <p class="font-bold text-xl text-red-500" x-text="(newOrder.discount || 0).toLocaleString()"></p>
                        </div>
                        <div class="text-center p-2 bg-white rounded-lg">
                            <p class="text-gray-500 text-sm">سهم واسط</p>
                            <p class="font-bold text-xl text-purple-600" x-text="(newOrder.agentShare || 0).toLocaleString()"></p>
                        </div>
                        <div class="text-center p-2 bg-white rounded-lg">
                            <p class="text-gray-500 text-sm">سهم شرکت</p>
                            <p class="font-bold text-xl text-gray-600" x-text="(newOrder.companyShare || 0).toLocaleString()"></p>
                        </div>
                        <div class="text-center p-2 bg-white rounded-lg">
                            <p class="text-gray-500 text-sm">سهم عامل</p>
                            <p class="font-bold text-xl text-green-600" x-text="(newOrder.doctorShare || 0).toLocaleString()"></p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },
    
    // Step 4: تخصیص به عامل
    getStep4() {
        // Get doctors from DataModule
        const doctorsHTML = `
            <div x-show="currentStep === 3" class="space-y-4" x-data="{
                assignmentMode: 'single',
                workAssignments: {}
            }">
                <h4 class="text-lg font-semibold text-gray-700 mb-4 border-b pb-2">
                    <i class="fas fa-user-md text-indigo-500 ml-2"></i>
                    تخصیص کارها به عامل (نویسنده)
                </h4>
                
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
                    <p class="text-base text-gray-700">
                        <i class="fas fa-info-circle ml-1"></i>
                        می‌توانید همه کارها را به یک نفر یا هر کار را به شخص مجزا تخصیص دهید
                    </p>
                </div>
                
                <!-- Assignment Mode Selection -->
                <div class="bg-white border rounded-lg p-4 mb-4">
                    <label class="block text-xl font-bold text-gray-800 mb-3">نحوه تخصیص:</label>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <button type="button" @click="assignmentMode = 'single'" 
                                :class="assignmentMode === 'single' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300'"
                                class="border-2 rounded-lg p-3 transition-all hover:border-purple-400">
                            <i class="fas fa-user text-2xl mb-2"></i>
                            <p class="font-medium">همه به یک نفر</p>
                            <p class="text-sm mt-1 opacity-80">تخصیص همه کارها به یک عامل</p>
                        </button>
                        <button type="button" @click="assignmentMode = 'multiple'" 
                                :class="assignmentMode === 'multiple' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300'"
                                class="border-2 rounded-lg p-3 transition-all hover:border-purple-400">
                            <i class="fas fa-users text-2xl mb-2"></i>
                            <p class="font-medium">هر کار به یک نفر</p>
                            <p class="text-sm mt-1 opacity-80">تخصیص جداگانه هر کار</p>
                        </button>
                        <button type="button" @click="assignmentMode = 'later'" 
                                :class="assignmentMode === 'later' ? 'bg-gray-600 text-white border-gray-600' : 'bg-white text-gray-700 border-gray-300'"
                                class="border-2 rounded-lg p-3 transition-all hover:border-gray-400">
                            <i class="fas fa-clock text-2xl mb-2"></i>
                            <p class="font-medium">تخصیص بعدی</p>
                            <p class="text-sm mt-1 opacity-80">بدون تخصیص ثبت شود</p>
                        </button>
                    </div>
                </div>
                
                <!-- Single Assignment Mode -->
                <div x-show="assignmentMode === 'single'" class="bg-white border rounded-lg p-4">
                    <label class="block text-xl font-bold text-gray-800 mb-3">انتخاب عامل برای همه کارها:</label>
                    <div class="space-y-3 max-h-[400px] overflow-y-auto">
                        <template x-for="doctor in (typeof DataModule !== 'undefined' ? DataModule.getUsers().filter(u => u.role === 'doctor') : [])" :key="doctor.id">
                            <div class="doctor-card border-2 rounded-lg p-4 cursor-pointer transition-all hover:border-purple-400 hover:bg-purple-50"
                                 :class="selectedDoctor === doctor.id ? 'border-purple-600 bg-purple-50' : 'border-gray-200'"
                                 @click="selectedDoctor = doctor.id; newOrder.assignedDoctorId = doctor.id; newOrder.assignedDoctor = doctor.name; newOrder.workAssignments = {};">
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center">
                                        <div class="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center ml-3">
                                            <i class="fas fa-user-md text-purple-600 text-2xl"></i>
                                        </div>
                                        <div>
                                            <p class="font-bold text-gray-800" x-text="doctor.name"></p>
                                            <p class="text-base text-gray-500" x-text="doctor.specialization || 'متخصص'"></p>
                                            <p class="text-sm text-gray-400" x-text="doctor.email || ''"></p>
                                        </div>
                                    </div>
                                    <div x-show="selectedDoctor === doctor.id" class="text-purple-600">
                                        <i class="fas fa-check-circle text-2xl"></i>
                                    </div>
                                </div>
                            </div>
                        </template>
                    </div>
                    
                    <!-- Selected Doctor Summary -->
                    <div x-show="selectedDoctor" class="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                        <h5 class="font-semibold text-green-800 mb-2">
                            <i class="fas fa-check-circle ml-1"></i>
                            عامل انتخاب شده
                        </h5>
                        <p class="text-green-700" x-text="'همه کارها به ' + (newOrder.assignedDoctor || '') + ' تخصیص خواهد یافت'"></p>
                    </div>
                </div>
                
                <!-- Multiple Assignment Mode -->
                <div x-show="assignmentMode === 'multiple'" class="bg-white border rounded-lg p-4">
                    <label class="block text-xl font-bold text-gray-800 mb-3">تخصیص هر کار به یک عامل:</label>
                    <div class="space-y-4">
                        <template x-for="(work, index) in newOrder.workList" :key="index">
                            <div class="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <div class="flex items-center mb-3">
                                    <span class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-base ml-3"
                                          x-text="index + 1"></span>
                                    <p class="font-bold text-gray-800" x-text="work"></p>
                                </div>
                                <select x-model="workAssignments[work]" 
                                        @change="if (!newOrder.workAssignments) newOrder.workAssignments = {}; newOrder.workAssignments[work] = workAssignments[work];"
                                        class="form-control">
                                    <option value="">انتخاب عامل...</option>
                                    <template x-for="doctor in (typeof DataModule !== 'undefined' ? DataModule.getUsers().filter(u => u.role === 'doctor') : [])" :key="doctor.id">
                                        <option :value="doctor.id" x-text="doctor.name + ' - ' + (doctor.specialization || 'متخصص')"></option>
                                    </template>
                                </select>
                            </div>
                        </template>
                    </div>
                    
                    <!-- Assignment Summary -->
                    <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4">
                        <h5 class="font-semibold text-gray-800 mb-2">
                            <i class="fas fa-info-circle ml-1"></i>
                            خلاصه تخصیص‌ها
                        </h5>
                        <div class="space-y-1 text-base text-gray-700">
                            <template x-for="(work, index) in newOrder.workList" :key="index">
                                <p x-show="workAssignments[work]">
                                    <i class="fas fa-check ml-1"></i>
                                    <span x-text="work"></span>: 
                                    <span class="font-medium" x-text="(typeof DataModule !== 'undefined' ? DataModule.getUsers().find(u => u.id === workAssignments[work])?.name : '') || 'نامشخص'"></span>
                                </p>
                            </template>
                        </div>
                    </div>
                </div>
                
                <!-- Later Assignment Mode -->
                <div x-show="assignmentMode === 'later'" class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h5 class="font-semibold text-yellow-800 mb-2">
                        <i class="fas fa-exclamation-triangle ml-1"></i>
                        تخصیص بعدی
                    </h5>
                    <p class="text-yellow-700">سفارش بدون تخصیص ثبت خواهد شد. می‌توانید بعداً از صفحه سفارشات، عامل را تخصیص دهید.</p>
                </div>
            </div>
        `;
        
        return doctorsHTML;
    },
    
    // Navigation buttons
    getNavigationButtons() {
        return `
            <div class="flex justify-between pt-4 border-t mt-6">
                <div>
                    <button @click="showModal = null" 
                            class="px-4 py-2 text-lg text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                        انصراف
                    </button>
                </div>
                <div class="flex space-x-3 space-x-reverse">
                    <button x-show="currentStep > 0" @click="prevStep()" 
                            class="px-4 py-2 text-lg text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                        <i class="fas fa-arrow-right ml-2"></i>
                        قبلی
                    </button>
                    <button x-show="currentStep < 3" @click="nextStep()" 
                            class="px-4 py-2 text-lg bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                        بعدی
                        <i class="fas fa-arrow-left mr-2"></i>
                    </button>
                    <button x-show="currentStep === 3" @click="submitNewOrder(newOrder)" 
                            class="px-4 py-2 text-lg bg-green-600 text-white rounded-lg hover:bg-green-700">
                        <i class="fas fa-check ml-2"></i>
                        ثبت سفارش
                    </button>
                </div>
            </div>
        `;
    },
    
    // Quick Order Form - فرم سفارش سریع
    getQuickOrderModal() {
        const workOptions = this.workTypes.map(w => `<option value="${w}">${w}</option>`).join('');
        const doctors = DataModule.getUsers().filter(u => u.role === 'agent' || u.role === 'doctor');
        const doctorOptions = doctors.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
        
        return `
            <div x-data="{
                quickOrder: {
                    studentName: '',
                    degree: '',
                    field: '',
                    workType: '',
                    assignedDoctorId: '',
                    deadline: ''
                },
                submitQuickOrder() {
                    // Validation
                    if (!this.quickOrder.studentName || !this.quickOrder.degree || 
                        !this.quickOrder.field || !this.quickOrder.workType) {
                        alert('لطفاً تمام فیلدهای الزامی را پر کنید');
                        return;
                    }
                    
                    // Create order with minimal data
                    const order = {
                        id: 'ord_' + Date.now(),
                        studentName: this.quickOrder.studentName,
                        degree: this.quickOrder.degree,
                        field: this.quickOrder.field,
                        type: this.quickOrder.workType,
                        assignedDoctorId: this.quickOrder.assignedDoctorId || null,
                        deadline: this.quickOrder.deadline || null,
                        status: 'pending',
                        progress: 0,
                        totalAmount: 0,
                        paidAmount: 0,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        // Placeholder values for required fields
                        university: 'نامشخص',
                        passportNumber: '',
                        phone: '',
                        studentId: ''
                    };
                    
                    // Save to localStorage
                    const orders = DataModule.getOrders();
                    orders.push(order);
                    DataModule.saveOrders(orders);
                    
                    // Show success message
                    UTILS.showNotification('سفارش سریع با موفقیت ثبت شد', 'success');
                    
                    // اگر عامل تخصیص داده شده، وظیفه برای او ایجاد شود
                    if (this.quickOrder.assignedDoctorId) {
                        const agentId = this.quickOrder.assignedDoctorId;
                        const users = DataModule.getUsers();
                        const agent = users.find(u => u.id === agentId);
                        
                        if (agent && window.TasksModule && typeof TasksModule.createTaskFromOrder === 'function') {
                            TasksModule.createTaskFromOrder(order, agent);
                            UTILS.showNotification(`وظیفه برای عامل ${agent.name} ایجاد شد`, 'success');
                            debugLogger(`Task created for agent ${agent.name} from quick order`, 'success');
                        }
                    }
                    
                    // Close modal and refresh
                    showModal = null;
                    if (window.OrdersModule && window.OrdersModule.refreshOrders) {
                        window.OrdersModule.refreshOrders();
                    }
                    
                    // Reload page to show new order
                    setTimeout(() => location.reload(), 500);
                }
            `;
            
            // Append modal to body
                <div class="p-6 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50 relative">
                    <button @click="$dispatch('close-modal')" 
                            class="absolute left-4 top-4 text-gray-600 hover:text-gray-800 text-2xl"
                            type="button">
                        <i class="fas fa-times"></i>
                    </button>
                    <h3 class="text-xl font-bold text-gray-900">
                        <i class="fas fa-bolt text-green-600 ml-2"></i>
                        سفارش سریع
                    </h3>
                    <p class="text-sm text-gray-600 mt-1">فقط فیلدهای ضروری - سریع تکمیل کنید</p>
                </div>
                
                <!-- Form -->
                <div class="p-6 space-y-4">
                    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                        <p class="text-sm text-yellow-800">
                            <i class="fas fa-info-circle ml-1"></i>
                            این فرم سریع فقط اطلاعات پایه را می‌گیرد. بعداً می‌توانید جزئیات بیشتر را اضافه کنید.
                        </p>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <!-- نام دانشجو -->
                        <div>
                            <label class="block text-base font-bold text-gray-800 mb-2">
                                نام دانشجو <span class="text-red-500">*</span>
                            </label>
                            <input type="text" x-model="quickOrder.studentName" 
                                   class="form-control" required placeholder="نام کامل دانشجو">
                        </div>
                        
                        <!-- مقطع -->
                        <div>
                            <label class="block text-base font-bold text-gray-800 mb-2">
                                مقطع تحصیلی <span class="text-red-500">*</span>
                            </label>
                            <select x-model="quickOrder.degree" class="form-control" required>
                                <option value="">انتخاب کنید</option>
                                <option value="کارشناسی">کارشناسی</option>
                                <option value="کارشناسی ارشد">کارشناسی ارشد</option>
                                <option value="عاملا">عاملا</option>
                            </select>
                        </div>
                        
                        <!-- رشته -->
                        <div>
                            <label class="block text-base font-bold text-gray-800 mb-2">
                                رشته تحصیلی <span class="text-red-500">*</span>
                            </label>
                            <select x-model="quickOrder.field" class="form-control" required>
                                <option value="">انتخاب کنید</option>
                                <option value="حقوق محض">حقوق محض</option>
                                <option value="حقوق عمومی">حقوق عمومی</option>
                                <option value="حقوق خصوصی">حقوق خصوصی</option>
                                <option value="حقوق بین‌الملل">حقوق بین‌الملل</option>
                                <option value="سایر">سایر</option>
                            </select>
                        </div>
                        
                        <!-- نوع کار -->
                        <div>
                            <label class="block text-base font-bold text-gray-800 mb-2">
                                نوع کار <span class="text-red-500">*</span>
                            </label>
                            <select x-model="quickOrder.workType" class="form-control" required>
                                <option value="">انتخاب کنید</option>
                                ${workOptions}
                            </select>
                        </div>
                        
                        <!-- تخصیص به عامل -->
                        <div>
                            <label class="block text-base font-bold text-gray-800 mb-2">
                                تخصیص به عامل (اختیاری)
                            </label>
                            <select x-model="quickOrder.assignedDoctorId" class="form-control">
                                <option value="">بعداً تخصیص می‌دهم</option>
                                ${doctorOptions}
                            </select>
                        </div>
                        
                        <!-- ددلاین -->
                        <div>
                            <label class="block text-base font-bold text-gray-800 mb-2">
                                تاریخ تحویل (اختیاری)
                            </label>
                            <input type="date" x-model="quickOrder.deadline" class="form-control">
                        </div>
                    </div>
                </div>
                
                <!-- Footer -->
                <div class="p-6 border-t bg-gray-50 flex justify-between">
                    <button @click="$dispatch('close-modal')" 
                            class="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100">
                        انصراف
                    </button>
                    <button @click="submitQuickOrder()" 
                            class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold">
                        <i class="fas fa-check ml-2"></i>
                        ثبت سفارش سریع
                    </button>
                </div>
            </div>
        `;
    }
};

// Register Alpine component IMMEDIATELY when this script loads
(function() {
    console.log('🔵 Order wizard script loaded');
    
    const registerComponent = () => {
        if (typeof Alpine !== 'undefined' && Alpine.data) {
            console.log('🟢 Registering orderWizardData component');
            Alpine.data('orderWizardData', () => OrderWizardModule.getAlpineData());
            return true;
        }
        console.log('⚠️ Alpine not ready yet');
        return false;
    };
    
    // Try to register immediately
    if (!registerComponent()) {
        // If Alpine not ready, wait for alpine:init event
        document.addEventListener('alpine:init', () => {
            console.log('🟡 Alpine init event - registering orderWizardData component');
            if (registerComponent()) {
                console.log('✅ Component registered successfully');
            }
        });
        
        // Also try again after a short delay as fallback
        setTimeout(() => {
            if (!registerComponent()) {
                console.warn('❌ Failed to register orderWizardData component after timeout');
            }
        }, 500);
    }
})();
