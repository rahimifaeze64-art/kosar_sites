import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

// ───────────────────────────────────────────────
class _NavItem {
  final String page;
  final IconData icon;
  final String label;
  final List<String> roles;
  const _NavItem(this.page, this.icon, this.label, {this.roles = const []});
}

// ── صفحات هر نقش ──────────────────────────────
const List<_NavItem> _managerPages = [
  _NavItem('dashboard',    Icons.dashboard_rounded,              'داشبورد'),
  _NavItem('students',     Icons.school_rounded,                 'دانشجویان'),
  _NavItem('tasks',        Icons.task_alt_rounded,               'کارمندان'),
  _NavItem('managementChat', Icons.forum_rounded,                'گفتگو'),
  _NavItem('workChecklist',Icons.fact_check_rounded,             'چک‌لیست'),
  _NavItem('accounting',   Icons.calculate_rounded,              'حسابداری'),
  _NavItem('embassy',      Icons.account_balance_rounded,        'سفارت'),
  _NavItem('orders',       Icons.list_alt_rounded,               'سفارشات'),
  _NavItem('companyDoor',  Icons.door_front_door_rounded,        'در شرکت'),
  _NavItem('whatsapp',     Icons.message_rounded,                'واتساپ'),
  _NavItem('users',        Icons.manage_accounts_rounded,        'کاربران'),
  _NavItem('personalNotes',Icons.sticky_note_2_rounded,          'یادداشت'),
  _NavItem('profile',      Icons.settings_rounded,               'تنظیمات'),
];

const List<_NavItem> _employeePages = [
  _NavItem('dashboard',    Icons.dashboard_rounded,              'داشبورد'),
  _NavItem('students',     Icons.school_rounded,                 'دانشجویان'),
  _NavItem('myTasks',      Icons.checklist_rounded,              'وظایف من'),
  _NavItem('managementChat', Icons.forum_rounded,                'گفتگو'),
  _NavItem('workHours',    Icons.access_time_rounded,            'ساعت کاری'),
  _NavItem('workChecklist',Icons.fact_check_rounded,             'چک‌لیست'),
  _NavItem('embassy',      Icons.account_balance_rounded,        'سفارت'),
  _NavItem('orders',       Icons.list_alt_rounded,               'سفارشات'),
  _NavItem('companyDoor',  Icons.door_front_door_rounded,        'در شرکت'),
  _NavItem('personalNotes',Icons.sticky_note_2_rounded,          'یادداشت'),
  _NavItem('profile',      Icons.settings_rounded,               'تنظیمات'),
];

const List<_NavItem> _agentPages = [
  _NavItem('dashboard',       Icons.dashboard_rounded,           'داشبورد'),
  _NavItem('agentTasks',      Icons.assignment_rounded,          'وظایف من'),
  _NavItem('agentAccounting', Icons.account_balance_wallet_rounded, 'حسابداری'),
  _NavItem('personalNotes',   Icons.sticky_note_2_rounded,       'یادداشت'),
  _NavItem('profile',         Icons.settings_rounded,            'تنظیمات'),
];

// صفحات پیش‌فرض قبل از login
const List<_NavItem> _defaultPages = [
  _NavItem('dashboard',    Icons.dashboard_rounded,              'داشبورد'),
];

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
  bool   _isLoading   = true;
  bool   _hasError    = false;
  String _currentPage = 'dashboard';
  String _userRole    = '';

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
      ..addJavaScriptChannel(
        'FlutterBridge',
        onMessageReceived: (JavaScriptMessage msg) {
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

  Future<void> _injectBridge() async {
    const js = r"""
      (function() {
        function tryWatch() {
          var el = document.querySelector('[x-data]');
          if (!el || typeof Alpine === 'undefined') { setTimeout(tryWatch, 600); return; }
          try {
            var data = Alpine.$data(el);
            if (!data) { setTimeout(tryWatch, 600); return; }
            if (data.currentUser && data.currentUser.role)
              FlutterBridge.postMessage('role:' + data.currentUser.role);
            if (data.currentPage)
              FlutterBridge.postMessage('page:' + data.currentPage);
            Alpine.effect(function() {
              if (data.currentPage)
                FlutterBridge.postMessage('page:' + data.currentPage);
              if (data.currentUser && data.currentUser.role)
                FlutterBridge.postMessage('role:' + data.currentUser.role);
            });
          } catch(e) { setTimeout(tryWatch, 600); }
        }
        tryWatch();
      })();
    """;
    await _controller.runJavaScript(js);
  }

  void _goToPage(String page) {
    if (_currentPage == page) return;
    setState(() => _currentPage = page);
    _controller.runJavaScript("""
      (function(){
        var el = document.querySelector('[x-data]');
        if(el && typeof Alpine !== 'undefined'){
          try{ Alpine.\$data(el).currentPage = '$page'; }catch(e){}
        }
      })();
    """);
  }

  void _reload() {
    setState(() { _hasError = false; _isLoading = true; });
    _controller.loadRequest(Uri.parse(_webAppUrl));
  }

  List<_NavItem> get _pages {
    switch (_userRole) {
      case 'manager':  return _managerPages;
      case 'employee': return _employeePages;
      case 'agent':    return _agentPages;
      default:         return _defaultPages;
    }
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
    final pages = _pages;

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
          child: pages.length <= 5
              // ── ۵ صفحه یا کمتر: تقسیم مساوی ─────────────
              ? Row(
                  children: pages.map((item) {
                    final isActive = _currentPage == item.page;
                    return Expanded(
                      child: _NavBtn(
                        icon: item.icon,
                        label: item.label,
                        isActive: isActive,
                        onTap: () => _goToPage(item.page),
                      ),
                    );
                  }).toList(),
                )
              // ── بیشتر از ۵ صفحه: اسکرول افقی ────────────
              : ListView.builder(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  itemCount: pages.length,
                  itemBuilder: (_, i) {
                    final item = pages[i];
                    final isActive = _currentPage == item.page;
                    return SizedBox(
                      width: 72,
                      child: _NavBtn(
                        icon: item.icon,
                        label: item.label,
                        isActive: isActive,
                        onTap: () => _goToPage(item.page),
                      ),
                    );
                  },
                ),
        ),
      ),
    );
  }
}

// ── دکمه navbar ──────────────────────────────────────────────
class _NavBtn extends StatelessWidget {
  final IconData icon;
  final String   label;
  final bool     isActive;
  final VoidCallback onTap;

  const _NavBtn({
    required this.icon,
    required this.label,
    required this.isActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        decoration: BoxDecoration(
          color: isActive
              ? Colors.white.withOpacity(0.18)
              : Colors.transparent,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon,
                color: isActive ? Colors.white : Colors.white54,
                size: isActive ? 24 : 20),
            const SizedBox(height: 3),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: isActive ? Colors.white : Colors.white54,
                fontSize: 9.5,
                fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
              ),
            ),
            if (isActive)
              Container(
                margin: const EdgeInsets.only(top: 2),
                width: 18, height: 3,
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
