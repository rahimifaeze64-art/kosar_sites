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

  // ← آدرس صفحه لاگین سایت خود را اینجا وارد کنید
  static const String webAppUrl = 'https://kosar.bpservice.ir/login';

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
            if (mounted) {
              setState(() => _isLoading = progress < 100);
            }
          },
          onPageFinished: (_) {
            if (mounted) setState(() => _isLoading = false);
          },
          onWebResourceError: (WebResourceError error) {
            if (mounted) _showErrorDialog();
          },
        ),
      )
      ..loadRequest(Uri.parse(webAppUrl));
  }

  void _showErrorDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('خطا'),
        content: const Text('اتصال به سرور برقرار نشد.\nاینترنت خود را بررسی کنید.'),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              _controller.reload();
            },
            child: const Text('تلاش مجدد'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // WebView تمام صفحه
          WebViewWidget(controller: _controller),

          // نوار بارگذاری در بالای صفحه
          if (_isLoading)
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
