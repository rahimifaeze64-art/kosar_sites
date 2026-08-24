import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

// ───────────────────────────────────────────────
// مدل آیتم navigation
// ───────────────────────────────────────────────
class _NavItem {
  final String page;
  final IconData icon;
  final String label;
  final List<String> roles; // نقش‌هایی که این آیتم رو می‌بینن (خالی = همه)
  const _NavItem(this.page, this.icon, this.label, {this.roles = const []});
}

// ── همه صفحات اپ ──────────────────────────────────────────────
const List<_NavItem> _allPages = [
  _NavItem('dashboard',            Icons.dashboard_rounded,         'داشبورد'),
  _NavItem('students',             Icons.school_rounded,            'دانشجویان',   roles: ['manager','employee']),
  _NavItem('tasks',                Icons.task_alt_rounded,          'وظایف',       roles: ['manager']),
  _NavItem('myTasks',              Icons.checklist_rounded,         'وظایف من',    roles: ['employee']),
  _NavItem('agentTasksManagement', Icons.manage_accounts_rounded,   'مدیر عامل',   roles: ['employee']),
  _NavItem('agentTasks',           Icons.assignment_rounded,        'وظایف من',    roles: ['agent']),
  _NavItem('agentAccounting',      Icons.account_balance_wallet_rounded,'حسابداری', roles: ['agent']),
  _NavItem('personalChat',         Icons.chat_bubble_rounded,       'گفتگو'),
  _NavItem('managementChat',       Icons.forum_rounded,             'چت مدیریت',   roles: ['manager','employee']),
  _NavItem('personalNotes',        Icons.sticky_note_2_rounded,     'یادداشت'),
  _NavItem('workHours',            Icons.access_time_rounded,       'ساعت کاری',   roles: ['employee']),
  _NavItem('workChecklist',        Icons.fact_check_rounded,        'چک‌لیست',     roles: ['manager','employee']),
  _NavItem('accounting',           Icons.calculate_rounded,         'حسابداری',    roles: ['manager']),
  _NavItem('empAccView',           Icons.receipt_long_rounded,      'حسابداری',    roles: ['employee']),
  _NavItem('embassy',              Icons.account_balance_rounded,   'سفارت',       roles: ['manager','employee']),
  _NavItem('orders',               Icons.list_alt_rounded,          'سفارشات',     roles: ['manager','employee']),
  _NavItem('companyDoor',          Icons.door_front_door_rounded,   'در شرکت',     roles: ['manager','employee']),
  _NavItem('whatsapp',             Icons.message_rounded,           'واتساپ',      roles: ['manager']),
  _NavItem('users',                Icons.manage_accounts_rounded,   'کاربران',     roles: ['manager']),
];

// ── ۴ آیتم ثابت در navbar (بر اساس نقش انتخاب می‌شه) ──────────
Map<String, List<String>> _pinnedByRole = {
  'manager':  ['dashboard', 'students',  'tasks',   'personalChat'],
  'employee': ['dashboard', 'students',  'myTasks', 'personalChat'],
  'agent':    ['dashboard', 'agentTasks','agentAccounting', 'personalChat'],
  '':         ['dashboard', 'personalChat', 'personalNotes', 'students'],
};

// ───────────────────────────────────────────────
class WebViewScreen extends StatefulWidget {
  const WebViewScreen({super.key});
  @override
  State<WebViewScreen> createState() => _WebViewScreenState();
}

class _WebViewScreenState extends State<WebViewScreen>
    with AutomaticKeepAliveClientMixin {

  @override
  bool get wantKeepAlive => true;

  late final WebViewController _controller;
  bool   _isLoading    = true;
  bool   _hasError     = false;
  String _currentPage  = 'dashboard';
  String _userRole     = '';   // از وب خوانده می‌شه

  static const String _webAppUrl = 'http://alkawthar.info/login.html';

  @override
  void initState() {
    super.initState();
    _initWebView();
  }

  void _initWebView() {
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.white)
      // ── کانال دریافت پیام از وب ──────────────────────────────
      ..addJavaScriptChannel(
        'FlutterBridge',
        onMessageReceived: (JavaScriptMessage msg) {
          // فرمت: "page:dashboard" یا "role:manager"
          final raw = msg.message;
          if (raw.startsWith('page:')) {
            final pg = raw.substring(5);
            if (mounted) setState(() => _currentPage = pg);
          } else if (raw.startsWith('role:')) {
            final role = raw.substring(5);
            if (mounted) setState(() => _userRole = role);
          }
        },
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (p) {
            if (mounted) setState(() => _isLoading = p < 100);
          },
          onPageStarted: (_) {
            if (mounted) setState(() { _hasError = false; });
          },
          onPageFinished: (_) async {
            if (mounted) setState(() => _isLoading = false);
            await _injectBridge();
          },
          onWebResourceError: (err) {
            if (err.isForMainFrame == true && mounted) {
              setState(() { _isLoading = false; _hasError = true; });
            }
          },
          onNavigationRequest: (_) => NavigationDecision.navigate,
        ),
      )
      ..loadRequest(Uri.parse(_webAppUrl));
  }

  // ── inject watcher روی Alpine ─────────────────────────────────
  Future<void> _injectBridge() async {
    const js = r"""
      (function() {
        function tryWatch() {
          var el = document.querySelector('[x-data]');
          if (!el || typeof Alpine === 'undefined') {
            setTimeout(tryWatch, 600);
            return;
          }
          try {
            var data = Alpine.$data(el);
            if (!data) { setTimeout(tryWatch, 600); return; }

            // ارسال نقش کاربر
            if (data.currentUser && data.currentUser.role) {
              FlutterBridge.postMessage('role:' + data.currentUser.role);
            }
            // ارسال صفحه فعلی
            if (data.currentPage) {
              FlutterBridge.postMessage('page:' + data.currentPage);
            }
            // watch تغییرات
            Alpine.effect(function() {
              if (data.currentPage) FlutterBridge.postMessage('page:' + data.currentPage);
              if (data.currentUser && data.currentUser.role) {
                FlutterBridge.postMessage('role:' + data.currentUser.role);
              }
            });
          } catch(e) {
            setTimeout(tryWatch, 600);
          }
        }
        tryWatch();
      })();
    """;
    await _controller.runJavaScript(js);
  }

  // ── تغییر صفحه از Flutter به وب ──────────────────────────────
  void _goToPage(String page) {
    if (_currentPage == page) return;
    setState(() => _currentPage = page);
    _controller.runJavaScript("""
      (function() {
        var el = document.querySelector('[x-data]');
        if (el && typeof Alpine !== 'undefined') {
          try { Alpine.\$data(el).currentPage = '$page'; } catch(e) {}
        }
      })();
    """);
  }

  void _reload() {
    setState(() { _hasError = false; _isLoading = true; });
    _controller.loadRequest(Uri.parse(_webAppUrl));
  }

  // ── آیتم‌های pinned بر اساس نقش ──────────────────────────────
  List<_NavItem> get _pinnedItems {
    final keys = _pinnedByRole[_userRole] ?? _pinnedByRole['']!;
    return keys
        .map((k) => _allPages.firstWhere((p) => p.page == k,
            orElse: () => _NavItem(k, Icons.circle, k)))
        .toList();
  }

  // ── بقیه صفحات بر اساس نقش ───────────────────────────────────
  List<_NavItem> get _moreItems {
    final pinned = _pinnedItems.map((e) => e.page).toSet();
    return _allPages.where((p) {
      if (pinned.contains(p.page)) return false;
      if (p.roles.isEmpty) return true;
      return _userRole.isEmpty || p.roles.contains(_userRole);
    }).toList();
  }

  // ── باز کردن bottom sheet برای بقیه صفحات ────────────────────
  void _showMoreSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1A237E),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // دستگیره
                Container(
                  width: 40, height: 4,
                  decoration: BoxDecoration(
                    color: Colors.white30,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 12),
                const Text('همه صفحات',
                    style: TextStyle(color: Colors.white70, fontSize: 13)),
                const SizedBox(height: 10),
                Flexible(
                  child: GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 4,
                      mainAxisSpacing: 8,
                      crossAxisSpacing: 8,
                      childAspectRatio: 0.85,
                    ),
                    itemCount: _moreItems.length,
                    itemBuilder: (_, i) {
                      final item = _moreItems[i];
                      final isActive = _currentPage == item.page;
                      return GestureDetector(
                        onTap: () {
                          Navigator.pop(context);
                          _goToPage(item.page);
                        },
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 150),
                          decoration: BoxDecoration(
                            color: isActive
                                ? Colors.white.withOpacity(0.22)
                                : Colors.white.withOpacity(0.07),
                            borderRadius: BorderRadius.circular(12),
                            border: isActive
                                ? Border.all(color: Colors.white54, width: 1.5)
                                : null,
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(item.icon,
                                  color: isActive ? Colors.white : Colors.white60,
                                  size: 26),
                              const SizedBox(height: 5),
                              Text(item.label,
                                  textAlign: TextAlign.center,
                                  maxLines: 2,
                                  style: TextStyle(
                                    color: isActive ? Colors.white : Colors.white60,
                                    fontSize: 10,
                                    fontWeight: isActive
                                        ? FontWeight.bold
                                        : FontWeight.normal,
                                  )),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return Scaffold(
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),

          if (_hasError)
            Container(
              color: Colors.white,
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.wifi_off_rounded, size: 64, color: Colors.grey),
                      const SizedBox(height: 16),
                      const Text('اتصال برقرار نشد',
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      const Text('اینترنت خود را بررسی کنید.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.grey)),
                      const SizedBox(height: 24),
                      ElevatedButton.icon(
                        onPressed: _reload,
                        icon: const Icon(Icons.refresh_rounded),
                        label: const Text('تلاش مجدد'),
                      ),
                    ],
                  ),
                ),
              ),
            ),

          if (_isLoading && !_hasError)
            const Positioned(
              top: 0, left: 0, right: 0,
              child: LinearProgressIndicator(),
            ),
        ],
      ),
      bottomNavigationBar: _buildNavBar(),
    );
  }

  Widget _buildNavBar() {
    final pinned = _pinnedItems;
    final hasMore = _moreItems.isNotEmpty;

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1565C0),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.35),
            blurRadius: 14,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 64,
          child: Row(
            children: [
              // ── آیتم‌های pinned ────────────────────────────────
              ...pinned.map((item) {
                final isActive = _currentPage == item.page;
                return Expanded(
                  child: _NavBarButton(
                    icon: item.icon,
                    label: item.label,
                    isActive: isActive,
                    onTap: () => _goToPage(item.page),
                  ),
                );
              }),

              // ── دکمه «بیشتر» ─────────────────────────────────
              if (hasMore)
                Expanded(
                  child: _NavBarButton(
                    icon: Icons.grid_view_rounded,
                    label: 'بیشتر',
                    isActive: false,
                    onTap: _showMoreSheet,
                    badge: _moreItems.any((e) => e.page == _currentPage),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── دکمه جداگانه برای تمیزتر بودن کد ────────────────────────────
class _NavBarButton extends StatelessWidget {
  final IconData icon;
  final String   label;
  final bool     isActive;
  final bool     badge;
  final VoidCallback onTap;

  const _NavBarButton({
    required this.icon,
    required this.label,
    required this.isActive,
    required this.onTap,
    this.badge = false,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: isActive
              ? Colors.white.withOpacity(0.18)
              : Colors.transparent,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(icon,
                    color: isActive ? Colors.white : Colors.white60,
                    size: isActive ? 26 : 22),
                // نقطه آبی اگر صفحه فعلی در «بیشتر» باشه
                if (badge)
                  Positioned(
                    top: -2, right: -4,
                    child: Container(
                      width: 8, height: 8,
                      decoration: const BoxDecoration(
                        color: Colors.amber,
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 3),
            Text(
              label,
              style: TextStyle(
                color: isActive ? Colors.white : Colors.white60,
                fontSize: 10,
                fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
              ),
            ),
            if (isActive)
              Container(
                margin: const EdgeInsets.only(top: 2),
                width: 20, height: 3,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
