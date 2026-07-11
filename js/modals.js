// Modals Management Module
const ModalsModule = {
  // Safe Alpine.js data access helper
  getAlpineData() {
    try {
      const appElement = document.querySelector("[x-data]");
      if (appElement && appElement.__x && appElement.__x.$data) {
        return appElement.__x.$data;
      }

      // Method 2: Try with specific selector
      const bodyElement = document.querySelector("body[x-data]");
      if (bodyElement && bodyElement.__x && bodyElement.__x.$data) {
        return bodyElement.__x.$data;
      }

      // Method 3: Try Alpine._x_dataStack
      const dataElement = document.querySelector('[x-data="appController()"]');
      if (
        dataElement &&
        dataElement._x_dataStack &&
        dataElement._x_dataStack[0]
      ) {
        return dataElement._x_dataStack[0];
      }

      // Method 4: Try window.Alpine
      if (window.Alpine && window.Alpine.$data) {
        return window.Alpine.$data;
      }

      // Method 5: Search all elements with x-data
      const allDataElements = document.querySelectorAll("[x-data]");
      for (const element of allDataElements) {
        if (element.__x && element.__x.$data) {
          return element.__x.$data;
        }
        if (element._x_dataStack && element._x_dataStack[0]) {
          return element._x_dataStack[0];
        }
      }
    } catch (error) {
      debugLogger("Error accessing Alpine.js data", "warning", error);
    }
    return null;
  },

  // Safe modal close helper
  closeModal() {
    try {
      const alpineData = this.getAlpineData();
      if (alpineData) {
        alpineData.showModal = null;
        debugLogger("Modal closed via Alpine data", "success");
        return true;
      }

      // Fallback 1: Try direct Alpine access
      const appElement = document.querySelector('[x-data="appController()"]');
      if (appElement && appElement._x_dataStack && appElement._x_dataStack[0]) {
        appElement._x_dataStack[0].showModal = null;
        debugLogger("Modal closed via direct Alpine access", "success");
        return true;
      }

      // Fallback 2: Try global variable
      if (typeof window.showModal !== "undefined") {
        window.showModal = null;
        debugLogger("Modal closed via global variable", "success");
        return true;
      }

      // Fallback 3: Force close modal by hiding backdrop
      const modals = document.querySelectorAll(
        ".fixed.inset-0.bg-black.bg-opacity-50",
      );
      modals.forEach((modal) => {
        modal.style.display = "none";
        modal.remove();
      });

      // Also try to hide specific modals
      const assignmentModal = document.getElementById("assignment-modal");
      if (assignmentModal) {
        assignmentModal.style.display = "none";
      }

      debugLogger("Modal closed via DOM manipulation", "success");
      return true;
    } catch (error) {
      debugLogger("Error closing modal", "warning", error);
      return false;
    }
  },

  // Open modal by name (Alpine showModal)
  openModal(name) {
    const alpine = this.getAlpineData();
    if (alpine) {
      alpine.showModal = name;
      return true;
    }
    return false;
  },

  // Safe current user getter
  getCurrentUser() {
    try {
      const alpineData = this.getAlpineData();
      if (alpineData && alpineData.currentUser) {
        return alpineData.currentUser;
      }
    } catch (error) {
      debugLogger("Error getting current user from Alpine", "warning", error);
    }
    // Fallback to default manager user
    return { id: "mgr001", name: "مدیر سیستم", role: "manager" };
  },

  // Initialize modals
  init() {
    this.createModalsContainer();
    this.bindEvents();
  },

  // Create modals container
  createModalsContainer() {
    const container = document.getElementById("modals-container");
    if (!container) return;

    container.innerHTML = `
            <!-- New Order Modal -->
            <div x-show="showModal === 'newOrder'" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 modal-backdrop"
                 @click.self="showModal = null">
                <div class="bg-gradient-to-br from-blue-50 to-yellow-100 rounded-lg w-[98vw] max-w-[1600px] h-[98vh] overflow-y-auto modal">
                    ${this.getNewOrderModal()}
                </div>
            </div>

            <!-- View Order Modal -->
            <div x-show="showModal === 'viewOrder'" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 modal-backdrop"
                 @click.self="showModal = null">
                <div class="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto modal">
                    ${this.getViewOrderModal()}
                </div>
            </div>

            <!-- Add User Modal -->
            <div x-show="showModal === 'addUser'" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 modal-backdrop"
                 @click.self="showModal = null">
                <div class="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto modal">
                    ${this.getAddUserModal()}
                </div>
            </div>

            <!-- Edit User Modal -->
            <div x-show="showModal === 'editUser'" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 modal-backdrop"
                 @click.self="showModal = null">
                <div class="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto modal">
                    ${this.getEditUserModal()}
                </div>
            </div>

            <!-- Change Password Modal -->
            <div x-show="showModal === 'changePassword'" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 modal-backdrop"
                 @click.self="showModal = null">
                <div class="bg-white rounded-lg max-w-md w-full modal">
                    ${this.getChangePasswordModal()}
                </div>
            </div>

            <!-- Notifications Modal -->
            <div x-show="showModal === 'notifications'" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 modal-backdrop"
                 @click.self="showModal = null">
                <div class="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto modal">
                    ${this.getNotificationsModal()}
                </div>
            </div>

            <!-- Assign Order Modal -->
            <div x-show="showModal === 'assignOrder'" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 modal-backdrop"
                 @click.self="showModal = null">
                <div class="bg-white rounded-lg max-w-md w-full modal">
                    ${this.getAssignOrderModal()}
                </div>
            </div>

            <!-- Create Project Modal -->
            <div x-show="showModal === 'createProject'" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 modal-backdrop"
                 @click.self="showModal = null">
                <div class="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto modal">
                    ${this.getCreateProjectModal()}
                </div>
            </div>

            <!-- Reject Order Modal -->
            <div x-show="showModal === 'rejectOrder'" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 modal-backdrop"
                 @click.self="showModal = null">
                <div class="bg-white rounded-lg max-w-md w-full modal">
                    ${this.getRejectOrderModal()}
                </div>
            </div>
        `;
  },

  // New Order Modal - استفاده از ماژول Wizard
  getNewOrderModal() {
    if (typeof OrderWizardModule !== 'undefined' && OrderWizardModule.getWizardModal) {
      return OrderWizardModule.getWizardModal();
    }
    return this.getNewOrderModalOld();
  },

  // Old single-page modal (backup)
  getNewOrderModalOld() {
    return `
            <div class="p-6 border-b">
                <h3 class="text-lg font-bold text-gray-800">سفارش جدید</h3>
            </div>
            <div class="p-6 space-y-4" x-data="{
                newOrder: {},
                showCustomUniversity: false,
                showCustomField: false,
                showCustomDegree: false,
                showCustomPhone: false,
                passportPreview: null
            }">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <!-- نام ثلاثی -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">نام ثلاثی <span class="text-red-500">*</span></label>
                        <input type="text" x-model="newOrder.studentName"
                               class="form-control" required placeholder="نام کامل (سه قسمتی)">
                    </div>

                    <!-- لقب -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">لقب <span class="text-red-500">*</span></label>
                        <input type="text" x-model="newOrder.nickname"
                               class="form-control" required placeholder="لقب">
                    </div>

                    <!-- تاریخ تولد -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">تاریخ تولد <span class="text-red-500">*</span></label>
                        <input type="date" x-model="newOrder.birthDate"
                               class="form-control" required>
                    </div>

                    <!-- شماره پاسپورت -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">شماره پاسپورت <span class="text-red-500">*</span></label>
                        <input type="text" x-model="newOrder.passportNumber"
                               class="form-control" required placeholder="شماره پاسپورت">
                    </div>

                    <!-- جنسیت -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">جنسیت <span class="text-red-500">*</span></label>
                        <select x-model="newOrder.gender" class="form-control" required>
                            <option value="">انتخاب کنید</option>
                            <option value="مرد">مرد</option>
                            <option value="زن">زن</option>
                        </select>
                    </div>

                    <!-- مقطع تحصیلی -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">مقطع تحصیلی <span class="text-red-500">*</span></label>
                        <select x-model="newOrder.degreeSelect" class="form-control" required
                                @change="showCustomDegree = (newOrder.degreeSelect === 'سایر');
                                         if(!showCustomDegree) newOrder.degree = newOrder.degreeSelect;">
                            <option value="">انتخاب کنید</option>
                            <option value="کارشناسی">کارشناسی</option>
                            <option value="کارشناسی ارشد">کارشناسی ارشد</option>
                            <option value="دکتری">دکتری</option>
                            <option value="سایر">سایر</option>
                        </select>
                    </div>
                    <div x-show="showCustomDegree">
                        <label class="block text-sm font-medium text-gray-700 mb-2">نام مقطع</label>
                        <input type="text" x-model="newOrder.degree"
                               class="form-control" placeholder="نام مقطع را وارد کنید">
                    </div>

                    <!-- دانشگاه -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">دانشگاه <span class="text-red-500">*</span></label>
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
                        <label class="block text-sm font-medium text-gray-700 mb-2">نام دانشگاه</label>
                        <input type="text" x-model="newOrder.university"
                               class="form-control" placeholder="نام دانشگاه را وارد کنید">
                    </div>

                    <!-- رشته تحصیلی -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">رشته تحصیلی <span class="text-red-500">*</span></label>
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
                        <label class="block text-sm font-medium text-gray-700 mb-2">نام رشته</label>
                        <input type="text" x-model="newOrder.field"
                               class="form-control" placeholder="نام رشته را وارد کنید">
                    </div>

                    <!-- شماره تماس -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">شماره تماس <span class="text-red-500">*</span></label>
                        <div class="flex space-x-2 space-x-reverse">
                            <input type="tel" x-model="newOrder.phone"
                                   class="form-control flex-1" required placeholder="شماره تماس"
                                   x-show="!showCustomPhone">
                            <input type="text" x-model="newOrder.phone"
                                   class="form-control flex-1" placeholder="شماره تماس دیگر"
                                   x-show="showCustomPhone">
                            <button type="button" @click="showCustomPhone = !showCustomPhone"
                                    class="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg border">
                                سایر
                            </button>
                        </div>
                    </div>

                    <!-- نام کاربری بهستان -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">نام کاربری بهستان <span class="text-red-500">*</span></label>
                        <input type="text" x-model="newOrder.behestanUsername"
                               class="form-control" required placeholder="نام کاربری بهستان">
                    </div>

                    <!-- رمز عبور بهستان -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">رمز عبور بهستان <span class="text-red-500">*</span></label>
                        <input type="text" x-model="newOrder.behestanPassword"
                               class="form-control" required placeholder="رمز عبور بهستان">
                    </div>

                    <!-- شماره دانشجویی -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">شماره دانشجویی <span class="text-red-500">*</span></label>
                        <input type="text" x-model="newOrder.studentId"
                               class="form-control" required placeholder="شماره دانشجویی">
                    </div>

                    <!-- نوع سفارش -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">نوع سفارش <span class="text-red-500">*</span></label>
                        <select x-model="newOrder.type" class="form-control" required
                                @change="newOrder.totalAmount = calculateOrderPrice(newOrder.type, newOrder.degree)">
                            <option value="">انتخاب کنید</option>
                            ${Object.values(CONFIG.ORDER_TYPES)
                              .map(
                                (type) =>
                                  `<option value="${type}">${type}</option>`,
                              )
                              .join("")}
                        </select>
                    </div>

                    <!-- مهلت تحویل -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">مهلت تحویل <span class="text-red-500">*</span></label>
                        <input type="date" x-model="newOrder.deadline" class="form-control" required>
                    </div>
                </div>

                <!-- عکس پاسپورت -->
                <div class="mt-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">عکس پاسپورت <span class="text-red-500">*</span></label>
                    <div class="border-2 border-dashed border-gray-300 rounded-lg p-4">
                        <input type="file" id="passport-image-input" accept="image/*" class="hidden"
                               @change="
                                   const file = $event.target.files[0];
                                   if (file) {
                                       const reader = new FileReader();
                                       reader.onload = (e) => {
                                           passportPreview = e.target.result;
                                           newOrder.passportImage = e.target.result;
                                       };
                                       reader.readAsDataURL(file);
                                   }
                               ">
                        <div x-show="!passportPreview" class="text-center">
                            <i class="fas fa-passport text-4xl text-gray-400 mb-2"></i>
                            <p class="text-gray-500 text-sm mb-2">عکس پاسپورت را آپلود کنید</p>
                            <button type="button" @click="document.getElementById('passport-image-input').click()"
                                    class="px-4 py-2 bg-yellow-600 text-gray-900 rounded-lg hover:bg-yellow-700 text-sm">
                                <i class="fas fa-upload ml-2"></i>
                                انتخاب فایل
                            </button>
                        </div>
                        <div x-show="passportPreview" class="text-center">
                            <img :src="passportPreview" class="max-h-40 mx-auto rounded-lg mb-2">
                            <button type="button" @click="passportPreview = null; newOrder.passportImage = null;"
                                    class="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm">
                                <i class="fas fa-trash ml-1"></i>
                                حذف
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Price Calculation -->
                <div class="bg-gray-50 p-4 rounded-lg" x-show="newOrder.type">
                    <h4 class="font-semibold mb-2">محاسبه هزینه</h4>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                            <span class="text-gray-600">مبلغ کل:</span>
                            <span class="font-bold" x-text="formatCurrency(newOrder.totalAmount || 0)"></span>
                        </div>
                        <div>
                            <span class="text-gray-600">سهم عامل:</span>
                            <span class="font-bold text-green-600" x-text="formatCurrency((newOrder.totalAmount || 0) * 0.6)"></span>
                        </div>
                        <div>
                            <span class="text-gray-600">سهم مدیر:</span>
                            <span class="font-bold text-blue-600" x-text="formatCurrency((newOrder.totalAmount || 0) * 0.4)"></span>
                        </div>
                    </div>
                </div>

                <!-- توضیحات -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">توضیحات لازم (اختیاری)</label>
                    <textarea x-model="newOrder.description" rows="3" class="form-control" placeholder="توضیحات اضافی..."></textarea>
                </div>

                <div class="flex justify-end space-x-3 space-x-reverse pt-4">
                    <button @click="showModal = null"
                            class="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                        انصراف
                    </button>
                    <button @click="submitNewOrder(newOrder)"
                            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 btn">
                        ثبت سفارش
                    </button>
                </div>
            </div>
        `;
  },

  // View Order Modal
  getViewOrderModal() {
    return `
            <div class="p-6 border-b">
                <h3 class="text-lg font-bold text-gray-800">جزئیات سفارش</h3>
            </div>
            <div class="p-6" x-show="selectedOrder">
                <!-- Order Details will be populated by JavaScript -->
                <div id="order-details-content"></div>

                <div class="flex justify-end pt-4 border-t">
                    <button @click="showModal = null"
                            class="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                        بستن
                    </button>
                </div>
            </div>
        `;
  },

  // Add User Modal
  getAddUserModal() {
    return `
            <div class="p-6 border-b">
                <h3 class="text-lg font-bold text-gray-800">
                    <i class="fas fa-user-plus text-blue-600 ml-2"></i>
                    افزودن کاربر جدید
                </h3>
            </div>
            <div class="p-6 space-y-4 max-h-[70vh] overflow-y-auto" x-data="{ newUser: { role: '' }, showStudentFields: false }">
                <!-- Basic Info -->
                <div class="bg-blue-50 p-4 rounded-lg">
                    <h4 class="font-semibold text-blue-800 mb-3"><i class="fas fa-info-circle ml-1"></i> اطلاعات پایه</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">نقش <span class="text-red-500">*</span></label>
                            <select x-model="newUser.role" class="form-control" required
                                    @change="showStudentFields = (newUser.role === 'student')">
                                <option value="">انتخاب کنید</option>
                                <option value="student">دانشجو</option>
                                <option value="agent">عامل</option>
                                <option value="employee">کارمند</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">نام و نام خانوادگی <span class="text-red-500">*</span></label>
                            <input type="text" x-model="newUser.name" class="form-control" required placeholder="نام کامل">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">نام کاربری <span class="text-red-500">*</span></label>
                            <input type="text" x-model="newUser.username" class="form-control" required placeholder="برای ورود به سیستم">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">رمز عبور <span class="text-red-500">*</span></label>
                            <input type="password" x-model="newUser.password" class="form-control" required placeholder="حداقل 6 کاراکتر">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">ایمیل</label>
                            <input type="email" x-model="newUser.email" class="form-control" placeholder="example@email.com">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">تلفن</label>
                            <input type="text" x-model="newUser.phone" class="form-control" placeholder="+98...">
                        </div>
                    </div>
                </div>

                <!-- Student Specific Fields -->
                <div x-show="showStudentFields" class="bg-green-50 p-4 rounded-lg">
                    <h4 class="font-semibold text-green-800 mb-3"><i class="fas fa-graduation-cap ml-1"></i> اطلاعات تحصیلی دانشجو</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">دانشگاه <span class="text-red-500">*</span></label>
                            <select x-model="newUser.university" class="form-control">
                                <option value="">انتخاب کنید</option>
                                <option value="دانشگاه قم">دانشگاه قم</option>
                                <option value="جامعه المصطفی">جامعه المصطفی</option>
                                <option value="سایر">سایر</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">شماره دانشجویی <span class="text-red-500">*</span></label>
                            <input type="text" x-model="newUser.studentId" class="form-control" placeholder="شماره دانشجویی">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">رمز سامانه</label>
                            <input type="text" x-model="newUser.systemPassword" class="form-control" placeholder="رمز سامانه دانشگاه">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">رشته تحصیلی <span class="text-red-500">*</span></label>
                            <select x-model="newUser.field" class="form-control">
                                <option value="">انتخاب کنید</option>
                                <option value="حقوق محض">حقوق محض</option>
                                <option value="حقوق عمومی">حقوق عمومی</option>
                                <option value="حقوق خصوصی">حقوق خصوصی</option>
                                <option value="حقوق بین‌الملل">حقوق بین‌الملل</option>
                                <option value="سایر">سایر</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">مقطع تحصیلی <span class="text-red-500">*</span></label>
                            <select x-model="newUser.degree" class="form-control">
                                <option value="">انتخاب کنید</option>
                                <option value="ارشد">کارشناسی ارشد</option>
                                <option value="دکتری">دکتری</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">علاقه‌مندی تحقیقاتی</label>
                            <input type="text" x-model="newUser.interest" class="form-control" placeholder="موضوع علاقه‌مندی">
                        </div>
                    </div>
                </div>

                <!-- Additional Info (Student) -->
                <div x-show="showStudentFields" class="bg-yellow-50 p-4 rounded-lg">
                    <h4 class="font-semibold text-yellow-800 mb-3"><i class="fas fa-tasks ml-1"></i> اطلاعات تکمیلی</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">استاد راهنما</label>
                            <input type="text" x-model="newUser.supervisor" class="form-control" placeholder="نام استاد راهنما">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">نویسنده (عامل مسئول)</label>
                            <input type="text" x-model="newUser.assignedWriter" class="form-control" placeholder="نام نویسنده">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">تاریخ تحویل</label>
                            <input type="date" x-model="newUser.deliveryDate" class="form-control">
                        </div>
                    </div>
                </div>

                <!-- Agent Specific Fields -->
                <div x-show="newUser.role === 'agent'" class="bg-yellow-50 p-4 rounded-lg">
                    <h4 class="font-semibold text-yellow-800 mb-3"><i class="fas fa-user-tie ml-1"></i> اطلاعات عامل</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">نوع کار (تخصص)</label>
                            <select x-model="newUser.specialization" class="form-control">
                                <option value="">انتخاب کنید</option>
                                <option value="نوشتن رساله">نوشتن رساله</option>
                                <option value="نوشتن مقاله">نوشتن مقاله</option>
                                <option value="ترجمه">ترجمه</option>
                                <option value="تلخیص">تلخیص</option>
                                <option value="امورداری">امورداری</option>
                                <option value="تنضید">تنضید</option>
                                <option value="همه موارد">همه موارد</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">بخش</label>
                            <input type="text" x-model="newUser.department" class="form-control" placeholder="بخش مسئولیت">
                        </div>
                    </div>
                </div>

                <!-- employee Specific Fields -->
                <div x-show="newUser.role === 'employee'" class="bg-pink-50 p-4 rounded-lg">
                    <h4 class="font-semibold text-pink-800 mb-3"><i class="fas fa-users-cog ml-1"></i> اطلاعات کارمند</h4>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">بخش</label>
                        <input type="text" x-model="newUser.department" class="form-control" placeholder="بخش مسئولیت">
                    </div>
                </div>

                <div class="flex justify-end space-x-3 space-x-reverse pt-4 border-t">
                    <button @click="showModal = null"
                            class="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                        انصراف
                    </button>
                    <button @click="submitNewUser(newUser)"
                            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 btn">
                        <i class="fas fa-plus ml-2"></i>
                        افزودن کاربر
                    </button>
                </div>
            </div>
        `;
  },

  // Edit User Modal
  getEditUserModal() {
    const userData = window.editingUserData || {};
    const isStudent = userData.role === "student";

    return `
            <div class="p-6 border-b">
                <h3 class="text-lg font-bold text-gray-800">
                    <i class="fas fa-user-edit text-blue-600 ml-2"></i>
                    ویرایش کاربر
                </h3>
            </div>
            <div class="p-6 space-y-4 max-h-[70vh] overflow-y-auto" x-data='{ editUser: ${JSON.stringify(userData)}, showStudentFields: ${isStudent} }'>
                <!-- Basic Info -->
                <div class="bg-blue-50 p-4 rounded-lg">
                    <h4 class="font-semibold text-blue-800 mb-3"><i class="fas fa-info-circle ml-1"></i> اطلاعات پایه</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">نقش <span class="text-red-500">*</span></label>
                            <select x-model="editUser.role" class="form-control" required
                                    @change="showStudentFields = (editUser.role === 'student')">
                                <option value="student">دانشجو</option>
                                <option value="agent">عامل</option>
                                <option value="employee">کارمند</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">نام و نام خانوادگی <span class="text-red-500">*</span></label>
                            <input type="text" x-model="editUser.name" class="form-control" required>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">نام کاربری <span class="text-red-500">*</span></label>
                            <input type="text" x-model="editUser.username" class="form-control" required>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">رمز عبور</label>
                            <input type="password" x-model="editUser.password" class="form-control" placeholder="برای تغییر رمز وارد کنید">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">ایمیل</label>
                            <input type="email" x-model="editUser.email" class="form-control">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">تلفن</label>
                            <input type="text" x-model="editUser.phone" class="form-control">
                        </div>
                    </div>
                </div>

                <!-- Role-specific fields -->
                <div x-show="editUser.role === 'agent'" class="bg-yellow-50 p-4 rounded-lg">
                    <h4 class="font-semibold text-yellow-800 mb-3"><i class="fas fa-user-tie ml-1"></i> اطلاعات عامل</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">نوع کار (تخصص)</label>
                            <select x-model="editUser.specialization" class="form-control">
                                <option value="">انتخاب کنید</option>
                                <option value="نوشتن رساله">نوشتن رساله</option>
                                <option value="نوشتن مقاله">نوشتن مقاله</option>
                                <option value="ترجمه">ترجمه</option>
                                <option value="تلخیص">تلخیص</option>
                                <option value="امورداری">امورداری</option>
                                <option value="تنضید">تنضید</option>
                                <option value="همه موارد">همه موارد</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">بخش</label>
                            <input type="text" x-model="editUser.department" class="form-control">
                        </div>
                    </div>
                </div>

                <div x-show="editUser.role === 'employee'" class="bg-pink-50 p-4 rounded-lg">
                    <h4 class="font-semibold text-pink-800 mb-3"><i class="fas fa-users-cog ml-1"></i> اطلاعات کارمند</h4>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">بخش</label>
                        <input type="text" x-model="editUser.department" class="form-control">
                    </div>
                </div>

                <div class="flex justify-end space-x-3 space-x-reverse pt-4 border-t">
                    <button @click="showModal = null"
                            class="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                        انصراف
                    </button>
                    <button @click="submitEditUser(editUser)"
                            class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 btn">
                        <i class="fas fa-save ml-2"></i>
                        ذخیره تغییرات
                    </button>
                </div>
            </div>
        `;
  },

  // Change Password Modal
  getChangePasswordModal() {
    return `
            <div class="p-6 border-b">
                <h3 class="text-lg font-bold text-gray-800">تغییر رمز عبور</h3>
            </div>
            <div class="p-6 space-y-4" x-data="{ passwordForm: {} }">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">رمز عبور فعلی</label>
                    <input type="password" x-model="passwordForm.currentPassword" class="form-control" required>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">رمز عبور جدید</label>
                    <input type="password" x-model="passwordForm.newPassword" class="form-control" required>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">تکرار رمز عبور جدید</label>
                    <input type="password" x-model="passwordForm.confirmPassword" class="form-control" required>
                </div>

                <div class="flex justify-end space-x-3 space-x-reverse pt-4">
                    <button @click="showModal = null"
                            class="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                        انصراف
                    </button>
                    <button @click="changePassword(passwordForm)"
                            class="px-4 py-2 bg-yellow-600 text-gray-900 rounded-lg hover:bg-yellow-700 btn">
                        تغییر رمز
                    </button>
                </div>
            </div>
        `;
  },

  // Notifications Modal
  getNotificationsModal() {
    return `
            <div class="p-6 border-b">
                <h3 class="text-lg font-bold text-gray-800">اعلان‌ها</h3>
            </div>
            <div class="p-6">
                <div class="space-y-3" x-show="notifications.length > 0">
                    <template x-for="notification in notifications" :key="notification.id">
                        <div class="p-3 border rounded-lg hover:bg-gray-50">
                            <div class="flex justify-between items-start">
                                <div class="flex-1">
                                    <p class="text-sm font-medium" x-text="notification.message"></p>
                                    <p class="text-xs text-gray-500" x-text="notification.time"></p>
                                </div>
                                <span class="px-2 py-1 rounded-full text-xs font-medium"
                                      :class="notification.type === 'success' ? 'bg-green-100 text-green-800' :
                                             notification.type === 'error' ? 'bg-red-100 text-red-800' :
                                             'bg-blue-100 text-blue-800'">
                                    <i :class="notification.type === 'success' ? 'fas fa-check' :
                                              notification.type === 'error' ? 'fas fa-times' :
                                              'fas fa-info'"></i>
                                </span>
                            </div>
                        </div>
                    </template>
                </div>

                <div x-show="notifications.length === 0" class="text-center py-8">
                    <i class="fas fa-bell-slash text-4xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500">اعلانی موجود نیست</p>
                </div>

                <div class="flex justify-end pt-4 border-t">
                    <button @click="showModal = null"
                            class="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                        بستن
                    </button>
                </div>
            </div>
        `;
  },

  // Assign Order Modal
  getAssignOrderModal() {
    const doctors = DataModule.getUsers().filter(
      (u) => u.role === CONFIG.ROLES.DOCTOR,
    );
    return `
            <div class="p-6 border-b">
                <h3 class="text-lg font-bold text-gray-800">
                    <i class="fas fa-user-plus text-yellow-600 ml-2"></i>
                    تخصیص سفارش به عامل
                </h3>
            </div>
            <div class="p-6 space-y-4" x-data="{ selectedDoctor: '' }">
                <div id="assign-order-info" class="bg-gray-50 p-4 rounded-lg">
                    <p class="text-sm text-gray-600">در حال بارگذاری...</p>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-3">انتخاب عامل:</label>
                    <div class="space-y-2">
                        ${doctors
                          .map(
                            (d) => `
                            <div class="doctor-card border-2 rounded-lg p-4 cursor-pointer transition-all hover:border-yellow-400 hover:bg-yellow-50"
                                 :class="selectedDoctor === '${d.id}' ? 'border-yellow-600 bg-yellow-50' : 'border-gray-200'"
                                 @click="selectedDoctor = '${d.id}'">
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center">
                                        <div class="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center ml-3">
                                            <i class="fas fa-user-md text-yellow-600"></i>
                                        </div>
                                        <div>
                                            <p class="font-semibold text-gray-800">${d.name}</p>
                                            <p class="text-sm text-gray-500">${d.specialization || "متخصص"}</p>
                                        </div>
                                    </div>
                                    <div x-show="selectedDoctor === '${d.id}'" class="text-yellow-600">
                                        <i class="fas fa-check-circle text-xl"></i>
                                    </div>
                                </div>
                            </div>
                        `,
                          )
                          .join("")}
                    </div>
                </div>

                <div class="flex justify-end space-x-3 space-x-reverse pt-4 border-t">
                    <button @click="showModal = null"
                            class="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                        انصراف
                    </button>
                    <button @click="submitAssignOrder(selectedDoctor)"
                            :disabled="!selectedDoctor"
                            :class="selectedDoctor ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-gray-300 cursor-not-allowed'"
                            class="px-4 py-2 text-white rounded-lg btn">
                        <i class="fas fa-check ml-2"></i>
                        تخصیص به عامل
                    </button>
                </div>
            </div>
        `;
  },

  // Create Project Modal
  getCreateProjectModal() {
    if (typeof OrderWizardModule !== 'undefined' && OrderWizardModule.getWizardModal) {
      return OrderWizardModule.getWizardModal();
    }
    return this.getCreateProjectModalOld();
  },

  // Old Create Project Modal (kept for reference)
  getCreateProjectModalOld() {
    // Get current user role
    let currentUserRole = "manager";
    let currentUserId = "mgr001";
    const currentUser = this.getCurrentUser();
    if (currentUser) {
      currentUserRole = currentUser.role;
      currentUserId = currentUser.id;
    }

    const doctors = DataModule.getUsers().filter(
      (u) => u.role === CONFIG.ROLES.DOCTOR,
    );
    const students = DataModule.getUsers().filter(
      (u) => u.role === CONFIG.ROLES.STUDENT,
    );

    // For students, show simplified version
    if (currentUserRole === CONFIG.ROLES.STUDENT) {
      return this.getStudentProjectModal(currentUserId);
    }

    // For managers, show full version with student selection
    return `
            <div class="p-6 border-b">
                <h3 class="text-lg font-bold text-gray-800">
                    <i class="fas fa-project-diagram text-yellow-600 ml-2"></i>
                    ایجاد پروژه جدید
                </h3>
                <p class="text-sm text-gray-600 mt-1">پروژه جدید ایجاد کنید و مستقیماً به عامل تخصیص دهید</p>
            </div>
            <div class="p-6 space-y-6" x-data="{
                newProject: {},
                showCustomUniversity: false,
                showCustomField: false,
                selectedStudent: '',
                selectedDoctor: ''
            }">

                <!-- Student Selection -->
                <div class="bg-blue-50 p-4 rounded-lg">
                    <h4 class="font-semibold text-blue-800 mb-3">
                        <i class="fas fa-user-graduate ml-1"></i> انتخاب دانشجو
                    </h4>
                    <div class="grid grid-cols-1 gap-3">
                        ${students
                          .map(
                            (student) => `
                            <div class="student-card border-2 rounded-lg p-3 cursor-pointer transition-all hover:border-blue-400 hover:bg-blue-50"
                                 :class="selectedStudent === '${student.id}' ? 'border-blue-600 bg-blue-100' : 'border-gray-200 bg-white'"
                                 @click="selectedStudent = '${student.id}';
                                         newProject.studentId = '${student.id}';
                                         newProject.studentName = '${student.name}';
                                         newProject.university = '${student.university || ""}';
                                         newProject.field = '${student.field || ""}';">
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center">
                                        <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center ml-3">
                                            <i class="fas fa-user text-blue-600"></i>
                                        </div>
                                        <div>
                                            <p class="font-semibold text-gray-800">${student.name}</p>
                                            <p class="text-sm text-gray-500">${student.university || "دانشگاه نامشخص"} - ${student.field || "رشته نامشخص"}</p>
                                        </div>
                                    </div>
                                    <div x-show="selectedStudent === '${student.id}'" class="text-blue-600">
                                        <i class="fas fa-check-circle text-xl"></i>
                                    </div>
                                </div>
                            </div>
                        `,
                          )
                          .join("")}
                    </div>
                </div>

                <!-- Project Details -->
                <div class="bg-green-50 p-4 rounded-lg">
                    <h4 class="font-semibold text-green-800 mb-3">
                        <i class="fas fa-clipboard-list ml-1"></i> جزئیات پروژه
                    </h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">نوع پروژه <span class="text-red-500">*</span></label>
                            <select x-model="newProject.type" class="form-control" required
                                    @change="newProject.totalAmount = calculateOrderPrice(newProject.type, newProject.degree)">
                                <option value="">انتخاب کنید</option>
                                ${Object.values(CONFIG.ORDER_TYPES)
                                  .map(
                                    (type) =>
                                      `<option value="${type}">${type}</option>`,
                                  )
                                  .join("")}
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">مقطع تحصیلی <span class="text-red-500">*</span></label>
                            <select x-model="newProject.degree" class="form-control" required>
                                <option value="">انتخاب کنید</option>
                                <option value="ارشد">کارشناسی ارشد</option>
                                <option value="دکتری">دکتری</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">مهلت تحویل <span class="text-red-500">*</span></label>
                            <input type="date" x-model="newProject.deadline" class="form-control" required>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">اولویت پروژه</label>
                            <select x-model="newProject.priority" class="form-control">
                                <option value="normal">عادی</option>
                                <option value="high">بالا</option>
                                <option value="urgent">فوری</option>
                            </select>
                        </div>
                    </div>

                    <div class="mt-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">توضیحات پروژه</label>
                        <textarea x-model="newProject.description" rows="3" class="form-control"
                                  placeholder="توضیحات تکمیلی در مورد پروژه..."></textarea>
                    </div>
                </div>

                <!-- Doctor Assignment -->
                <div class="bg-yellow-50 p-4 rounded-lg">
                    <h4 class="font-semibold text-yellow-800 mb-3">
                        <i class="fas fa-user-md ml-1"></i> تخصیص به عامل
                    </h4>
                    <div class="grid grid-cols-1 gap-3">
                        ${doctors
                          .map(
                            (doctor) => `
                            <div class="doctor-card border-2 rounded-lg p-3 cursor-pointer transition-all hover:border-yellow-400 hover:bg-yellow-50"
                                 :class="selectedDoctor === '${doctor.id}' ? 'border-yellow-600 bg-yellow-100' : 'border-gray-200 bg-white'"
                                 @click="selectedDoctor = '${doctor.id}';
                                         newProject.assignedDoctorId = '${doctor.id}';
                                         newProject.assignedDoctor = '${doctor.name}';">
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center">
                                        <div class="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center ml-3">
                                            <i class="fas fa-user-md text-yellow-600"></i>
                                        </div>
                                        <div>
                                            <p class="font-semibold text-gray-800">${doctor.name}</p>
                                            <p class="text-sm text-gray-500">${doctor.specialization || "متخصص"}</p>
                                        </div>
                                    </div>
                                    <div x-show="selectedDoctor === '${doctor.id}'" class="text-yellow-600">
                                        <i class="fas fa-check-circle text-xl"></i>
                                    </div>
                                </div>
                            </div>
                        `,
                          )
                          .join("")}
                    </div>
                </div>

                <!-- Price Calculation -->
                <div class="bg-gray-50 p-4 rounded-lg" x-show="newProject.type && newProject.degree">
                    <h4 class="font-semibold mb-2">محاسبه هزینه</h4>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                            <span class="text-gray-600">مبلغ کل:</span>
                            <span class="font-bold" x-text="formatCurrency(newProject.totalAmount || 0)"></span>
                        </div>
                        <div>
                            <span class="text-gray-600">سهم عامل:</span>
                            <span class="font-bold text-green-600" x-text="formatCurrency((newProject.totalAmount || 0) * 0.6)"></span>
                        </div>
                        <div>
                            <span class="text-gray-600">سهم مدیر:</span>
                            <span class="font-bold text-blue-600" x-text="formatCurrency((newProject.totalAmount || 0) * 0.4)"></span>
                        </div>
                    </div>
                </div>

                <div class="flex justify-end space-x-3 space-x-reverse pt-4 border-t">
                    <button @click="showModal = null"
                            class="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                        انصراف
                    </button>
                    <button @click="submitCreateProject(newProject)"
                            :disabled="!selectedStudent || !selectedDoctor || !newProject.type || !newProject.degree || !newProject.deadline"
                            :class="(selectedStudent && selectedDoctor && newProject.type && newProject.degree && newProject.deadline) ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-gray-300 cursor-not-allowed'"
                            class="px-4 py-2 text-white rounded-lg btn">
                        <i class="fas fa-plus ml-2"></i>
                        ایجاد پروژه
                    </button>
                </div>
            </div>
        `;
  },

  // Student Project Modal (simplified version)
  getStudentProjectModal(studentId) {
    const currentUser = DataModule.getUsers().find((u) => u.id === studentId);

    return `
            <div class="p-6 border-b">
                <h3 class="text-lg font-bold text-gray-800">
                    <i class="fas fa-plus text-blue-600 ml-2"></i>
                    درخواست پروژه جدید
                </h3>
                <p class="text-sm text-gray-600 mt-1">درخواست پروژه جدید خود را ثبت کنید</p>
            </div>
            <div class="p-6 space-y-6" x-data="{
                newProject: {
                    studentId: '${studentId}',
                    studentName: '${currentUser?.name || ""}',
                    university: '${currentUser?.university || ""}',
                    field: '${currentUser?.field || ""}'
                }
            }">

                <!-- Student Info (Read-only) -->
                <div class="bg-blue-50 p-4 rounded-lg">
                    <h4 class="font-semibold text-blue-800 mb-3">
                        <i class="fas fa-user ml-1"></i> اطلاعات دانشجو
                    </h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">نام</label>
                            <input type="text" value="${currentUser?.name || ""}" class="form-control bg-gray-100" readonly>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">دانشگاه</label>
                            <input type="text" value="${currentUser?.university || ""}" class="form-control bg-gray-100" readonly>
                        </div>
                    </div>
                </div>

                <!-- Project Details -->
                <div class="bg-green-50 p-4 rounded-lg">
                    <h4 class="font-semibold text-green-800 mb-3">
                        <i class="fas fa-clipboard-list ml-1"></i> جزئیات پروژه
                    </h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">نوع پروژه <span class="text-red-500">*</span></label>
                            <select x-model="newProject.type" class="form-control" required
                                    @change="newProject.totalAmount = calculateOrderPrice(newProject.type, newProject.degree)">
                                <option value="">انتخاب کنید</option>
                                ${Object.values(CONFIG.ORDER_TYPES)
                                  .map(
                                    (type) =>
                                      `<option value="${type}">${type}</option>`,
                                  )
                                  .join("")}
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">مقطع تحصیلی <span class="text-red-500">*</span></label>
                            <select x-model="newProject.degree" class="form-control" required>
                                <option value="">انتخاب کنید</option>
                                <option value="ارشد">کارشناسی ارشد</option>
                                <option value="دکتری">دکتری</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">مهلت مورد نظر <span class="text-red-500">*</span></label>
                            <input type="date" x-model="newProject.deadline" class="form-control" required>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">اولویت</label>
                            <select x-model="newProject.priority" class="form-control">
                                <option value="normal">عادی</option>
                                <option value="high">بالا</option>
                                <option value="urgent">فوری</option>
                            </select>
                        </div>
                    </div>

                    <div class="mt-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">توضیحات و نیازمندی‌ها</label>
                        <textarea x-model="newProject.description" rows="4" class="form-control"
                                  placeholder="لطفاً توضیحات کاملی از پروژه مورد نظر، نیازمندی‌ها و انتظارات خود ارائه دهید..."></textarea>
                    </div>
                </div>

                <!-- Price Info -->
                <div class="bg-yellow-50 p-4 rounded-lg" x-show="newProject.type && newProject.degree">
                    <h4 class="font-semibold text-yellow-800 mb-2">
                        <i class="fas fa-info-circle ml-1"></i> اطلاعات هزینه
                    </h4>
                    <div class="text-sm text-yellow-700">
                        <p>مبلغ تقریبی: <span class="font-bold" x-text="formatCurrency(newProject.totalAmount || 0)"></span></p>
                        <p class="mt-1">هزینه نهایی پس از بررسی و تایید مدیر اعلام خواهد شد.</p>
                    </div>
                </div>

                <div class="flex justify-end space-x-3 space-x-reverse pt-4 border-t">
                    <button @click="showModal = null"
                            class="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                        انصراف
                    </button>
                    <button @click="submitStudentProject(newProject)"
                            :disabled="!newProject.type || !newProject.degree || !newProject.deadline"
                            :class="(newProject.type && newProject.degree && newProject.deadline) ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 cursor-not-allowed'"
                            class="px-4 py-2 text-white rounded-lg btn">
                        <i class="fas fa-paper-plane ml-2"></i>
                        ارسال درخواست
                    </button>
                </div>
            </div>
        `;
  },

  // Reject Order Modal
  getRejectOrderModal() {
    return `
            <div class="p-6 border-b">
                <h3 class="text-lg font-bold text-gray-800 text-red-600">رد سفارش / وظیفه</h3>
            </div>
            <div class="p-6 space-y-4" x-data="{ rejectionReason: '' }">
                <div id="reject-order-info" class="bg-red-50 p-4 rounded-lg">
                    <p class="text-sm text-red-600">در حال بارگذاری...</p>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">دلیل رد <span class="text-red-500">*</span></label>
                    <textarea x-model="rejectionReason" rows="4" class="form-control" required
                              placeholder="لطفاً دلیل رد را به طور کامل توضیح دهید تا عامل بتواند اصلاحات لازم را انجام دهد..."></textarea>
                </div>

                <div class="flex justify-end space-x-3 space-x-reverse pt-4">
                    <button @click="showModal = null"
                            class="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                        انصراف
                    </button>
                    <button @click="submitRejectOrder(rejectionReason)"
                            class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 btn">
                        <i class="fas fa-times ml-2"></i>
                        رد کردن
                    </button>
                </div>
            </div>
        `;
  },

  // Bind events
  bindEvents() {
    // Global modal functions (async support)
    window.submitNewOrder = async (orderData) => {
      await this.submitNewOrder(orderData);
    };
    window.submitNewUser = this.submitNewUser;
    window.submitEditUser = this.submitEditUser;
    window.changePassword = this.changePassword;
    window.calculateOrderPrice = UTILS.calculateOrderPrice;
    window.formatCurrency = UTILS.formatCurrency;

    // Order workflow functions
    window.approveOrder = this.approveOrder;
    window.rejectOrder = this.rejectOrder;
    window.assignOrder = this.assignOrder;
    window.submitAssignOrder = this.submitAssignOrder;
    window.submitRejectOrder = this.submitRejectOrder;
  },

  // Submit new order (Enhanced with API integration)
  async submitNewOrder(orderData) {
    try {
      debugLogger("Submitting new order...", "info", orderData);

      // Validation - فیلدهای الزامی
      if (
        !orderData ||
        !orderData.studentName ||
        !orderData.nickname ||
        !orderData.birthDate ||
        !orderData.passportNumber ||
        !orderData.gender ||
        !orderData.university ||
        !orderData.field ||
        !orderData.degree ||
        !orderData.phone ||
        !orderData.behestanUsername ||
        !orderData.behestanPassword ||
        !orderData.studentId ||
        !orderData.deadline
      ) {
        debugLogger(
          "Validation failed - missing required fields",
          "error",
          orderData,
        );
        UTILS.showNotification("لطفاً تمام فیلدهای الزامی را پر کنید", "error");
        return;
      }

      // بررسی آپلود عکس پاسپورت
      if (!orderData.passportImage) {
        UTILS.showNotification("لطفاً عکس پاسپورت را آپلود کنید", "error");
        return;
      }

      // بررسی لیست کارها
      if (!orderData.workList || orderData.workList.length === 0) {
        UTILS.showNotification("لطفاً حداقل یک کار اضافه کنید", "error");
        return;
      }

      // Calculate pricing - استفاده از مبلغ وارد شده یا محاسبه پیش‌فرض
      let totalAmount = parseFloat(orderData.totalAmount) || 0;
      let shares = {
        doctorShare: parseFloat(orderData.doctorShare) || 0,
        managerShare: parseFloat(orderData.companyShare) || 0,
        agentShare: parseFloat(orderData.agentShare) || 0,
        discount: parseFloat(orderData.discount) || 0,
      };

      debugLogger("Order pricing calculated", "info", { totalAmount, shares });

      // Get current user
      const currentUser = this.getCurrentUser();

      // Prepare order data for API
      const apiOrderData = {
        // First, we need to create or find the student
        student_name: orderData.studentName,
        university: orderData.university,
        field: orderData.field,
        degree: orderData.degree,
        type: orderData.type,
        deadline: orderData.deadline,
        passport_number: orderData.passportNumber || "",
        description: orderData.description || "",
        total_amount: totalAmount,
      };

      // Try API first
      let newOrder = null;
      let useAPI = false;

      try {
        if (typeof APIDataModule !== "undefined") {
          // Create student profile first if needed
          const studentData = {
            user: {
              first_name:
                orderData.studentName.split(" ")[0] || orderData.studentName,
              last_name:
                orderData.studentName.split(" ").slice(1).join(" ") || "",
              email: `${orderData.studentName.replace(/\s+/g, "").toLowerCase()}@student.edu`,
            },
            university: orderData.university,
            student_id: `STD${Date.now()}`,
            field: orderData.field,
            degree: orderData.degree,
            passport_number: orderData.passportNumber || "",
          };

          debugLogger(
            "Creating student profile via API...",
            "info",
            studentData,
          );
          const student = await APIDataModule.addStudent(studentData);

          // Now create the order
          const orderForAPI = {
            student: student.id,
            university: orderData.university,
            field: orderData.field,
            degree: orderData.degree,
            type: orderData.type,
            deadline: orderData.deadline,
            passport_number: orderData.passportNumber || "",
            description: orderData.description || "",
            total_amount: totalAmount,
          };

          debugLogger("Creating order via API...", "info", orderForAPI);
          newOrder = await APIDataModule.addOrder(orderForAPI);
          useAPI = true;

          debugLogger(
            "Order created successfully via API",
            "success",
            newOrder,
          );
          UTILS.showNotification("سفارش با موفقیت در سیستم ثبت شد", "success");
        }
      } catch (apiError) {
        debugLogger(
          "API order creation failed, using localStorage fallback",
          "warning",
          apiError,
        );
        useAPI = false;
      }

      // Fallback to localStorage if API failed
      if (!useAPI) {
        debugLogger("Using localStorage fallback for order creation", "info");

        newOrder = {
          id: UTILS.generateId(),
          studentId: orderData.studentId,
          studentName: orderData.studentName,
          nickname: orderData.nickname,
          birthDate: orderData.birthDate,
          passportNumber: orderData.passportNumber,
          passportImage: orderData.passportImage,
          gender: orderData.gender,
          university: orderData.university,
          field: orderData.field,
          degree: orderData.degree,
          phone: orderData.phone,
          behestanUsername: orderData.behestanUsername,
          behestanPassword: orderData.behestanPassword,
          workList: orderData.workList || [],
          type:
            orderData.workList && orderData.workList.length > 0
              ? orderData.workList.join(", ")
              : "سفارش چندگانه",
          deadline: orderData.deadline,
          description: orderData.description || "",
          currency: orderData.currency || "تومان",
          customFields1: orderData.customFields1 || [],
          customFields2: orderData.customFields2 || [],
          customFields3: orderData.customFields3 || [],
          status: CONFIG.ORDER_STATUS.PENDING,
          stage: "ثبت اولیه",
          progress: 0,
          totalAmount: totalAmount,
          doctorShare: shares.doctorShare,
          companyShare: shares.managerShare,
          agentShare: shares.agentShare,
          discount: shares.discount,
          paymentStatus: "pending",
          paidAmount: 0,
          assignedDoctor: orderData.assignedDoctor || null,
          assignedDoctorId: orderData.assignedDoctorId || null,
          createdAt: new Date().toISOString(),
          tasks: [],
          rejectionHistory: [],
        };

        const orders = DataModule.getOrders();
        orders.push(newOrder);
        DataModule.saveOrders(orders);

        debugLogger("Order saved to localStorage", "success", {
          orderId: newOrder.id,
        });
        UTILS.showNotification("سفارش با موفقیت ثبت شد", "success");

        // ایجاد وظیفه برای عامل اگر تخصیص داده شده
        const assignedId = orderData.assignedDoctorId || null;
        if (
          assignedId &&
          window.TasksModule &&
          typeof TasksModule.createTaskFromOrder === "function"
        ) {
          const users = DataModule.getUsers();
          const agent = users.find((u) => u.id === assignedId);
          if (agent) {
            TasksModule.createTaskFromOrder(newOrder, agent);
            UTILS.showNotification(
              `وظیفه برای عامل ${agent.name} ایجاد شد`,
              "success",
            );
            debugLogger(`Task created for agent ${agent.name}`, "success");
          }
        }

        // اگر تخصیص چندگانه (workAssignments) داشت
        if (
          orderData.workAssignments &&
          typeof orderData.workAssignments === "object"
        ) {
          const users = DataModule.getUsers();
          const assignedAgentIds = [
            ...new Set(
              Object.values(orderData.workAssignments).filter(Boolean),
            ),
          ];
          assignedAgentIds.forEach((agentId) => {
            if (agentId && agentId !== assignedId) {
              const agent = users.find((u) => u.id === agentId);
              if (
                agent &&
                window.TasksModule &&
                typeof TasksModule.createTaskFromOrder === "function"
              ) {
                TasksModule.createTaskFromOrder(newOrder, agent);
                debugLogger(
                  `Task created for agent ${agent.name} (multi-assign)`,
                  "success",
                );
              }
            }
          });
        }
      }

      // Close modal and refresh orders list
      this.closeModal();

      if (typeof OrdersModule !== 'undefined' && OrdersModule.refreshOrders) {
        await OrdersModule.refreshOrders();
      } else {
        UIRefresh.orders();
      }
    } catch (error) {
      debugLogger("Error submitting new order", "error", {
        message: error.message,
        stack: error.stack,
      });
      UTILS.showNotification("خطا در ثبت سفارش: " + error.message, "error");
    }
  },

  // Submit new user
  submitNewUser(userData) {
    // Validation
    if (
      !userData.role ||
      !userData.name ||
      !userData.username ||
      !userData.password
    ) {
      UTILS.showNotification("لطفاً تمام فیلدهای الزامی را پر کنید", "error");
      return;
    }

    if (userData.password.length < 6) {
      UTILS.showNotification("رمز عبور باید حداقل 6 کاراکتر باشد", "error");
      return;
    }

    // Student specific validation
    if (userData.role === "student") {
      if (
        !userData.university ||
        !userData.studentId ||
        !userData.field ||
        !userData.degree
      ) {
        UTILS.showNotification(
          "لطفاً تمام فیلدهای الزامی دانشجو را پر کنید",
          "error",
        );
        return;
      }
    }

    // Process languages for translator
    if (userData.role === "translator" && userData.languages) {
      userData.languages = userData.languages
        .split(",")
        .map((lang) => lang.trim());
    }

    const success = UsersModule.addUser(userData);
    if (success) {
      window.showModal = null;
      // Refresh users page if currently viewing
      if (window.currentPage === "users") {
        UIRefresh.orders();
      }
    }
  },

  // Submit edit user
  submitEditUser(userData) {
    if (!userData.name || !userData.username) {
      UTILS.showNotification("لطفاً تمام فیلدهای الزامی را پر کنید", "error");
      return;
    }

    if (userData.password && userData.password.length < 6) {
      UTILS.showNotification("رمز عبور باید حداقل 6 کاراکتر باشد", "error");
      return;
    }

    // Process languages for translator
    if (
      userData.role === "translator" &&
      typeof userData.languages === "string"
    ) {
      userData.languages = userData.languages
        .split(",")
        .map((lang) => lang.trim());
    }

    const success = UsersModule.editUser(window.editingUserId, userData);
    if (success) {
      window.showModal = null;
      window.editingUserId = null;
      window.editingUserData = null;
      // Refresh users page if currently viewing
      if (window.currentPage === "users") {
        UIRefresh.orders();
      }
    }
  },

  // Change password
  changePassword(passwordForm) {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      UTILS.showNotification("رمز عبور جدید و تکرار آن یکسان نیست", "error");
      return;
    }

    // Get current user from global app state
    const currentUser = this.getCurrentUser();

    if (currentUser.password !== passwordForm.currentPassword) {
      UTILS.showNotification("رمز عبور فعلی اشتباه است", "error");
      return;
    }

    // Update password
    const users = DataModule.getUsers();
    const userIndex = users.findIndex((u) => u.id === currentUser.id);
    if (userIndex !== -1) {
      users[userIndex].password = passwordForm.newPassword;
      DataModule.saveUsers(users);

      UTILS.showNotification("رمز عبور با موفقیت تغییر کرد", "success");
      window.showModal = null;
    }
  },

  // Approve order (by manager or employee)
  approveOrder(orderId) {
    if (typeof OrdersModule !== 'undefined' && OrdersModule.approveOrder) {
      OrdersModule.approveOrder(orderId);
      return;
    }
    try {
      debugLogger("Approving order...", "info", { orderId });

      const orders = DataModule.getOrders();
      const orderIndex = orders.findIndex((o) => o.id === orderId);

      if (orderIndex === -1) {
        UTILS.showNotification("سفارش یافت نشد", "error");
        return;
      }

      orders[orderIndex].status = CONFIG.ORDER_STATUS.APPROVED;
      orders[orderIndex].stage = "تایید شده - در انتظار تخصیص";
      orders[orderIndex].approvedAt = new Date().toISOString();

      DataModule.saveOrders(orders);

      debugLogger("Order approved successfully", "success", { orderId });
      UTILS.showNotification("سفارش با موفقیت تایید شد", "success");

      UIRefresh.orders();
    } catch (error) {
      debugLogger("Error approving order", "error", error);
      UTILS.showNotification("خطا در تایید سفارش", "error");
    }
  },

  // Open reject modal
  rejectOrder(orderId) {
    if (typeof OrdersModule !== 'undefined' && OrdersModule.openRejectModal) {
      OrdersModule.openRejectModal(orderId);
      return;
    }
    window.currentOrderId = orderId;
    const orders = DataModule.getOrders();
    const order = orders.find((o) => o.id === orderId);

    if (order) {
      setTimeout(() => {
        const infoDiv = document.getElementById("reject-order-info");
        if (infoDiv) {
          infoDiv.innerHTML = `
                        <p class="font-medium text-red-800">${order.studentName}</p>
                        <p class="text-sm text-red-600">${order.type} - ${order.university}</p>
                    `;
        }
      }, 100);
    }

    window.showModal = "rejectOrder";
  },

  // Submit rejection
  submitRejectOrder(reason) {
    if (typeof OrdersModule !== 'undefined' && OrdersModule.submitRejectOrder) {
      OrdersModule.submitRejectOrder(window.currentOrderId, reason);
      return;
    }
    try {
      if (!reason || reason.trim() === "") {
        UTILS.showNotification("لطفاً دلیل رد را وارد کنید", "error");
        return;
      }

      const orderId = window.currentOrderId;
      debugLogger("Rejecting order...", "info", { orderId, reason });

      const orders = DataModule.getOrders();
      const orderIndex = orders.findIndex((o) => o.id === orderId);

      if (orderIndex === -1) {
        UTILS.showNotification("سفارش یافت نشد", "error");
        return;
      }

      // Get current user
      const currentUser = this.getCurrentUser();

      orders[orderIndex].status = CONFIG.ORDER_STATUS.REJECTED;
      orders[orderIndex].stage = "رد شده - نیاز به اصلاح";
      if (!orders[orderIndex].rejectionHistory) orders[orderIndex].rejectionHistory = [];
      orders[orderIndex].rejectionHistory.push({
        date: new Date().toISOString(),
        reason: reason,
        rejectedBy: currentUser.role,
        rejectedById: currentUser.id,
        rejectedByName: currentUser.name,
      });

      DataModule.saveOrders(orders);

      debugLogger("Order rejected successfully", "success", { orderId });
      UTILS.showNotification("سفارش رد شد و دلیل ثبت گردید", "warning");

      window.showModal = null;
      UIRefresh.orders();
    } catch (error) {
      debugLogger("Error rejecting order", "error", error);
      UTILS.showNotification("خطا در رد سفارش", "error");
    }
  },

  // Open assign modal
  assignOrder(orderId) {
    window.currentOrderId = orderId;
    const orders = DataModule.getOrders();
    const order = orders.find((o) => o.id === orderId);

    if (order) {
      setTimeout(() => {
        const infoDiv = document.getElementById("assign-order-info");
        if (infoDiv) {
          infoDiv.innerHTML = `
                        <p class="font-medium">${order.studentName}</p>
                        <p class="text-sm text-gray-600">${order.type} - ${order.university}</p>
                        <p class="text-sm text-gray-500">مبلغ: ${UTILS.formatCurrency(order.totalAmount)}</p>
                    `;
        }
      }, 100);
    }

    window.showModal = "assignOrder";
  },

  // Submit assignment
  submitAssignOrder(doctorId) {
    try {
      if (!doctorId) {
        UTILS.showNotification("لطفاً یک عامل انتخاب کنید", "error");
        return;
      }

      const orderId = window.currentOrderId;
      debugLogger("Assigning order...", "info", { orderId, doctorId });

      const orders = DataModule.getOrders();
      const orderIndex = orders.findIndex((o) => o.id === orderId);

      if (orderIndex === -1) {
        UTILS.showNotification("سفارش یافت نشد", "error");
        return;
      }

      const users = DataModule.getUsers();
      const doctor = users.find((u) => u.id === doctorId);

      if (!doctor) {
        UTILS.showNotification("عامل یافت نشد", "error");
        return;
      }

      orders[orderIndex].assignedDoctorId = doctorId;
      orders[orderIndex].assignedDoctor = doctor.name;
      orders[orderIndex].status = CONFIG.ORDER_STATUS.IN_PROGRESS;
      orders[orderIndex].stage = "تخصیص یافته - در حال انجام";
      orders[orderIndex].assignedAt = new Date().toISOString();

      // Add initial task
      orders[orderIndex].tasks.push({
        id: UTILS.generateId(),
        title: "شروع کار روی سفارش",
        status: CONFIG.ORDER_STATUS.IN_PROGRESS,
        assignedTo: "doctor",
        assignedUserId: doctorId,
        dueDate: orders[orderIndex].deadline,
        createdAt: new Date().toISOString(),
      });

      DataModule.saveOrders(orders);

      // ایجاد وظیفه برای عامل در صفحه وظایف من
      if (
        window.TasksModule &&
        typeof TasksModule.createTaskFromOrder === "function"
      ) {
        TasksModule.createTaskFromOrder(orders[orderIndex], doctor);
        debugLogger(
          `Task created for agent ${doctor.name} from order ${orderId}`,
          "success",
        );
      } else {
        debugLogger("TasksModule.createTaskFromOrder not available", "warning");
      }

      debugLogger("Order assigned successfully", "success", {
        orderId,
        doctorId,
      });
      UTILS.showNotification(`سفارش به ${doctor.name} تخصیص یافت`, "success");

      window.showModal = null;
      UIRefresh.orders();
    } catch (error) {
      debugLogger("Error assigning order", "error", error);
      UTILS.showNotification("خطا در تخصیص سفارش", "error");
    }
  },

  // Submit create project
  submitCreateProject(projectData) {
    try {
      debugLogger("Creating new project...", "info", projectData);

      // Validation
      if (
        !projectData ||
        !projectData.studentId ||
        !projectData.assignedDoctorId ||
        !projectData.type ||
        !projectData.degree ||
        !projectData.deadline
      ) {
        debugLogger(
          "Validation failed - missing required fields",
          "error",
          projectData,
        );
        UTILS.showNotification("لطفاً تمام فیلدهای الزامی را پر کنید", "error");
        return;
      }

      // Calculate pricing
      let totalAmount = 0;
      let shares = { doctorShare: 0, managerShare: 0 };

      try {
        totalAmount =
          UTILS.calculateOrderPrice(projectData.type, projectData.degree) || 0;
        shares = UTILS.calculateShares(projectData.type, totalAmount) || {
          doctorShare: 0,
          managerShare: 0,
        };
      } catch (e) {
        debugLogger("Error calculating price, using defaults", "warning", e);
        totalAmount = 300; // Default price
        shares = { doctorShare: 180, managerShare: 120 };
      }

      debugLogger("Project pricing calculated", "info", {
        totalAmount,
        shares,
      });

      const newProject = {
        id: UTILS.generateId(),
        studentId: projectData.studentId,
        studentName: projectData.studentName,
        university: projectData.university || "نامشخص",
        field: projectData.field || "نامشخص",
        degree: projectData.degree,
        type: projectData.type,
        deadline: projectData.deadline,
        description: projectData.description || "",
        priority: projectData.priority || "normal",

        // Status - Project is created and assigned directly
        status: CONFIG.ORDER_STATUS.IN_PROGRESS,
        stage: "پروژه ایجاد شد و به عامل تخصیص یافت",
        progress: 5, // Initial progress

        // Assignment
        assignedDoctor: projectData.assignedDoctor,
        assignedDoctorId: projectData.assignedDoctorId,
        assignedAt: new Date().toISOString(),

        // Financial
        totalAmount: totalAmount,
        doctorShare: shares.doctorShare,
        managerShare: shares.managerShare,
        paymentStatus: "pending",
        paidAmount: 0,

        // Timestamps
        createdAt: new Date().toISOString(),
        approvedAt: new Date().toISOString(), // Auto-approved by manager

        // Tasks and history
        tasks: [
          {
            id: UTILS.generateId(),
            title: "شروع کار روی پروژه",
            status: CONFIG.ORDER_STATUS.IN_PROGRESS,
            assignedTo: "doctor",
            assignedUserId: projectData.assignedDoctorId,
            dueDate: projectData.deadline,
            createdAt: new Date().toISOString(),
          },
        ],
        rejectionHistory: [],
      };

      debugLogger("New project object created", "info", newProject);

      const orders = DataModule.getOrders();
      orders.push(newProject);
      DataModule.saveOrders(orders);

      debugLogger("New project saved successfully", "success", {
        projectId: newProject.id,
      });
      UTILS.showNotification(
        `پروژه با موفقیت ایجاد و به ${projectData.assignedDoctor} تخصیص یافت`,
        "success",
      );

      // Close modal and refresh
      window.showModal = null;
      UIRefresh.orders();
    } catch (error) {
      debugLogger("Error creating project", "error", {
        message: error.message,
        stack: error.stack,
      });
      UTILS.showNotification("خطا در ایجاد پروژه", "error");
    }
  },

  // Submit student project request
  submitStudentProject(projectData) {
    try {
      debugLogger("Creating student project request...", "info", projectData);

      // Validation
      if (
        !projectData ||
        !projectData.type ||
        !projectData.degree ||
        !projectData.deadline
      ) {
        debugLogger(
          "Validation failed - missing required fields",
          "error",
          projectData,
        );
        UTILS.showNotification("لطفاً تمام فیلدهای الزامی را پر کنید", "error");
        return;
      }

      // Calculate pricing
      let totalAmount = 0;
      let shares = { doctorShare: 0, managerShare: 0 };

      try {
        totalAmount =
          UTILS.calculateOrderPrice(projectData.type, projectData.degree) || 0;
        shares = UTILS.calculateShares(projectData.type, totalAmount) || {
          doctorShare: 0,
          managerShare: 0,
        };
      } catch (e) {
        debugLogger("Error calculating price, using defaults", "warning", e);
        totalAmount = 300; // Default price
        shares = { doctorShare: 180, managerShare: 120 };
      }

      debugLogger("Student project pricing calculated", "info", {
        totalAmount,
        shares,
      });

      const newProject = {
        id: UTILS.generateId(),
        studentId: projectData.studentId,
        studentName: projectData.studentName,
        university: projectData.university || "نامشخص",
        field: projectData.field || "نامشخص",
        degree: projectData.degree,
        type: projectData.type,
        deadline: projectData.deadline,
        description: projectData.description || "",
        priority: projectData.priority || "normal",

        // Status - Student request needs approval
        status: CONFIG.ORDER_STATUS.PENDING,
        stage: "درخواست ثبت شد - در انتظار بررسی مدیر",
        progress: 0,

        // Assignment - Will be assigned later by manager
        assignedDoctor: null,
        assignedDoctorId: null,

        // Financial
        totalAmount: totalAmount,
        doctorShare: shares.doctorShare,
        managerShare: shares.managerShare,
        paymentStatus: "pending",
        paidAmount: 0,

        // Timestamps
        createdAt: new Date().toISOString(),

        // Tasks and history
        tasks: [],
        rejectionHistory: [],
      };

      debugLogger("New student project request created", "info", newProject);

      const orders = DataModule.getOrders();
      orders.push(newProject);
      DataModule.saveOrders(orders);

      debugLogger("Student project request saved successfully", "success", {
        projectId: newProject.id,
      });
      UTILS.showNotification(
        "درخواست پروژه با موفقیت ثبت شد و برای بررسی ارسال گردید",
        "success",
      );

      // Close modal and refresh
      window.showModal = null;
      UIRefresh.orders();
    } catch (error) {
      debugLogger("Error creating student project request", "error", {
        message: error.message,
        stack: error.stack,
      });
      UTILS.showNotification("خطا در ثبت درخواست پروژه", "error");
    }
  },
};

// Initialize modals when both DOM and Alpine are ready
document.addEventListener("DOMContentLoaded", function () {
  console.log("📄 DOM loaded, waiting for Alpine...");
  console.log("🔍 OrderWizardModule available?", typeof OrderWizardModule !== 'undefined');
  console.log("🔍 OrdersModule available?", typeof OrdersModule !== 'undefined');
  console.log("🔍 DataModule available?", typeof DataModule !== 'undefined');

  // Wait for Alpine to be ready
  const initModals = () => {
    if (typeof Alpine !== "undefined" && Alpine.data) {
      console.log("✅ Alpine ready, initializing modals...");
      ModalsModule.init();
      return true;
    }
    return false;
  };

  // Try immediately
  if (!initModals()) {
    // If Alpine not ready, wait for alpine:init event
    document.addEventListener("alpine:init", () => {
      console.log("🔵 Alpine init event received");
      initModals();
    });

    // Fallback: Try again after 100ms
    setTimeout(() => {
      if (!initModals()) {
        console.warn("⚠️ Alpine not ready after timeout, forcing init");
        ModalsModule.init();
      }
    }, 100);
  }
});
// Global function for creating projects
window.submitCreateProject = function (projectData) {
  ModalsModule.submitCreateProject(projectData);
};

// Global function for student project requests
window.submitStudentProject = function (projectData) {
  ModalsModule.submitStudentProject(projectData);
};

// Global function to open new order modal
window.openNewOrderModal = function () {
  try {
    debugLogger("Opening new order modal...", "info");

    // Method 1: Try Alpine.js data access
    const appElement = document.querySelector("[x-data]");
    if (appElement && appElement.__x && appElement.__x.$data) {
      appElement.__x.$data.showModal = "newOrder";
      debugLogger("Modal opened via Alpine.js", "success");
      return;
    }

    // Method 2: Try direct Alpine access
    const bodyElement = document.querySelector("body[x-data]");
    if (bodyElement && bodyElement.__x && bodyElement.__x.$data) {
      bodyElement.__x.$data.showModal = "newOrder";
      debugLogger("Modal opened via body Alpine.js", "success");
      return;
    }

    // Method 3: Try _x_dataStack
    const dataElement = document.querySelector('[x-data="appController()"]');
    if (
      dataElement &&
      dataElement._x_dataStack &&
      dataElement._x_dataStack[0]
    ) {
      dataElement._x_dataStack[0].showModal = "newOrder";
      debugLogger("Modal opened via dataStack", "success");
      return;
    }

    // Method 4: Search all elements with x-data
    const allDataElements = document.querySelectorAll("[x-data]");
    for (const element of allDataElements) {
      if (element.__x && element.__x.$data) {
        element.__x.$data.showModal = "newOrder";
        debugLogger("Modal opened via element search", "success");
        return;
      }
      if (element._x_dataStack && element._x_dataStack[0]) {
        element._x_dataStack[0].showModal = "newOrder";
        debugLogger("Modal opened via element dataStack", "success");
        return;
      }
    }

    // Fallback: Set global variable
    window.showModal = "newOrder";
    debugLogger("Modal opened via global variable (fallback)", "warning");

    // Force trigger Alpine update
    setTimeout(() => {
      const event = new CustomEvent("alpine:init");
      window.dispatchEvent(event);
    }, 100);
  } catch (error) {
    debugLogger("Error opening new order modal", "error", error);
    alert("خطا در باز کردن فرم سفارش جدید. لطفاً صفحه را رفرش کنید.");
  }
};
