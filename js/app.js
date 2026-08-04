// Main Application Controller with API Integration
function appController() {
  return {
    // State
    selectedUserId: "mgr001",
    currentUser: {
      id: "mgr001",
      name: "دکتر محسن تقی زاده",
      username: "manager",
      role: "manager",
      email: "taghizadeh@edu-system.com",
      phone: "+98 912 123 4567",
    },
    currentPage: "dashboard",
    accPage: "main",        // main | personal | employees | embassy
    empAccPage: "main",     // main | emp_accounting | work_hours
    accMenuOpen: false,     // dropdown حسابداری در sidebar
    showModal: null,
    selectedOrder: null,
    notifications: [],
    isLoading: false,
    apiMode: false, // Track if we're using API or localStorage
    dashboardContent:
      '<div class="text-center text-gray-500">در حال بارگذاری...</div>',
    ordersContent: "",
    sidebarOpen: localStorage.getItem('sidebarOpen') !== null
        ? localStorage.getItem('sidebarOpen') === 'true'
        : window.innerWidth >= 1024, // پیش‌فرض: دسکتاپ=باز، موبایل=بسته

    // Initialize app
    async init() {
      try {
        debugLogger("Initializing application...", "info");
        this.isLoading = true;

        // Set sidebar state based on screen size (only if no saved preference)
        if (localStorage.getItem('sidebarOpen') === null) {
            this.sidebarOpen = window.innerWidth >= 1024;
        }

        // Watch sidebar state and save to localStorage
        this.$watch('sidebarOpen', (val) => {
            localStorage.setItem('sidebarOpen', val);
        });

        // Subscribe to real-time events for automatic UI updates
        if (typeof RealtimeEvents !== 'undefined') {
            // سفارشات تغییر کرد
            RealtimeEvents.on(RealtimeEvents.EVENTS.ORDERS_CHANGED, async () => {
                if (this.currentPage === 'orders') {
                    await this.loadOrdersPageWithRetry();
                }
                if (this.currentPage === 'dashboard') {
                    await this.loadDashboardContent();
                }
            }, 'app-controller');

            // کاربران تغییر کرد
            RealtimeEvents.on(RealtimeEvents.EVENTS.USERS_CHANGED, () => {
                if (this.currentPage === 'users') {
                    const el = document.querySelector('[x-show*="currentPage === \'users\'"]');
                    if (el && typeof UsersModule !== 'undefined') {
                        el.innerHTML = UsersModule.getUsersContent();
                    }
                }
            }, 'app-controller');

            // وظایف تغییر کرد — برای عامل و کارمند
            RealtimeEvents.on(RealtimeEvents.EVENTS.EMPLOYEE_TASKS_CHANGED, () => {
                if (this.currentPage === 'agentTasks' &&
                    typeof window.getMyAgentTasksContent === 'function') {
                    const el = document.querySelector('[x-show*="agentTasks"]');
                    if (el) el.innerHTML = window.getMyAgentTasksContent();
                }
                if (this.currentPage === 'myTasks' && typeof EmployeeModule !== 'undefined') {
                    const el = document.querySelector('[x-show*="myTasks"]');
                    if (el) el.innerHTML = EmployeeModule.getMyTasksContent(this.currentUser.id);
                }
            }, 'app-controller');
        }

        // Watch for page changes to load content
        this.$watch("currentPage", async (newPage) => {
          console.log("📄 Page changed to:", newPage);
          if (newPage !== 'accounting') {
            window._accPage = 'main';
            window._empAccPage = 'main';
          }
          if (newPage === "orders") {
            console.log("🔄 Loading orders page...");
            await this.loadOrdersPageWithRetry();
          }
          if (newPage === "embassy") {
            // embassy-root همیشه در DOM است (x-show فقط display:none می‌کند)
            // مستقیم inject می‌کنیم
            const doInit = () => {
              const root = document.getElementById('embassy-root');
              if (root && typeof EmbassyModule !== 'undefined') {
                root.innerHTML = EmbassyModule.getContent();
                setTimeout(() => EmbassyModule.init(), 120);
                console.log('✅ Embassy loaded successfully');
              } else {
                // اگر هنوز پیدا نشد یک بار دیگر تلاش کن
                setTimeout(() => {
                  const r2 = document.getElementById('embassy-root');
                  if (r2 && typeof EmbassyModule !== 'undefined') {
                    r2.innerHTML = EmbassyModule.getContent();
                    setTimeout(() => EmbassyModule.init(), 120);
                  }
                }, 300);
              }
            };
            // Alpine x-show نیاز به یک tick دارد
            this.$nextTick(() => doInit());
          }
        });

        // Listen for window resize
        window.addEventListener("resize", () => {
          if (window.innerWidth >= 1024 && !this.sidebarOpen) {
            // Don't auto-open on desktop if user closed it
          } else if (window.innerWidth < 1024) {
            this.sidebarOpen = false;
          }
        });

        // Listen for custom modal events
        window.addEventListener("openModal", (e) => {
          if (e.detail && e.detail.modal) {
            this.showModal = e.detail.modal;
            debugLogger("Modal opened via event: " + e.detail.modal, "info");
          }
        });

        // Initialize data modules
        DataModule.initializeData();

        // وقتی Supabase داده‌ها رو کشید، صفحه جاری رو refresh کن
        window.addEventListener('supabase:dataready', async () => {
            console.log('🔄 supabase:dataready — refreshing current page data...');
            try {
                // orders رو دوباره بارگذاری کن اگر صفحه orders باز است
                if (this.currentPage === 'orders') {
                    await this.loadOrdersPageWithRetry();
                }
                // dashboard رو هم refresh کن
                if (this.currentPage === 'dashboard' || this.currentPage === 'home') {
                    if (typeof UIRefresh !== 'undefined') {
                        UIRefresh.refresh();
                    }
                }
                // اگر هنوز صفحه اصلی است و سفارش جدید در localStorage آمد — نمایش بده
                
            } catch (e) {
                console.warn('⚠️ supabase:dataready refresh خطا:', e.message);
            }
        }, { once: true });  // فقط یک بار اجرا شود

        // Check if user is already logged in (from localStorage)
        const savedUser = localStorage.getItem("currentUser");
        if (savedUser) {
          try {
            this.currentUser = JSON.parse(savedUser);
            this.selectedUserId = this.currentUser.id;
            debugLogger(
              "Current user loaded from localStorage",
              "success",
              this.currentUser,
            );
          } catch (e) {
            debugLogger("Error parsing saved user", "warning", e);
          }
        }

        // Try to initialize API integration
        const enableAPI = false; // Set to true to enable API integration

        if (!enableAPI) {
          debugLogger("API integration disabled by config", "info");
          this.apiMode = false;
          if (typeof APIDataModule !== "undefined") {
            APIDataModule.isAvailable = false;
          }
          if (!savedUser) {
            this.switchUser();
          }
        } else {
          try {
            // Check if APIDataModule exists
            if (typeof APIDataModule === "undefined") {
              throw new Error("APIDataModule not loaded");
            }

            await APIDataModule.init();
            this.apiMode = true;
            debugLogger("API mode enabled", "success");

            // Try to get current user from API
            const apiUser = await APIDataModule.getCurrentUser();
            if (apiUser) {
              this.currentUser = apiUser;
              localStorage.setItem("currentUser", JSON.stringify(apiUser));
              debugLogger("Current user loaded from API", "success", apiUser);
            } else if (!savedUser) {
              debugLogger("No API user found, using demo mode", "info");
              this.switchUser(); // Load default demo user
            }
          } catch (error) {
            debugLogger(
              "API initialization failed, using localStorage mode",
              "warning",
              error,
            );
            this.apiMode = false;

            // Ensure APIDataModule doesn't interfere
            if (typeof APIDataModule !== "undefined") {
              APIDataModule.isAvailable = false;
            }

            if (!savedUser) {
              this.switchUser(); // Load default demo user
            }
          }
        }

        this.registerServiceWorker();
        this.isLoading = false;

        // Load dashboard content
        await this.loadDashboardContent();

        debugLogger("Application initialized successfully", "success", {
          currentUser: this.currentUser,
          currentPage: this.currentPage,
          apiMode: this.apiMode,
        });
      } catch (error) {
        debugLogger("Error initializing application", "error", error);
        this.isLoading = false;
      }
    },

    // Get role name in Persian
    getRoleName(role) {
      const roleNames = {
        manager: "مدیر",
        employee: "کارمند",
        agent: "عامل",
        student: "دانشجو",
      };
      return roleNames[role] || role;
    },

    // Get page title
    getPageTitle() {
      const pageTitles = {
        embassy: 'سفارت',
        dashboard: "داشبورد",
        tasks: "مدیریت همکاران",
        myTasks: "وظایف من",
        myAgentTasks: "وظایف من",
        myIncome: "درآمد من",
        orders: "سفارشات",
        accounting: "حسابداری",
        employeeAccounting: "حسابداری کارمندان",
        workHours: "ساعات کاری",
        workChecklist: "چک‌لیست کاری",
        chatWithManager: "گفتگو با مدیر",
        personalChat: "گفتگو شخصی",
        managementChat: "گفتگو مدیریت",
        agentAccounting: "حسابداری من",
        personalArchive: "بایگانی شخصی",
        profile: "پروفایل کاربری",
        users: "مدیریت کاربران",
        students: "مدیریت دانشجویان",
        agentTasks:
          this.currentUser && this.currentUser.role === "agent"
            ? "وظایف من"
            : "وظایف عامل‌ها",
      };
      return pageTitles[this.currentPage] || "داشبورد";
    },

    // Switch user (enhanced with API support)
    async switchUser() {
      try {
        debugLogger(`Switching to user: ${this.selectedUserId}`, "info");

        // لیست ثابت کارمند‌ها
        const employees = [
          {
            id: "emp001",
            name: "سارا سادات حسینی",
            username: "zahra",
            role: "employee",
            email: "zahra@edu-system.com",
          },
          {
            id: "emp002",
            name: "زینب بتول محمدی",
            username: "fatemeh",
            role: "employee",
            email: "fatemeh@edu-system.com",
          },
          {
            id: "emp003",
            name: "علیرضا غلامی فرزاد",
            username: "farzad",
            role: "employee",
            email: "farzad@edu-system.com",
          },
          {
            id: "emp004",
            name: "زینب سخایی م",
            username: "sakhaei",
            role: "employee",
            email: "sakhaei@edu-system.com",
          },
        ];

        // اول چک کن آیا کارمند است
        if (this.selectedUserId.startsWith("emp")) {
          const selectedUser = employees.find(
            (c) => c.id === this.selectedUserId,
          );
          if (selectedUser) {
            this.currentUser = { ...selectedUser };
            // Save to localStorage
            localStorage.setItem(
              "currentUser",
              JSON.stringify(this.currentUser),
            );
            debugLogger(
              "employee switched successfully",
              "success",
              this.currentUser,
            );
            UTILS.showNotification(
              `وارد شدید به عنوان: ${selectedUser.name}`,
              "success",
            );
            this.currentPage = "myTasks";
            await this.loadDashboardContent();
            return;
          }
        }

        // برای سایر کاربران
        const users = DataModule.getUsers();
        let selectedUser = users.find((u) => u.id === this.selectedUserId);

        if (selectedUser) {
          this.currentUser = { ...selectedUser };
          // Save to localStorage
          localStorage.setItem("currentUser", JSON.stringify(this.currentUser));
          debugLogger(
            "User switched successfully",
            "success",
            this.currentUser,
          );
          UTILS.showNotification(
            `وارد شدید به عنوان: ${selectedUser.name}`,
            "success",
          );

          // Set default page based on role
          if (selectedUser.role === "employee") {
            this.currentPage = "myTasks";
            debugLogger("Setting page to myTasks for employee", "info");
          } else if (selectedUser.role === "agent") {
            this.currentPage = "agentTasks";
            debugLogger("Setting page to agentTasks for agent", "info", {
              userId: selectedUser.id,
              userName: selectedUser.name,
              role: selectedUser.role,
            });
          } else {
            this.currentPage = "dashboard";
          }

          await this.loadDashboardContent();
        } else {
          debugLogger("User not found", "warning", {
            userId: this.selectedUserId,
            availableUsers: users.map((u) => ({ id: u.id, name: u.name })),
          });
        }
      } catch (error) {
        debugLogger("Error switching user", "error", error);
      }
    },

    // Get dashboard content (async with Alpine.js support)
    getDashboardContent() {
      return this.dashboardContent;
    },

    async loadDashboardContent() {
      try {
        debugLogger("Loading dashboard content...", "info", {
          role: this.currentUser.role,
        });
        if (!DashboardModule) {
          debugLogger("DashboardModule not found", "error");
          this.dashboardContent =
            '<div class="text-red-500">خطا: ماژول داشبورد یافت نشد</div>';
          return;
        }

        // Check if we have the enhanced async version
        if (typeof DashboardModule.getDashboardContent === "function") {
          this.dashboardContent = await DashboardModule.getDashboardContent(
            this.currentUser.role,
          );
          debugLogger("Dashboard content loaded", "success");
        } else {
          debugLogger("Using fallback dashboard", "warning");
          this.dashboardContent =
            '<div class="text-lime-500">داشبورد در حال بارگذاری...</div>';
        }
      } catch (error) {
        debugLogger("Error loading dashboard content", "error", error);
        this.dashboardContent =
          '<div class="text-red-500">خطا در بارگذاری داشبورد</div>';
      }
    },

    // Refresh dashboard content
    async refreshDashboard() {
      await this.loadDashboardContent();
    },

    // Get orders content (حرفه‌ای با error handling)
    async getOrdersContent() {
      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          debugLogger(
            `Loading orders content (attempt ${attempt}/${maxAttempts})...`,
            "info",
            {
              role: this.currentUser.role,
              userId: this.currentUser.id,
            },
          );

          // Get the module - check multiple sources
          let OrdersMod = null;
          
          // Try window.OrdersModule first
          if (typeof window.OrdersModule !== "undefined" && window.OrdersModule) {
            OrdersMod = window.OrdersModule;
          }
          // Try global OrdersModule
          else if (typeof OrdersModule !== "undefined" && OrdersModule) {
            OrdersMod = OrdersModule;
          }
          
          if (!OrdersMod) {
            throw new Error("OrdersModule not available");
          }

          // Get content
          const content = await OrdersMod.getOrdersContent(
            this.currentUser.role,
            this.currentUser.id,
          );
          debugLogger("Orders content loaded successfully", "success");
          return content;
        } catch (error) {
          console.error(`❌ Attempt ${attempt} failed:`, error);
          debugLogger(
            `Error loading orders content (attempt ${attempt})`,
            "error",
            {
              name: error.name,
              message: error.message,
              stack: error.stack,
            },
          );

          if (attempt === maxAttempts) {
            return `<div class="text-center text-red-500 py-8">
                            <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                            <p class="mb-4">خطا در بارگذاری سفارشات: ${error.message}</p>
                            <button onclick="location.reload()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
                                تلاش مجدد
                            </button>
                        </div>`;
          }

          // Wait before retry
          await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
        }
      }
    },

    // Load orders page asynchronously
    async loadOrdersPage() {
      this.ordersContent =
        '<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-4xl text-black-500"></i><p class="mt-4 text-white">در حال بارگذاری...</p></div>';
      this.ordersContent = await this.getOrdersContent();
    },

    // Load orders page with retry mechanism (حرفه‌ای)
    async loadOrdersPageWithRetry(maxRetries = 10) {
      this.ordersContent =
        '<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-4xl text-black-500"></i><p class="mt-4 text-white">در حال بارگذاری...</p></div>';

      console.log("🔍 Checking OrdersModule availability:");
      console.log("  - typeof window.OrdersModule:", typeof window.OrdersModule);
      console.log("  - window.OrdersModuleReady:", window.OrdersModuleReady);

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🔄 Attempt ${attempt}/${maxRetries} to load orders...`);

          // Check if OrdersModule is available (multiple checks)
          const moduleAvailable = typeof window.OrdersModule !== "undefined" && 
                                   window.OrdersModule !== null &&
                                   typeof window.OrdersModule.getOrdersContent === "function";
          
          const readyFlag = window.OrdersModuleReady === true;

          if (moduleAvailable || readyFlag) {
            console.log("✅ OrdersModule found! Loading content...");
            this.ordersContent = await this.getOrdersContent();
            console.log("✅ Orders loaded successfully");
            return;
          }

          // Wait before retry (exponential backoff)
          const delay = Math.min(100 * Math.pow(2, attempt - 1), 500);
          console.log(`⏳ OrdersModule not ready, waiting ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } catch (error) {
          console.error(`❌ Attempt ${attempt} failed:`, error);
          if (attempt === maxRetries) {
            this.ordersContent =
              '<div class="text-center text-red-500 py-8"><i class="fas fa-exclamation-triangle text-4xl mb-4"></i><p>خطا در بارگذاری سفارشات</p><p class="text-sm mt-2">' + error.message + '</p><button onclick="location.reload()" class="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">تلاش مجدد</button></div>';
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
        }
      }

      // If we get here, all retries failed - try direct fallback
      console.warn("⚠️ OrdersModule not loaded after retries, trying direct fallback...");
      try {
        this.ordersContent = await this.getOrdersContent();
      } catch (error) {
        console.error("❌ Final fallback failed:", error);
        this.ordersContent =
          '<div class="text-center text-red-500 py-8"><i class="fas fa-exclamation-triangle text-4xl mb-4"></i><p>خطا در بارگذاری سفارشات</p><p class="text-sm mt-2">OrdersModule یافت نشد</p><button onclick="location.reload()" class="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">تلاش مجدد</button></div>';
      }
    },

    // Get accounting content
    getAccountingContent() {
      try {
        debugLogger("Loading accounting content...", "info");

        // برای کارمند: صفحه حسابداری شخصی
        if (this.currentUser.role === "employee") {
          if (typeof EmployeeAccountingUI === "undefined") {
            return '<div class="text-red-500">خطا: ماژول EmployeeAccountingUI یافت نشد</div>';
          }
          EmployeeAccountingUI.init();
          return EmployeeAccountingUI.getEmployeeContent();
        }

        // برای مدیر: صفحه حسابداری شخصی (پیش‌فرض)
        if (typeof AccountingModule === "undefined") {
          debugLogger("AccountingModule not found", "error");
          return '<div class="text-red-500">خطا: ماژول AccountingModule یافت نشد</div>';
        }

        if (typeof AccountingUI === "undefined") {
          debugLogger("AccountingUI not found", "error");
          return '<div class="text-red-500">خطا: ماژول AccountingUI یافت نشد</div>';
        }

        // برای مدیر: hub در index.html با Alpine مدیریت می‌شه
        // اینجا فقط حسابداری شخصی مدیر رو برمی‌گردونیم
        if (this.currentUser.role === 'manager') {
            if (typeof AccountingUI === 'undefined') {
                return '<div class="text-red-500">خطا: AccountingModule یافت نشد</div>';
            }
            AccountingUI.init();
            return AccountingUI.render();
        }
        AccountingUI.init();
        const content = AccountingUI.render();
        debugLogger("Accounting content loaded", "success");
        return content;
      } catch (error) {
        debugLogger("Error loading accounting content", "error", error);
        return `<div class="text-red-500">خطا در بارگذاری حسابداری: ${error.message}</div>`;
      }
    },

    // ── Hub حسابداری مدیر ───────────────────────────────────
    _getManagerAccountingHub() {
      // sub-page state روی window نگه می‌داریم
      if (!window._accPage) window._accPage = 'main';
      const page = window._accPage;

      if (page === 'personal') {
        if (typeof AccountingUI === 'undefined') return '<p class="text-red-400">AccountingUI یافت نشد</p>';
        AccountingUI.init();
        return `<div>
            <button onclick="window._accPage='main'; document.querySelector('[x-show*=\"currentPage === \'accounting\'\"]').innerHTML=window.__alpineApp.getAccountingContent();"
                class="mb-4 flex items-center gap-2 text-black-300 hover:text-white text-sm"><i class="fas fa-arrow-right"></i> بازگشت</button>
            ${AccountingUI.render()}</div>`;
      }

      if (page === 'employees') {
        return this._getEmployeeAccountingSubHub();
      }

      // صفحه اصلی — ۲ کارت
      return `
        <div class="space-y-6">
            <h2 class="text-2xl font-bold text-white flex items-center gap-3">
                <span class="bg-lime-500/20 p-2 rounded-xl"><i class="fas fa-calculator text-lime-400"></i></span>
                حسابداری
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- کارت ۱: حسابداری شخصی -->
                <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 cursor-pointer hover:bg-white/15 transition-all group"
                     onclick="window._accPage='personal'; window.__alpineApp=document.querySelector('[x-data]').__x.$data; document.querySelector('[x-show*=\\'currentPage === \\'accounting\\'\\']').innerHTML=window.__alpineApp.getAccountingContent();">
                    <div class="flex flex-col items-center text-center gap-4">
                        <div class="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <i class="fas fa-wallet text-3xl text-emerald-400"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold text-white mb-2">حسابداری شخصی</h3>
                            <p class="text-black-400 text-sm">مشاهده درآمد، هزینه و سابقه مالی</p>
                        </div>
                        <i class="fas fa-chevron-left text-black-300 group-hover:text-white transition-colors"></i>
                    </div>
                </div>
                <!-- کارت ۲: حسابداری کارمندان -->
                <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 cursor-pointer hover:bg-white/15 transition-all group"
                     onclick="window._accPage='employees'; window.__alpineApp=document.querySelector('[x-data]').__x.$data; document.querySelector('[x-show*=\\'currentPage === \\'accounting\\'\\']').innerHTML=window.__alpineApp.getAccountingContent();">
                    <div class="flex flex-col items-center text-center gap-4">
                        <div class="w-16 h-16 bg-lime-500/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <i class="fas fa-users-cog text-3xl text-lime-400"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold text-white mb-2">حسابداری کارمندان</h3>
                            <p class="text-black-400 text-sm">مدیریت ساعات، هزینه‌ها و کسورات کارمندان</p>
                        </div>
                        <i class="fas fa-chevron-left text-black-300 group-hover:text-white transition-colors"></i>
                    </div>
                </div>
            </div>
        </div>`;
    },

    _getEmployeeAccountingSubHub() {
      if (!window._empAccPage) window._empAccPage = 'main';
      const page = window._empAccPage;
      const backToMain = `<button onclick="window._accPage='main'; window._empAccPage='main'; document.querySelector('[x-show*=\\"currentPage === \\'accounting\\'\\"]').innerHTML=document.querySelector('[x-data]').__x.$data.getAccountingContent();"
          class="mb-4 flex items-center gap-2 text-black-300 hover:text-white text-sm"><i class="fas fa-arrow-right"></i> بازگشت به حسابداری</button>`;

      if (page === 'emp_accounting') {
        if (typeof EmployeeAccountingUI === 'undefined') return backToMain + '<p class="text-red-400">ماژول یافت نشد</p>';
        EmployeeAccountingUI.init();
        return `<div>${backToMain}${EmployeeAccountingUI.getManagerEmployeesContent()}</div>`;
      }

      if (page === 'work_hours') {
        if (typeof WorkHoursUI === 'undefined') return backToMain + '<p class="text-red-400">ماژول یافت نشد</p>';
        WorkHoursUI.init();
        return `<div>${backToMain}${WorkHoursUI.getManagerContent()}</div>`;
      }

      const backBtn = `<button onclick="window._accPage='main'; window._empAccPage='main'; document.querySelector('[x-show*=\\"currentPage === \\'accounting\\'\\"]').innerHTML=document.querySelector('[x-data]').__x.$data.getAccountingContent();"
          class="mb-4 flex items-center gap-2 text-black-300 hover:text-white text-sm"><i class="fas fa-arrow-right"></i> بازگشت</button>`;

      return `
        <div class="space-y-6">
            ${backBtn}
            <h2 class="text-2xl font-bold text-white flex items-center gap-3">
                <span class="bg-lime-500/20 p-2 rounded-xl"><i class="fas fa-users-cog text-lime-400"></i></span>
                حسابداری کارمندان
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 cursor-pointer hover:bg-white/15 transition-all group"
                     onclick="window._empAccPage='emp_accounting'; document.querySelector('[x-show*=\\"currentPage === \\'accounting\\'\\"]').innerHTML=document.querySelector('[x-data]').__x.$data.getAccountingContent();">
                    <div class="flex flex-col items-center text-center gap-4">
                        <div class="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <i class="fas fa-calculator text-3xl text-black-400"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold text-white mb-2">حسابداری کارمندان</h3>
                            <p class="text-black-400 text-sm">نرخ ساعتی، هزینه‌ها و کسورات</p>
                        </div>
                        <i class="fas fa-chevron-left text-black-300 group-hover:text-white transition-colors"></i>
                    </div>
                </div>
                <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 cursor-pointer hover:bg-white/15 transition-all group"
                     onclick="window._empAccPage='work_hours'; document.querySelector('[x-show*=\\"currentPage === \\'accounting\\'\\"]').innerHTML=document.querySelector('[x-data]').__x.$data.getAccountingContent();">
                    <div class="flex flex-col items-center text-center gap-4">
                        <div class="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <i class="fas fa-clock text-3xl text-amber-400"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold text-white mb-2">ساعات کاری کارمندان</h3>
                            <p class="text-black-400 text-sm">تأیید ساعات، هزینه‌ها و کسورات</p>
                        </div>
                        <i class="fas fa-chevron-left text-black-300 group-hover:text-white transition-colors"></i>
                    </div>
                </div>
            </div>
        </div>`;
    },

    // Get employee management accounting content (manager only)
    getEmployeeAccountingContent() {
      try {
        debugLogger("Loading employee accounting content...", "info");

        if (this.currentUser.role !== "manager") {
          return '<div class="text-lime-500">دسترسی محدود: فقط مدیر</div>';
        }

        if (typeof EmployeeAccountingUI === "undefined") {
          return '<div class="text-red-500">خطا: ماژول EmployeeAccountingUI یافت نشد</div>';
        }

        EmployeeAccountingUI.init();
        return EmployeeAccountingUI.getManagerEmployeesContent();
      } catch (error) {
        debugLogger("Error loading employee accounting content", "error", error);
        return `<div class="text-red-500">خطا: ${error.message}</div>`;
      }
    },

    // Get embassy content (manager and employee)
    getEmbassyContent() {
      try {
        if (typeof EmbassyModule === 'undefined') {
          return '<div class="text-red-400 p-4">خطا: ماژول سفارت بارگذاری نشده</div>';
        }
        const html = EmbassyModule.getContent();
        // init بعد از رندر DOM
        setTimeout(() => EmbassyModule.init(), 150);
        return html;
      } catch (error) {
        return `<div class="text-red-400 p-4">خطا در بارگذاری سفارت: ${error.message}</div>`;
      }
    },
    getProfileContent() {
      try {
        debugLogger("Loading profile content...", "info", this.currentUser);
        if (!ProfileModule) {
          debugLogger("ProfileModule not found", "error");
          return '<div class="text-red-500">خطا: ماژول پروفایل یافت نشد</div>';
        }
        const content = ProfileModule.getProfileContent(this.currentUser);
        debugLogger("Profile content loaded", "success");
        return content;
      } catch (error) {
        debugLogger("Error loading profile content", "error", error);
        return '<div class="text-red-500">خطا در بارگذاری پروفایل</div>';
      }
    },

    // Get users content (manager only) - TEST MODE: Access restrictions temporarily disabled
    getUsersContent() {
      try {
        debugLogger("Loading users content...", "info", {
          role: this.currentUser.role,
        });
        // TEST MODE: Temporarily disabled access check
        // if (this.currentUser.role !== CONFIG.ROLES.MANAGER) {
        //     debugLogger('Access denied: not manager', 'warning');
        //     return '<div class="text-lime-500">دسترسی محدود: فقط مدیر</div>';
        // }
        if (!UsersModule) {
          debugLogger("UsersModule not found", "error");
          return '<div class="text-red-500">خطا: ماژول کاربران یافت نشد</div>';
        }
        const content = UsersModule.getUsersContent();
        debugLogger("Users content loaded", "success");
        return content;
      } catch (error) {
        debugLogger("Error loading users content", "error", error);
        return '<div class="text-red-500">خطا در بارگذاری کاربران</div>';
      }
    },

    // Get tasks content (manager only) - TEST MODE: Access restrictions temporarily disabled
    getTasksContent() {
      try {
        debugLogger("Loading tasks content...", "info", {
          role: this.currentUser.role,
        });
        // TEST MODE: Temporarily disabled access check
        // if (this.currentUser.role !== CONFIG.ROLES.MANAGER) {
        //     debugLogger('Access denied: not manager', 'warning');
        //     return '<div class="text-lime-500">دسترسی محدود: فقط مدیر</div>';
        // }
        if (!TasksModule) {
          debugLogger("TasksModule not found", "error");
          return '<div class="text-red-500">خطا: ماژول وظایف یافت نشد</div>';
        }
        const content = TasksModule.getTasksContent();
        debugLogger("Tasks content loaded", "success");
        return content;
      } catch (error) {
        debugLogger("Error loading tasks content", "error", error);
        return '<div class="text-red-500">خطا در بارگذاری وظایف</div>';
      }
    },

    // Get my tasks content (employee only) - TEST MODE: Access restrictions temporarily disabled
    getMyTasksContent() {
      try {
        debugLogger("Loading my tasks content...", "info", {
          role: this.currentUser.role,
        });
        // TEST MODE: Temporarily disabled access check
        // if (this.currentUser.role !== CONFIG.ROLES.employee) {
        //     debugLogger('Access denied: not employee', 'warning');
        //     return '<div class="text-lime-500">دسترسی محدود: فقط کارمند</div>';
        // }
        if (!EmployeeModule) {
          debugLogger("EmployeeModule not found", "error");
          return '<div class="text-red-500">خطا: ماژول کارمند یافت نشد</div>';
        }
        const content = EmployeeModule.getMyTasksContent(this.currentUser.id);
        debugLogger("My tasks content loaded", "success");
        return content;
      } catch (error) {
        debugLogger("Error loading my tasks content", "error", error);
        return '<div class="text-red-500">خطا در بارگذاری وظایف</div>';
      }
    },

    // Get chat with manager content (employee only) - TEST MODE: Access restrictions temporarily disabled
    getChatWithManagerContent() {
      try {
        debugLogger("Loading chat with manager content...", "info", {
          role: this.currentUser.role,
        });
        // TEST MODE: Temporarily disabled access check
        // if (this.currentUser.role !== CONFIG.ROLES.employee) {
        //     debugLogger('Access denied: not employee', 'warning');
        //     return '<div class="text-lime-500">دسترسی محدود: فقط کارمند</div>';
        // }
        if (!EmployeeModule) {
          debugLogger("EmployeeModule not found", "error");
          return '<div class="text-red-500">خطا: ماژول کارمند یافت نشد</div>';
        }
        const content = EmployeeModule.getChatWithManagerContent(
          this.currentUser.id,
        );
        debugLogger("Chat with manager content loaded", "success");
        return content;
      } catch (error) {
        debugLogger("Error loading chat with manager content", "error", error);
        return '<div class="text-red-500">خطا در بارگذاری گفتگو</div>';
      }
    },

    // Get personal chat content - برای همه نقش‌ها
    getPersonalChatContent() {
      try {
        debugLogger("Loading personal chat content...", "info", {
          role: this.currentUser.role,
        });
        if (!PersonalChatModule) {
          debugLogger("PersonalChatModule not found", "error");
          return '<div class="text-red-500">خطا: ماژول گفتگو شخصی یافت نشد</div>';
        }
        const content = PersonalChatModule.getPersonalChatContent();
        debugLogger("Personal chat content loaded", "success");
        return content;
      } catch (error) {
        debugLogger("Error loading personal chat content", "error", error);
        return '<div class="text-red-500">خطا در بارگذاری گفتگو شخصی</div>';
      }
    },

    // Get management chat content (manager and employees) - TEST MODE: Access restrictions temporarily disabled
    getManagementChatContent() {
      try {
        debugLogger("Loading management chat content...", "info", {
          role: this.currentUser.role,
        });
        // TEST MODE: Temporarily disabled access check
        // if (this.currentUser.role !== CONFIG.ROLES.MANAGER && this.currentUser.role !== CONFIG.ROLES.employee) {
        //     debugLogger('Access denied: not manager or employee', 'warning');
        //     return '<div class="text-lime-500">دسترسی محدود: فقط مدیر و کارمند‌ها</div>';
        // }
        if (!ManagementChatModule) {
          debugLogger("ManagementChatModule not found", "error");
          return '<div class="text-red-500">خطا: ماژول گفتگو مدیریت یافت نشد</div>';
        }
        const content = ManagementChatModule.getManagementChatContent(
          this.currentUser,
        );
        debugLogger("Management chat content loaded", "success");
        return content;
      } catch (error) {
        debugLogger("Error loading management chat content", "error", error);
        return '<div class="text-red-500">خطا در بارگذاری گفتگو مدیریت</div>';
      }
    },

    // Get work hours content (manager and employees)
    getWorkHoursContent() {
      try {
        debugLogger("Loading work hours content...", "info", {
          role: this.currentUser.role,
        });

        // Initialize the module
        if (typeof WorkHoursUI !== "undefined") {
          WorkHoursUI.init();

          // Return different content based on role
          if (this.currentUser.role === "manager") {
            debugLogger("Loading manager work hours view", "info");
            return WorkHoursUI.getManagerContent();
          } else if (this.currentUser.role === "employee") {
            debugLogger("Loading employee work hours view", "info");
            return WorkHoursUI.getEmployeeContent();
          }
        }

        debugLogger("WorkHoursUI not found", "error");
        return '<div class="text-red-500">خطا: ماژول ساعات کاری یافت نشد</div>';
      } catch (error) {
        debugLogger("Error loading work hours content", "error", error);
        return '<div class="text-red-500">خطا در بارگذاری ساعات کاری</div>';
      }
    },

    // Get agent accounting content (agent only)
    getAgentAccountingContent() {
      try {
        if (typeof AgentAccountingModule === 'undefined') {
          return '<div class="text-red-500">خطا: ماژول حسابداری عامل یافت نشد</div>';
        }
        return AgentAccountingModule.getContent(this.currentUser.id);
      } catch (error) {
        debugLogger("Error loading agent accounting content", "error", error);
        return '<div class="text-red-500">خطا در بارگذاری حسابداری</div>';
      }
    },

    // Get agent chat content (agent only) - TEST MODE: Access restrictions temporarily disabled
    getAgentChatContent() {
      try {
        debugLogger("Loading agent chat content...", "info", {
          role: this.currentUser.role,
        });
        // TEST MODE: Temporarily disabled access check
        // if (this.currentUser.role !== CONFIG.ROLES.AGENT) {
        //     debugLogger('Access denied: not agent', 'warning');
        //     return '<div class="text-lime-500">دسترسی محدود: فقط عامل‌ها</div>';
        // }
        if (!AgentChatModule) {
          debugLogger("AgentChatModule not found", "error");
          return '<div class="text-red-500">خطا: ماژول گفتگو عامل یافت نشد</div>';
        }
        const content = AgentChatModule.getAgentChatContent(this.currentUser);
        debugLogger("Agent chat content loaded", "success");
        return content;
      } catch (error) {
        debugLogger("Error loading agent chat content", "error", error);
        return '<div class="text-red-500">خطا در بارگذاری گفتگو عامل</div>';
      }
    },

    // Get my agent tasks content (agent only) - TEST MODE: Access restrictions temporarily disabled
    getMyAgentTasksContent() {
      try {
        debugLogger("Loading my agent tasks content...", "info", {
          role: this.currentUser.role,
          userId: this.currentUser.id,
          userName: this.currentUser.name,
        });

        // Call the global function
        if (typeof window.getMyAgentTasksContent === "function") {
          const content = window.getMyAgentTasksContent();
          debugLogger("My agent tasks content loaded", "success");
          return content;
        } else {
          debugLogger("window.getMyAgentTasksContent not found", "error");
          return '<div class="text-red-500">خطا: تابع وظایف عامل یافت نشد</div>';
        }
      } catch (error) {
        debugLogger("Error loading my agent tasks content", "error", error);
        return '<div class="text-red-500">خطا در بارگذاری وظایف عامل</div>';
      }
    },

    getAgentTasksContent() {
      try {
        debugLogger("Loading agent tasks content...", "info", {
          role: this.currentUser.role,
          userId: this.currentUser.id,
          userName: this.currentUser.name,
        });

        if (typeof window.getMyAgentTasksContent === "function") {
          const content = window.getMyAgentTasksContent();
          debugLogger("Agent tasks content loaded (enhanced)", "success");
          return content;
        } else if (typeof window.getAgentTasksContent === "function") {
          const content = window.getAgentTasksContent();
          debugLogger("Agent tasks content loaded (fallback)", "success");
          return content;
        } else {
          debugLogger(
            "window.getMyAgentTasksContent and window.getAgentTasksContent not found",
            "error",
          );
          return '<div class="text-red-500">خطا: تابع وظایف عامل یافت نشد</div>';
        }
      } catch (error) {
        debugLogger("Error loading agent tasks content", "error", error);
        return '<div class="text-red-500">خطا در بارگذاری وظایف عامل</div>';
      }
    },

    // Show notifications
    showNotifications() {
      try {
        debugLogger("Loading notifications...", "info");
        this.notifications = [
          {
            id: 1,
            message: "سفارش جدید ثبت شد",
            type: "info",
            time: "5 دقیقه پیش",
          },
          {
            id: 2,
            message: "رساله تایید شد",
            type: "success",
            time: "1 ساعت پیش",
          },
        ];
        this.showModal = "notifications";
        debugLogger("Notifications loaded", "success", this.notifications);
      } catch (error) {
        debugLogger("Error loading notifications", "error", error);
      }
    },

    // View order details
    viewOrder(orderId) {
      try {
        debugLogger(`Viewing order: ${orderId}`, "info");
        const orders = DataModule.getOrders();
        this.selectedOrder = orders.find((o) => o.id === orderId);
        if (this.selectedOrder) {
          this.showModal = "viewOrder";
          debugLogger(
            "Order found and modal opened",
            "success",
            this.selectedOrder,
          );
        } else {
          debugLogger("Order not found", "warning", {
            orderId,
            availableOrders: orders.map((o) => o.id),
          });
        }
      } catch (error) {
        debugLogger("Error viewing order", "error", error);
      }
    },

    // Register service worker for PWA
    registerServiceWorker() {
      try {
        if ("serviceWorker" in navigator) {
          debugLogger("Registering service worker...", "info");
          navigator.serviceWorker
            .register("/sw.js")
            .then((registration) => {
              debugLogger(
                "Service worker registered successfully",
                "success",
                registration,
              );
            })
            .catch((registrationError) => {
              debugLogger(
                "Service worker registration failed",
                "error",
                registrationError,
              );
            });
        } else {
          debugLogger("Service worker not supported", "warning");
        }
      } catch (error) {
        debugLogger("Error in service worker registration", "error", error);
      }
    },
  };
}

// Global functions for onclick handlers
window.showModal = null;
window.currentPage = "dashboard";
window.currentOrderId = null;

window.viewOrder = function (orderId) {
  debugLogger(`Global viewOrder called: ${orderId}`, "info");
  try {
    const alpineData = ModalsModule ? ModalsModule.getAlpineData() : null;
    if (alpineData && alpineData.viewOrder) {
      alpineData.viewOrder(orderId);
    } else {
      debugLogger("Alpine.js app data not found, using fallback", "warning");
      // Use workflow module if available
      if (typeof viewOrderDetails !== "undefined") {
        viewOrderDetails(orderId);
      } else {
        UTILS.showNotification("مشاهده سفارش در حال توسعه است", "info");
      }
    }
  } catch (error) {
    debugLogger("Error in viewOrder", "error", error);
    UTILS.showNotification("خطا در مشاهده سفارش", "error");
  }
};

window.assignOrder = function (orderId) {
  debugLogger(`Global assignOrder called: ${orderId}`, "info");
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

  const alpineData = ModalsModule ? ModalsModule.getAlpineData() : null;
  if (alpineData) {
    alpineData.showModal = "assignOrder";
  }
};

window.submitAssignOrder = function (doctorId) {
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
    orders[orderIndex].stage =
      `عامل در حال نوشتن ${orders[orderIndex].type === "نوشتن رساله" ? "رساله" : orders[orderIndex].type === "نوشتن مقاله" ? "مقاله" : "سفارش"} شما است`;
    orders[orderIndex].assignedAt = new Date().toISOString();
    orders[orderIndex].progress = 5;

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
    }

    debugLogger("Order assigned successfully", "success", {
      orderId,
      doctorId,
    });
    UTILS.showNotification(`سفارش به ${doctor.name} تخصیص یافت`, "success");

    const alpineData = ModalsModule ? ModalsModule.getAlpineData() : null;
    if (alpineData) {
      alpineData.showModal = null;
    }

    UIRefresh.orders();
  } catch (error) {
    debugLogger("Error assigning order", "error", error);
    UTILS.showNotification("خطا در تخصیص سفارش", "error");
  }
};

window.approveOrder = function (orderId) {
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

    orders[orderIndex].status = CONFIG.ORDER_STATUS.IN_PROGRESS;
    orders[orderIndex].stage =
      "در حال انجام";
    orders[orderIndex].approvedAt = new Date().toISOString();
    orders[orderIndex].progress = 5;

    DataModule.saveOrders(orders);

    debugLogger("Order approved successfully", "success", { orderId });
    UTILS.showNotification("سفارش با موفقیت تایید شد", "success");

    UIRefresh.orders();
  } catch (error) {
    debugLogger("Error approving order", "error", error);
    UTILS.showNotification("خطا در تایید سفارش", "error");
  }
};

window.rejectOrder = function (orderId) {
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

  const alpineData = ModalsModule ? ModalsModule.getAlpineData() : null;
  if (alpineData) {
    alpineData.showModal = "rejectOrder";
  }
};

window.submitRejectOrder = function (reason) {
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
    const currentUser = ModalsModule
      ? ModalsModule.getCurrentUser()
      : { id: "mgr001", name: "مدیر", role: "manager" };

    orders[orderIndex].status = CONFIG.ORDER_STATUS.PENDING;
    orders[orderIndex].stage = "در انتظار";
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

    const alpineData = ModalsModule ? ModalsModule.getAlpineData() : null;
    if (alpineData) {
      alpineData.showModal = null;
    }

    UIRefresh.orders();
  } catch (error) {
    debugLogger("Error rejecting order", "error", error);
    UTILS.showNotification("خطا در رد سفارش", "error");
  }
};

// Initialize app when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  debugLogger("DOM loaded, Alpine.js will initialize app", "info");
});

// Logout function
window.logout = function () {
  if (confirm("آیا می‌خواهید از حساب کاربری خود خارج شوید؟")) {
    // Sign out from Supabase (handles both online and offline modes)
    const doLogout = async () => {
      try {
        if (typeof SupabaseAuth !== 'undefined') {
          await SupabaseAuth.logout(); // پاک کردن localStorage + signOut از Supabase
        } else {
          // fallback
          localStorage.removeItem('currentUser');
          localStorage.removeItem('edu_system_current_user');
        }
      } catch (e) {
        console.warn('logout error:', e.message);
        localStorage.removeItem('currentUser');
        localStorage.removeItem('edu_system_current_user');
      }
      UTILS.showNotification("با موفقیت خارج شدید", "success");
      setTimeout(() => { window.location.href = 'login.html'; }, 800);
    };
    doLogout();
  }
};

// Global fallback functions for workflow
window.showAssignmentModal =
  window.showAssignmentModal ||
  function (orderId) {
    debugLogger("showAssignmentModal fallback called", "warning", { orderId });
    if (
      typeof WorkflowModule !== "undefined" &&
      WorkflowModule.showAssignmentModal
    ) {
      WorkflowModule.showAssignmentModal(orderId);
    } else {
      UTILS.showNotification(
        "سیستم تخصیص در حال بارگذاری است، لطفاً کمی صبر کنید",
        "warning",
      );
      // Retry after a short delay
      setTimeout(() => {
        if (
          typeof WorkflowModule !== "undefined" &&
          WorkflowModule.showAssignmentModal
        ) {
          WorkflowModule.showAssignmentModal(orderId);
        } else {
          UTILS.showNotification("خطا در بارگذاری سیستم تخصیص", "error");
        }
      }, 1000);
    }
  };

window.viewOrderDetails =
  window.viewOrderDetails ||
  function (orderId) {
    debugLogger("viewOrderDetails fallback called", "warning", { orderId });
    if (
      typeof WorkflowModule !== "undefined" &&
      WorkflowModule.viewOrderDetails
    ) {
      WorkflowModule.viewOrderDetails(orderId);
    } else {
      UTILS.showNotification(
        "سیستم مشاهده جزئیات در حال بارگذاری است",
        "warning",
      );
      setTimeout(() => {
        if (
          typeof WorkflowModule !== "undefined" &&
          WorkflowModule.viewOrderDetails
        ) {
          WorkflowModule.viewOrderDetails(orderId);
        } else {
          UTILS.showNotification(
            "خطا در بارگذاری سیستم مشاهده جزئیات",
            "error",
          );
        }
      }, 1000);
    }
  };

// User management functions
window.openAddUserModal = function () {
  debugLogger("Opening add user modal", "info");
  try {
    // Get Alpine component
    const appElement = document.querySelector("[x-data]");
    if (appElement && appElement.__x && appElement.__x.$data) {
      appElement.__x.$data.showModal = "addUser";
      debugLogger("Modal opened successfully", "success");
    } else {
      debugLogger("Alpine.js not found, trying alternative method", "warning");
      // Alternative: dispatch custom event
      window.dispatchEvent(
        new CustomEvent("openModal", { detail: { modal: "addUser" } }),
      );
    }
  } catch (error) {
    debugLogger("Error opening modal: " + error.message, "error");
    console.error("Modal error:", error);
  }
};

window.editUser = function (userId) {
  debugLogger(`Edit user: ${userId}`, "info");
  const users = DataModule.getUsers();
  const user = users.find((u) => u.id === userId);

  if (!user) {
    UTILS.showNotification("کاربر یافت نشد", "error");
    return;
  }

  // Show edit modal with user data
  window.showModal = "editUser";
  window.editingUserId = userId;
  window.editingUserData = { ...user };
};

window.toggleUserStatus = function (userId) {
  if (confirm("آیا از تغییر وضعیت کاربر مطمئن هستید؟")) {
    const result = UsersModule.toggleUserStatus(userId);
    if (result) {
      UIRefresh.orders();
    }
  }
};

window.deleteUser = function (userId) {
  if (confirm("آیا از حذف این کاربر مطمئن هستید؟ این عمل قابل بازگشت نیست.")) {
    const result = UsersModule.deleteUser(userId);
    if (result) {
      UIRefresh.orders();
    }
  }
};

window.updateProfile = function () {
  ProfileModule.updateProfile();
};

window.downloadProfile = function () {
  try {
    const currentUser = ModalsModule
      ? ModalsModule.getCurrentUser()
      : { id: "mgr001", name: "مدیر" };
    const dataStr = JSON.stringify(currentUser, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `profile-${currentUser.username}-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    UTILS.showNotification("اطلاعات پروفایل دانلود شد", "success");
  } catch (error) {
    debugLogger("Error downloading profile", "error", error);
    UTILS.showNotification("خطا در دانلود پروفایل", "error");
  }
};

// ── توابع عامل در js/agent-orders.js هستند ──────────────────

// ── توابع عامل در js/agent-orders.js هستند ──────────────────

window.getMyIncomeContent = function () {
  try {
    // Get current user from Alpine.js or localStorage
    let currentUser;
    try {
      if (window.Alpine && document.querySelector("[x-data]")) {
        currentUser = document.querySelector("[x-data]").__x.$data.currentUser;
      }
    } catch (e) {
      // Fallback to localStorage
    }

    if (!currentUser) {
      currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
    }

    // TEST MODE: Temporarily disabled access check
    // if (!currentUser || !currentUser.id || currentUser.role !== 'agent') {
    //     return '<div class="text-lime-500">دسترسی محدود: فقط عامل‌ها</div>';
    // }

    if (!currentUser || !currentUser.id) {
      return '<div class="text-lime-500">لطفاً وارد سیستم شوید</div>';
    }

    // Get all orders assigned to this agent
    const orders = DataModule.getOrders();
    const myOrders = orders.filter(
      (o) =>
        o.assignedDoctorId === currentUser.id ||
        o.assigned_doctor === currentUser.id ||
        o.assignedDoctor === currentUser.id,
    );

    // Calculate totals by currency
    const incomeByWork = {};
    const incomeByCurrency = {};

    myOrders.forEach((order) => {
      const currency = order.currency || "تومان";
      const workList = order.workList || [];
      const workPrices = order.workPrices || {};

      // Initialize currency if not exists
      if (!incomeByCurrency[currency]) {
        incomeByCurrency[currency] = 0;
      }

      // Add doctor share
      incomeByCurrency[currency] += order.doctorShare || 0;

      // Track income by work type
      workList.forEach((work) => {
        const price = workPrices[work] || 0;
        if (!incomeByWork[work]) {
          incomeByWork[work] = { count: 0, total: 0, currency: currency };
        }
        incomeByWork[work].count++;
        incomeByWork[work].total += price;
      });
    });

    return `
            <div class="space-y-6">
                <!-- Header -->
                <div class="flex justify-between items-center">
                    <h2 class="text-2xl font-bold text-white">
                        <i class="fas fa-money-bill-wave text-green-400 ml-2"></i>
                        درآمد من
                    </h2>
                </div>

                <!-- Total Income by Currency -->
                <div class="grid grid-cols-1 md:grid-cols-${Object.keys(incomeByCurrency).length || 1} gap-4">
                    ${
                      Object.keys(incomeByCurrency).length === 0
                        ? `
                        <div class="bg-slate-800 rounded-lg p-6 text-center">
                            <i class="fas fa-money-bill-wave text-4xl text-gray-500 mb-3"></i>
                            <p class="text-gray-400">هنوز درآمدی ثبت نشده است</p>
                        </div>
                    `
                        : Object.entries(incomeByCurrency)
                            .map(
                              ([currency, total]) => `
                        <div class="bg-gradient-to-br from-green-600 to-emerald-700 rounded-lg p-6 text-white shadow-lg">
                            <p class="text-sm opacity-90 mb-2">کل درآمد (${currency})</p>
                            <p class="text-3xl font-bold">${total.toLocaleString()}</p>
                            <p class="text-sm opacity-75 mt-1">${currency}</p>
                        </div>
                    `,
                            )
                            .join("")
                    }
                </div>

                <!-- Income by Work Type -->
                <div class="bg-slate-800 rounded-lg shadow-md p-4">
                    <h3 class="text-lg font-bold text-white mb-4">
                        <i class="fas fa-chart-bar text-lime-400 ml-2"></i>
                        درآمد بر اساس نوع کار
                    </h3>

                    ${
                      Object.keys(incomeByWork).length === 0
                        ? `
                        <div class="text-center py-8">
                            <i class="fas fa-chart-line text-4xl text-gray-500 mb-4"></i>
                            <p class="text-gray-400">هنوز کاری انجام نشده است</p>
                        </div>
                    `
                        : `
                        <div class="space-y-3">
                            ${Object.entries(incomeByWork)
                              .map(
                                ([work, data]) => `
                                <div class="bg-slate-700 rounded-lg p-4">
                                    <div class="flex justify-between items-center mb-2">
                                        <h4 class="text-white font-bold">${work}</h4>
                                        <span class="text-green-400 font-bold text-lg">
                                            ${data.total.toLocaleString()} ${data.currency}
                                        </span>
                                    </div>
                                    <div class="flex justify-between text-sm text-gray-400">
                                        <span>تعداد: ${data.count} کار</span>
                                        <span>میانگین: ${Math.round(data.total / data.count).toLocaleString()} ${data.currency}</span>
                                    </div>
                                </div>
                            `,
                              )
                              .join("")}
                        </div>
                    `
                    }
                </div>

                <!-- Detailed Orders List -->
                <div class="bg-white rounded-lg shadow-md p-4 border border-gray-200">
                    <h3 class="text-lg font-bold text-gray-800 mb-4">
                        <i class="fas fa-list-ul text-lime-500 ml-2"></i>
                        جزئیات سفارشات و درآمد
                    </h3>

                    ${
                      myOrders.length === 0
                        ? `
                        <div class="text-center py-8">
                            <i class="fas fa-clipboard-list text-4xl text-gray-300 mb-4"></i>
                            <p class="text-gray-500">هنوز سفارشی به شما تخصیص داده نشده است</p>
                        </div>
                    `
                        : `
                        <div class="overflow-x-auto">
                            <table class="w-full">
                                <thead class="bg-lime-50 border-b-2 border-lime-100">
                                    <tr>
                                        <th class="px-4 py-3 text-right text-sm font-semibold text-lime-700">دانشجو</th>
                                        <th class="px-4 py-3 text-right text-sm font-semibold text-lime-700">نوع سفارش</th>
                                        <th class="px-4 py-3 text-right text-sm font-semibold text-lime-700">لیست کارها</th>
                                        <th class="px-4 py-3 text-right text-sm font-semibold text-lime-700">قیمت هر کار</th>
                                        <th class="px-4 py-3 text-right text-sm font-semibold text-lime-700">درآمد من</th>
                                        <th class="px-4 py-3 text-right text-sm font-semibold text-lime-700">وضعیت</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-gray-100">
                                    ${myOrders
                                      .map((order) => {
                                        const workList = order.workList || [];
                                        const workPrices =
                                          order.workPrices || {};
                                        const currency =
                                          order.currency || "تومان";

                                        return `
                                            <tr class="hover:bg-lime-50 transition-colors">
                                                <td class="px-4 py-3 text-sm font-medium text-gray-800">${order.studentName}</td>
                                                <td class="px-4 py-3 text-sm text-gray-600">${order.type}</td>
                                                <td class="px-4 py-3 text-sm text-gray-600">
                                                    ${
                                                      workList.length === 0
                                                        ? '<span class="text-gray-400">تعیین نشده</span>'
                                                        : `<ul class="list-disc list-inside space-y-1">
                                                            ${workList.map((work) => `<li class="text-gray-700">${work}</li>`).join("")}
                                                        </ul>`
                                                    }
                                                </td>
                                                <td class="px-4 py-3 text-sm text-gray-600">
                                                    ${
                                                      workList.length === 0
                                                        ? '<span class="text-gray-400">-</span>'
                                                        : `<ul class="space-y-1">
                                                            ${workList
                                                              .map(
                                                                (work) =>
                                                                  `<li class="text-amber-600 font-medium">${(workPrices[work] || 0).toLocaleString()} ${currency}</li>`,
                                                              )
                                                              .join("")}
                                                        </ul>`
                                                    }
                                                </td>
                                                <td class="px-4 py-3 text-sm font-bold text-emerald-600">
                                                    ${(order.doctorShare || 0).toLocaleString()} ${currency}
                                                </td>
                                                <td class="px-4 py-3 text-sm">
                                                    <span class="px-2 py-1 rounded-full text-xs font-medium ${
                                                      order.status === "completed"
                                                        ? "bg-green-100 text-green-700 border border-green-200"
                                                        : order.status === "in_progress"
                                                          ? "bg-blue-100 text-black-700 border border-blue-200"
                                                          : "bg-amber-100 text-amber-700 border border-amber-200"
                                                    }">
                                                        ${
                                                          order.status === "completed"
                                                            ? "تکمیل شده"
                                                            : order.status === "in_progress"
                                                              ? "در حال انجام"
                                                              : "در انتظار"
                                                        }
                                                    </span>
                                                </td>
                                            </tr>
                                        `;
                                      })
                                      .join("")}
                                </tbody>
                            </table>
                        </div>
                    `
                    }
                </div>
            </div>
        `;
  } catch (error) {
    debugLogger("Error loading income content", "error", error);
    return '<div class="text-red-500">خطا در بارگذاری درآمد</div>';
  }
};

window.getPersonalArchiveContent = function () {
  try {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));

    // TEST MODE: Temporarily disabled access check
    // if (!currentUser || currentUser.role !== 'agent') {
    //     return '<div class="text-lime-500">دسترسی محدود: فقط عامل‌ها</div>';
    // }

    if (!currentUser) {
      return '<div class="text-lime-500">لطفاً وارد سیستم شوید</div>';
    }

    if (typeof PersonalArchiveModule === "undefined") {
      return '<div class="text-red-500">خطا: ماژول بایگانی شخصی یافت نشد</div>';
    }

    return PersonalArchiveModule.getPersonalArchiveContent(currentUser.id);
  } catch (error) {
    debugLogger("Error loading personal archive content", "error", error);
    return '<div class="text-red-500">خطا در بارگذاری بایگانی شخصی</div>';
  }
};
