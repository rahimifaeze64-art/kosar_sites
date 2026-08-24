import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

class WebViewScreen extends StatefulWidget {
  const WebViewScreen({super.key});

  @override
  State<WebViewScreen> createState() => _WebViewScreenState();
}

class _WebViewScreenState extends State<WebViewScreen> {
  late final WebViewController _controller;
  bool _isLoading = true;
  bool _hasMainError = false;

  // ← آدرس صفحه لاگین سایت خود را اینجا وارد کنید
  static const String webAppUrl = 'http://alkawthar.info/login.html';

  @override
  void initState() {
    super.initState();
    _initWebView();
  }

  void _initWebView() {
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.white)
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (int progress) {
            if (mounted) setState(() => _isLoading = progress < 100);
          },
          onPageStarted: (_) {
            if (mounted) setState(() => _hasMainError = false);
          },
          onPageFinished: (_) {
            if (mounted) setState(() => _isLoading = false);
          },
          onWebResourceError: (WebResourceError error) {
            // فقط خطای صفحه اصلی رو نشون بده، نه خطای resource های فرعی
            if (error.isForMainFrame == true && mounted) {
              setState(() {
                _isLoading = false;
                _hasMainError = true;
              });
            }
          },
          // اجازه navigation به همه URLهای داخل سایت
          onNavigationRequest: (NavigationRequest request) {
            return NavigationDecision.navigate;
          },
        ),
      )
      ..loadRequest(Uri.parse(webAppUrl));
  }

  void _reload() {
    setState(() {
      _hasMainError = false;
      _isLoading = true;
    });
    _controller.loadRequest(Uri.parse(webAppUrl));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // WebView همیشه در پس‌زمینه باشه
          WebViewWidget(controller: _controller),

          // صفحه خطا — روی WebView قرار می‌گیره
          if (_hasMainError)
            Container(
              color: Colors.white,
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(32.0),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.wifi_off, size: 64, color: Colors.grey),
                      const SizedBox(height: 16),
                      const Text(
                        'اتصال برقرار نشد',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'اینترنت خود را بررسی کنید و دوباره تلاش کنید.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.grey),
                      ),
                      const SizedBox(height: 24),
                      ElevatedButton.icon(
                        onPressed: _reload,
                        icon: const Icon(Icons.refresh),
                        label: const Text('تلاش مجدد'),
                      ),
                    ],
                  ),
                ),
              ),
            ),

          // نوار بارگذاری در بالای صفحه
          if (_isLoading && !_hasMainError)
            const Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: LinearProgressIndicator(),
            ),
        ],
      ),
    );
  }
}
