// Main Application Controller with API Integration
function appController() {
  return {
    // State
    selectedUserId: "mgr001",
    currentUser: {
      id: "mgr001",
      name: "عامل تقی زاده",
      username: "manager",
      role: "manager",
      email: "taghizadeh@edu-system.com",
      phone: "+98 912 123 4567",
    },
    currentPage: "dashboard",
    showModal: null,
    selectedOrder: null,
    notifications: [],
    isLoading: false,
    apiMode: false, // Track if we're using API or localStorage
    dashboardContent:
      '<div class="text-center text-gray-500">در حال بارگذاری...</div>',
    ordersContent: "",
    sidebarOpen: window.innerWidth >= 1024, // Sidebar state - open on desktop by default

    // Initialize app
    async init() {
      try {
        debugLogger("Initializing application...", "info");
        this.isLoading = true;

        // Set sidebar state based on screen size
        this.sidebarOpen = window.innerWidth >= 1024;

        // Subscribe to real-time events for automatic UI updates (optional - no-op if not available)
        if (typeof this.subscribeToRealtimeEvents === 'function') {
            this.subscribeToRealtimeEvents();
        }

        // Watch for page changes to load content
        this.$watch("currentPage", async (newPage) => {
          console.log("📄 Page changed to:", newPage);
          if (newPage === "orders") {
            console.log("🔄 Loading orders page...");
            await this.loadOrdersPageWithRetry();
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
        dashboard: "داشبورد",
        tasks: "مدیریت همکاران",
        myTasks: "وظایف من",
        myAgentTasks: "وظایف من",
        myIncome: "درآمد من",
        orders: "سفارشات",
        accounting: "حسابداری",
        employeeAccounting: "حسابداری کارمندان",
        workHours: "ساعات کاری",
        chatWithManager: "گفتگو با مدیر",
        managementChat: "گفتگو مدیریت",
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
            name: "ساره",
            username: "zahra",
            role: "employee",
            email: "zahra@edu-system.com",
          },
          {
            id: "emp002",
            name: "زینب",
            username: "fatemeh",
            role: "employee",
            email: "fatemeh@edu-system.com",
          },
          {
            id: "emp003",
            name: "فرزاد",
            username: "farzad",
            role: "employee",
            email: "farzad@edu-system.com",
          },
          {
            id: "emp004",
            name: "سلیمان",
            username: "soleiman",
            role: "employee",
            email: "soleiman@edu-system.com",
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
            '<div class="text-yellow-500">داشبورد در حال بارگذاری...</div>';
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
        '<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-4xl text-blue-500"></i><p class="mt-4 text-white">در حال بارگذاری...</p></div>';
      this.ordersContent = await this.getOrdersContent();
    },

    // Load orders page with retry mechanism (حرفه‌ای)
    async loadOrdersPageWithRetry(maxRetries = 10) {
      this.ordersContent =
        '<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-4xl text-blue-500"></i><p class="mt-4 text-white">در حال بارگذاری...</p></div>';

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

        // Initialize and render
        AccountingUI.init();
        const content = AccountingUI.render();
        debugLogger("Accounting content loaded", "success");
        return content;
      } catch (error) {
        debugLogger("Error loading accounting content", "error", error);
        return `<div class="text-red-500">خطا در بارگذاری حسابداری: ${error.message}</div>`;
      }
    },

    // Get employee management accounting content (manager only)
    getEmployeeAccountingContent() {
      try {
        debugLogger("Loading employee accounting content...", "info");

        if (this.currentUser.role !== "manager") {
          return '<div class="text-yellow-500">دسترسی محدود: فقط مدیر</div>';
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

    // Get profile content
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
        //     return '<div class="text-yellow-500">دسترسی محدود: فقط مدیر</div>';
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
        //     return '<div class="text-yellow-500">دسترسی محدود: فقط مدیر</div>';
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
        //     return '<div class="text-yellow-500">دسترسی محدود: فقط کارمند</div>';
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
        //     return '<div class="text-yellow-500">دسترسی محدود: فقط کارمند</div>';
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

    // Get management chat content (manager and employees) - TEST MODE: Access restrictions temporarily disabled
    getManagementChatContent() {
      try {
        debugLogger("Loading management chat content...", "info", {
          role: this.currentUser.role,
        });
        // TEST MODE: Temporarily disabled access check
        // if (this.currentUser.role !== CONFIG.ROLES.MANAGER && this.currentUser.role !== CONFIG.ROLES.employee) {
        //     debugLogger('Access denied: not manager or employee', 'warning');
        //     return '<div class="text-yellow-500">دسترسی محدود: فقط مدیر و کارمند‌ها</div>';
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

    // Get agent chat content (agent only) - TEST MODE: Access restrictions temporarily disabled
    getAgentChatContent() {
      try {
        debugLogger("Loading agent chat content...", "info", {
          role: this.currentUser.role,
        });
        // TEST MODE: Temporarily disabled access check
        // if (this.currentUser.role !== CONFIG.ROLES.AGENT) {
        //     debugLogger('Access denied: not agent', 'warning');
        //     return '<div class="text-yellow-500">دسترسی محدود: فقط عامل‌ها</div>';
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

    setTimeout(() => location.reload(), 1000);
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

    orders[orderIndex].status = CONFIG.ORDER_STATUS.APPROVED;
    orders[orderIndex].stage =
      "مدیر پروژه را تایید کرد - هماهنگی در حال انجام است";
    orders[orderIndex].approvedAt = new Date().toISOString();
    orders[orderIndex].progress = 5;

    DataModule.saveOrders(orders);

    debugLogger("Order approved successfully", "success", { orderId });
    UTILS.showNotification("سفارش با موفقیت تایید شد", "success");

    setTimeout(() => location.reload(), 1000);
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

    orders[orderIndex].status = CONFIG.ORDER_STATUS.REJECTED;
    orders[orderIndex].stage = "رد شده - نیاز به اصلاح";
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

    setTimeout(() => location.reload(), 1000);
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
    // Clear session data
    localStorage.removeItem(CONFIG.STORAGE_KEYS.CURRENT_USER);

    // Redirect to login or reload
    UTILS.showNotification("با موفقیت خارج شدید", "success");
    setTimeout(() => {
      location.reload();
    }, 1000);
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
      setTimeout(() => location.reload(), 1000);
    }
  }
};

window.deleteUser = function (userId) {
  if (confirm("آیا از حذف این کاربر مطمئن هستید؟ این عمل قابل بازگشت نیست.")) {
    const result = UsersModule.deleteUser(userId);
    if (result) {
      setTimeout(() => location.reload(), 1000);
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

// Agent task card - نمایش کارت وظیفه برای عامل
window.getAgentTaskCard = function (task, userId) {
  const statusColors = {
    pending: "border-yellow-500 bg-yellow-500/10",
    in_progress: "border-blue-500 bg-blue-500/10",
    completed: "border-green-500 bg-green-500/10",
  };
  const statusTexts = {
    pending: "در انتظار",
    in_progress: "در حال انجام",
    completed: "تکمیل شده",
  };
  const statusBadgeColors = {
    pending: "bg-yellow-500",
    in_progress: "bg-blue-500",
    completed: "bg-green-500",
  };
  const priorityBadge =
    task.priority === "high"
      ? '<span class="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">فوری</span>'
      : task.priority === "medium"
        ? '<span class="text-xs bg-orange-400 text-white px-2 py-0.5 rounded-full">متوسط</span>'
        : "";

  const orderBadge = task.isOrderTask
    ? `<span class="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
               <i class="fas fa-shopping-bag ml-1"></i>از سفارش
           </span>`
    : "";

  const orderInfoHTML = task.isOrderTask
    ? `
        <div class="mt-2 bg-slate-700 rounded p-2 text-xs text-gray-300 space-y-1">
            ${task.studentName ? `<div><i class="fas fa-user-graduate ml-1 text-blue-400"></i>دانشجو: <span class="text-white">${task.studentName}</span></div>` : ""}
            ${task.university ? `<div><i class="fas fa-university ml-1 text-blue-400"></i>دانشگاه: <span class="text-white">${task.university}</span></div>` : ""}
            ${task.orderType ? `<div><i class="fas fa-file-alt ml-1 text-blue-400"></i>نوع: <span class="text-white">${task.orderType}</span></div>` : ""}
        </div>
    `
    : "";

  const statusCycle = ["pending", "in_progress", "completed"];
  const nextStatus =
    statusCycle[(statusCycle.indexOf(task.status) + 1) % statusCycle.length];
  const nextStatusText = statusTexts[nextStatus];

  return `
        <div class="bg-slate-800 border-r-4 ${statusColors[task.status] || "border-gray-500"} rounded-lg p-4 relative">
            <!-- Badges row -->
            <div class="flex flex-wrap gap-2 mb-3">
                ${orderBadge}
                ${priorityBadge}
                <span class="text-xs ${statusBadgeColors[task.status] || "bg-gray-500"} text-white px-2 py-0.5 rounded-full">
                    ${statusTexts[task.status] || task.status}
                </span>
            </div>

            <!-- Title -->
            <h4 class="font-bold text-white text-sm mb-1">${task.title}</h4>

            <!-- Description -->
            ${task.description ? `<p class="text-gray-400 text-xs mb-2 line-clamp-2">${task.description}</p>` : ""}

            <!-- Order info -->
            ${orderInfoHTML}

            <!-- Footer -->
            <div class="flex items-center justify-between mt-3">
                <span class="text-xs text-gray-500">
                    <i class="fas fa-calendar ml-1"></i>
                    ${task.dueDate || "بدون مهلت"}
                </span>
                <button onclick="window.agentToggleTaskStatus('${task.id}', '${userId}')"
                        class="text-xs bg-slate-600 hover:bg-slate-500 text-white px-2 py-1 rounded transition-colors"
                        title="تغییر وضعیت به: ${nextStatusText}">
                    <i class="fas fa-sync-alt ml-1"></i>
                    ${nextStatusText}
                </button>
            </div>

            <!-- Voice message -->
            ${
              task.voiceMessage
                ? `
            <div class="mt-3 bg-slate-700 rounded p-2 flex items-center space-x-2 space-x-reverse">
                <button onclick="agentPlayVoice('${task.id}')"
                        class="w-8 h-8 rounded-full bg-indigo-500 hover:bg-indigo-600 flex items-center justify-center text-white flex-shrink-0">
                    <i class="fas fa-play text-xs" id="agent-play-icon-${task.id}"></i>
                </button>
                <div class="flex-1">
                    <div class="w-full bg-slate-600 rounded-full h-1">
                        <div class="bg-indigo-400 h-1 rounded-full" style="width:0%" id="agent-progress-${task.id}"></div>
                    </div>
                    <span class="text-xs text-gray-400">${task.voiceDuration || "0:00"}</span>
                </div>
                <audio id="agent-audio-${task.id}" src="${task.voiceMessage}" class="hidden"></audio>
            </div>
            `
                : ""
            }
        </div>
    `;
};

// تغییر وضعیت وظیفه توسط عامل
window.agentToggleTaskStatus = function (taskId, userId) {
  const tasksData = JSON.parse(localStorage.getItem("employee_tasks") || "{}");
  const tasks = tasksData[userId] || [];
  const idx = tasks.findIndex((t) => t.id === taskId);
  if (idx === -1) return;

  const cycle = ["pending", "in_progress", "completed"];
  const cur = cycle.indexOf(tasks[idx].status);
  tasks[idx].status = cycle[(cur + 1) % cycle.length];
  tasksData[userId] = tasks;
  localStorage.setItem("employee_tasks", JSON.stringify(tasksData));

  // بازخوانی صفحه
  const container = document.querySelector(
    "[x-show*=\"currentPage === 'agentTasks'\"]",
  );
  if (container) {
    if (typeof window.getMyAgentTasksContent === "function") {
      container.innerHTML = window.getMyAgentTasksContent();
    } else if (typeof window.getAgentTasksContent === "function") {
      container.innerHTML = window.getAgentTasksContent();
    }
  }
  UTILS.showNotification("وضعیت وظیفه تغییر کرد", "success");
};

// پخش صدا در صفحه عامل
window.agentPlayVoice = function (taskId) {
  const audio = document.getElementById(`agent-audio-${taskId}`);
  const icon = document.getElementById(`agent-play-icon-${taskId}`);
  const prog = document.getElementById(`agent-progress-${taskId}`);
  if (!audio) return;
  if (audio.paused) {
    document.querySelectorAll("audio").forEach((a) => {
      if (a !== audio) {
        a.pause();
        a.currentTime = 0;
      }
    });
    audio.play();
    icon.className = "fas fa-pause text-xs";
    audio.ontimeupdate = () => {
      prog.style.width = (audio.currentTime / audio.duration) * 100 + "%";
    };
    audio.onended = () => {
      icon.className = "fas fa-play text-xs";
      prog.style.width = "0%";
    };
  } else {
    audio.pause();
    icon.className = "fas fa-play text-xs";
  }
};

// Agent-specific functions - TEST MODE: Access restrictions temporarily disabled
window.getMyAgentTasksContent = function () {
  try {
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

    if (!currentUser || !currentUser.id) {
      return '<div class="text-yellow-500">لطفاً وارد سیستم شوید</div>';
    }

    // وظایف از employee_tasks (شامل وظایف تخصیص سفارش)
    const tasksData = JSON.parse(
      localStorage.getItem("employee_tasks") || "{}",
    );
    const rawTasks = tasksData[currentUser.id];
    const myTasks = Array.isArray(rawTasks) ? rawTasks : [];

    // سفارشات مستقیم تخصیص‌یافته
    const orders = DataModule.getOrders();
    const myOrders = orders.filter((o) => {
      const isAssigned =
        o.assignedDoctorId === currentUser.id ||
        o.assigned_doctor === currentUser.id ||
        o.assignedDoctor === currentUser.id ||
        o.doctorId === currentUser.id ||
        o.doctor_id === currentUser.id;
      return isAssigned;
    });

    // Sort by deadline (most recent first)
    myOrders.sort((a, b) => {
      if (!a.deadlineDateTime) return 1;
      if (!b.deadlineDateTime) return -1;
      return new Date(a.deadlineDateTime) - new Date(b.deadlineDateTime);
    });

    const orderTasksCount = myTasks.filter((t) => t.isOrderTask).length;
    const pendingTasksCount = myTasks.filter(
      (t) => t.status === "pending",
    ).length;
    const inProgressTasksCount = myTasks.filter(
      (t) => t.status === "in_progress",
    ).length;
    const completedTasksCount = myTasks.filter(
      (t) => t.status === "completed",
    ).length;

    return `
            <div class="space-y-6">
                <!-- Header -->
                <div class="flex justify-between items-center">
                    <h2 class="text-2xl font-bold text-white">
                        <i class="fas fa-clipboard-list text-indigo-400 ml-2"></i>
                        وظایف من (${currentUser.name})
                    </h2>
                </div>

                <!-- Stats Cards -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="bg-slate-800 rounded-lg p-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-gray-400 text-sm">کل وظایف</p>
                                <p class="text-2xl font-bold text-white">${myTasks.length}</p>
                            </div>
                            <i class="fas fa-tasks text-3xl text-indigo-400"></i>
                        </div>
                    </div>
                    <div class="bg-slate-800 rounded-lg p-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-gray-400 text-sm">در انتظار</p>
                                <p class="text-2xl font-bold text-yellow-400">${pendingTasksCount}</p>
                            </div>
                            <i class="fas fa-clock text-3xl text-yellow-400"></i>
                        </div>
                    </div>
                    <div class="bg-slate-800 rounded-lg p-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-gray-400 text-sm">در حال انجام</p>
                                <p class="text-2xl font-bold text-blue-400">${inProgressTasksCount}</p>
                            </div>
                            <i class="fas fa-spinner text-3xl text-blue-400"></i>
                        </div>
                    </div>
                    <div class="bg-slate-800 rounded-lg p-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-gray-400 text-sm">تکمیل شده</p>
                                <p class="text-2xl font-bold text-green-400">${completedTasksCount}</p>
                            </div>
                            <i class="fas fa-check-circle text-3xl text-green-400"></i>
                        </div>
                    </div>
                </div>

                <!-- Tasks from Orders Section -->
                <div class="bg-slate-800 rounded-lg p-4">
                    <h3 class="text-lg font-bold text-white mb-4">
                        <i class="fas fa-shopping-bag text-blue-400 ml-2"></i>
                        وظایف تخصیص‌یافته از سفارشات
                        <span class="text-sm font-normal text-gray-400 mr-2">(${orderTasksCount} وظیفه)</span>
                    </h3>

                    ${
                      myTasks.filter((t) => t.isOrderTask).length === 0
                        ? `
                        <div class="text-center py-6">
                            <i class="fas fa-inbox text-4xl text-gray-500 mb-3"></i>
                            <p class="text-gray-400">هیچ سفارشی به شما تخصیص داده نشده است</p>
                        </div>
                    `
                        : `
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            ${myTasks
                              .filter((t) => t.isOrderTask)
                              .map((task) =>
                                window.getAgentTaskCard(task, currentUser.id),
                              )
                              .join("")}
                        </div>
                    `
                    }
                </div>

                <!-- Other Tasks Section -->
                ${
                  myTasks.filter((t) => !t.isOrderTask).length > 0
                    ? `
                <div class="bg-slate-800 rounded-lg p-4">
                    <h3 class="text-lg font-bold text-white mb-4">
                        <i class="fas fa-list-check text-purple-400 ml-2"></i>
                        سایر وظایف
                        <span class="text-sm font-normal text-gray-400 mr-2">(${myTasks.filter((t) => !t.isOrderTask).length} وظیفه)</span>
                    </h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        ${myTasks
                          .filter((t) => !t.isOrderTask)
                          .map((task) =>
                            window.getAgentTaskCard(task, currentUser.id),
                          )
                          .join("")}
                    </div>
                </div>
                `
                    : ""
                }

                <!-- Direct Orders Section (legacy) -->
                ${
                  myOrders.length > 0
                    ? `
                <div>
                    <h3 class="text-lg font-bold text-white mb-4">
                        <i class="fas fa-layer-group text-indigo-400 ml-2"></i>
                        سفارشات مستقیم
                    </h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        ${myOrders.map((order, index) => window.getAgentOrderCard(order, index)).join("")}
                    </div>
                </div>
                `
                    : ""
                }
            </div>
        `;
  } catch (error) {
    console.error("Error in getMyAgentTasksContent:", error);
    return `<div class="text-red-500">خطا در بارگذاری وظایف: ${error.message}</div>`;
  }
};
// Get agent order card with timer boxes
window.getAgentOrderCard = function (order, index) {
  const now = new Date();
  const deadline = order.deadlineDateTime
    ? new Date(order.deadlineDateTime)
    : null;
  const isExpired = deadline && deadline < now && order.status !== "completed";

  return `
        <div class="bg-slate-800 rounded-lg overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <!-- Card Header -->
            <div class="bg-gradient-to-r from-indigo-600 to-purple-600 p-3">
                <div class="flex items-center justify-between mb-2">
                    <span class="bg-white bg-opacity-20 text-white px-2 py-1 rounded text-xs font-bold">
                        #${index + 1}
                    </span>
                    <span class="px-2 py-1 rounded text-xs font-medium ${
                      order.status === "completed"
                        ? "bg-green-500 text-white"
                        : order.status === "in_progress"
                          ? "bg-blue-500 text-white"
                          : "bg-yellow-500 text-white"
                    }">
                        ${
                          order.status === "completed"
                            ? "تکمیل شده"
                            : order.status === "in_progress"
                              ? "در حال انجام"
                              : "در انتظار"
                        }
                    </span>
                </div>
                <h4 class="text-white font-bold text-base line-clamp-2">${order.title || order.type}</h4>
            </div>

            <!-- Card Body -->
            <div class="p-4">
                <!-- Student Info -->
                <div class="mb-3">
                    <p class="text-gray-400 text-sm flex items-center">
                        <i class="fas fa-user-graduate ml-2 text-indigo-400"></i>
                        ${order.studentName}
                    </p>
                    ${
                      order.description
                        ? `
                        <p class="text-gray-500 text-xs mt-1 line-clamp-2">${order.description}</p>
                    `
                        : ""
                    }
                </div>

                <!-- Timer Boxes -->
                ${
                  deadline
                    ? `
                    <div class="mb-3">
                        <p class="text-xs text-gray-400 mb-2 text-center">
                            ${isExpired ? "زمان تحویل گذشته!" : "زمان باقی‌مانده"}
                        </p>
                        <div class="grid grid-cols-2 gap-2" id="timer-container-${order.id}">
                            <div class="bg-slate-700 rounded-lg p-3 text-center ${isExpired ? "border-2 border-red-500" : ""}">
                                <div class="text-2xl font-bold ${isExpired ? "text-red-400" : "text-blue-400"}" id="timer-days-${order.id}">
                                    --
                                </div>
                                <div class="text-xs text-gray-400 mt-1">روز</div>
                            </div>
                            <div class="bg-slate-700 rounded-lg p-3 text-center ${isExpired ? "border-2 border-red-500" : ""}">
                                <div class="text-2xl font-bold ${isExpired ? "text-red-400" : "text-green-400"}" id="timer-hours-${order.id}">
                                    --
                                </div>
                                <div class="text-xs text-gray-400 mt-1">ساعت</div>
                            </div>
                        </div>
                        <p class="text-xs text-gray-500 mt-2 text-center">
                            <i class="fas fa-calendar ml-1"></i>
                            ${order.deadline ? new Date(order.deadline).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : order.deadline} ${order.deadlineTime ? `- ${order.deadlineTime}` : ""}
                        </p>
                    </div>
                `
                    : `
                    <div class="mb-3 p-3 bg-slate-700 rounded-lg text-center">
                        <p class="text-gray-400 text-sm">
                            <i class="fas fa-calendar ml-1"></i>
                            مهلت تعیین نشده
                        </p>
                    </div>
                `
                }

                <!-- Action Button -->
                <button onclick="viewOrderDetails('${order.id}')"
                        class="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                    <i class="fas fa-eye ml-1"></i>
                    مشاهده جزئیات
                </button>
            </div>
        </div>
    `;
};

// Start timers for all orders
window.startAgentTimers = function () {
  const orders = DataModule.getOrders();
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));

  if (!currentUser) return;

  const myOrders = orders.filter(
    (o) =>
      (o.assignedDoctorId === currentUser.id ||
        o.assigned_doctor === currentUser.id ||
        o.assignedDoctor === currentUser.id) &&
      o.deadlineDateTime,
  );

  myOrders.forEach((order) => {
    window.updateOrderTimer(order.id, order.deadlineDateTime);
  });

  // Update every second
  setInterval(() => {
    myOrders.forEach((order) => {
      window.updateOrderTimer(order.id, order.deadlineDateTime);
    });
  }, 1000);
};

// Update individual order timer with day and hour boxes
window.updateOrderTimer = function (orderId, deadlineDateTime) {
  const daysElement = document.getElementById(`timer-days-${orderId}`);
  const hoursElement = document.getElementById(`timer-hours-${orderId}`);

  if (!daysElement || !hoursElement) {
    console.warn(`Timer elements not found for order ${orderId}`);
    return;
  }

  const now = new Date();
  const deadline = new Date(deadlineDateTime);

  // Check if deadline is valid
  if (isNaN(deadline.getTime())) {
    console.error(`Invalid deadline for order ${orderId}:`, deadlineDateTime);
    daysElement.textContent = "?";
    hoursElement.textContent = "?";
    return;
  }

  const diff = deadline - now;

  if (diff <= 0) {
    daysElement.textContent = "0";
    hoursElement.textContent = "0";
    daysElement.classList.add("text-red-400");
    hoursElement.classList.add("text-red-400");
    return;
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  daysElement.textContent = days;
  hoursElement.textContent = hours;

  // Add warning colors for urgent deadlines
  if (days === 0 && hours < 6) {
    daysElement.classList.remove("text-blue-400");
    daysElement.classList.add("text-red-400");
    hoursElement.classList.remove("text-green-400");
    hoursElement.classList.add("text-red-400");
  } else if (days === 0) {
    daysElement.classList.remove("text-blue-400");
    daysElement.classList.add("text-yellow-400");
    hoursElement.classList.remove("text-green-400");
    hoursElement.classList.add("text-yellow-400");
  }
};

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
    //     return '<div class="text-yellow-500">دسترسی محدود: فقط عامل‌ها</div>';
    // }

    if (!currentUser || !currentUser.id) {
      return '<div class="text-yellow-500">لطفاً وارد سیستم شوید</div>';
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
                        <i class="fas fa-chart-bar text-indigo-400 ml-2"></i>
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
                <div class="bg-slate-800 rounded-lg shadow-md p-4">
                    <h3 class="text-lg font-bold text-white mb-4">
                        <i class="fas fa-list-ul text-indigo-400 ml-2"></i>
                        جزئیات سفارشات و درآمد
                    </h3>

                    ${
                      myOrders.length === 0
                        ? `
                        <div class="text-center py-8">
                            <i class="fas fa-clipboard-list text-4xl text-gray-500 mb-4"></i>
                            <p class="text-gray-400">هنوز سفارشی به شما تخصیص داده نشده است</p>
                        </div>
                    `
                        : `
                        <div class="overflow-x-auto">
                            <table class="w-full">
                                <thead class="bg-slate-700">
                                    <tr>
                                        <th class="px-4 py-3 text-right text-sm font-medium text-gray-300">دانشجو</th>
                                        <th class="px-4 py-3 text-right text-sm font-medium text-gray-300">نوع سفارش</th>
                                        <th class="px-4 py-3 text-right text-sm font-medium text-gray-300">لیست کارها</th>
                                        <th class="px-4 py-3 text-right text-sm font-medium text-gray-300">قیمت هر کار</th>
                                        <th class="px-4 py-3 text-right text-sm font-medium text-gray-300">درآمد من</th>
                                        <th class="px-4 py-3 text-right text-sm font-medium text-gray-300">وضعیت</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-700">
                                    ${myOrders
                                      .map((order) => {
                                        const workList = order.workList || [];
                                        const workPrices =
                                          order.workPrices || {};
                                        const currency =
                                          order.currency || "تومان";

                                        return `
                                            <tr class="hover:bg-slate-700">
                                                <td class="px-4 py-3 text-sm text-white">${order.studentName}</td>
                                                <td class="px-4 py-3 text-sm text-gray-300">${order.type}</td>
                                                <td class="px-4 py-3 text-sm text-gray-300">
                                                    ${
                                                      workList.length === 0
                                                        ? '<span class="text-gray-500">تعیین نشده</span>'
                                                        : `<ul class="list-disc list-inside space-y-1">
                                                            ${workList.map((work) => `<li>${work}</li>`).join("")}
                                                        </ul>`
                                                    }
                                                </td>
                                                <td class="px-4 py-3 text-sm text-gray-300">
                                                    ${
                                                      workList.length === 0
                                                        ? '<span class="text-gray-500">-</span>'
                                                        : `<ul class="space-y-1">
                                                            ${workList
                                                              .map(
                                                                (work) =>
                                                                  `<li class="text-yellow-400">${(workPrices[work] || 0).toLocaleString()} ${currency}</li>`,
                                                              )
                                                              .join("")}
                                                        </ul>`
                                                    }
                                                </td>
                                                <td class="px-4 py-3 text-sm font-bold text-green-400">
                                                    ${(order.doctorShare || 0).toLocaleString()} ${currency}
                                                </td>
                                                <td class="px-4 py-3 text-sm">
                                                    <span class="px-2 py-1 rounded-full text-xs ${
                                                      order.status ===
                                                      "completed"
                                                        ? "bg-green-100 text-green-800"
                                                        : order.status ===
                                                            "in_progress"
                                                          ? "bg-blue-100 text-blue-800"
                                                          : "bg-yellow-100 text-yellow-800"
                                                    }">
                                                        ${
                                                          order.status ===
                                                          "completed"
                                                            ? "تکمیل شده"
                                                            : order.status ===
                                                                "in_progress"
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
    //     return '<div class="text-yellow-500">دسترسی محدود: فقط عامل‌ها</div>';
    // }

    if (!currentUser) {
      return '<div class="text-yellow-500">لطفاً وارد سیستم شوید</div>';
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
