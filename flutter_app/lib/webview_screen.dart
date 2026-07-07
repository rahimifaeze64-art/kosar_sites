import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'file_sharing_handler.dart';

class WebViewScreen extends StatefulWidget {
  const WebViewScreen({super.key});

  @override
  State<WebViewScreen> createState() => _WebViewScreenState();
}

class _WebViewScreenState extends State<WebViewScreen> {
  late final WebViewController _controller;
  final FileSharingHandler _fileHandler = FileSharingHandler();
  bool _isLoading = true;
  String _currentUrl = '';

  // دامین نرم‌افزار شما
  // برای تست محلی: 'http://10.0.2.2:8080' (Android Emulator) یا 'http://192.168.1.X:8080' (دستگاه واقعی)
  // برای production: 'http://YOUR_SERVER_IP' یا 'https://your-domain.com'
  static const String webAppUrl = 'http://10.0.2.2:8080'; // تنظیم پیش‌فرض برای Android Emulator

  @override
  void initState() {
    super.initState();
    _initWebView();
    _fileHandler.init(_onFileReceived);
  }

  void _initWebView() {
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0x00000000))
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (int progress) {
            setState(() {
              _isLoading = progress < 100;
            });
          },
          onPageStarted: (String url) {
            setState(() {
              _isLoading = true;
              _currentUrl = url;
            });
          },
          onPageFinished: (String url) {
            setState(() {
              _isLoading = false;
            });
          },
          onWebResourceError: (WebResourceError error) {
            _showError('خطا در بارگذاری صفحه');
          },
        ),
      )
      ..addJavaScriptChannel(
        'FlutterChannel',
        onMessageReceived: (JavaScriptMessage message) {
          _handleJavaScriptMessage(message.message);
        },
      )
      ..loadRequest(Uri.parse(webAppUrl));
  }

  // دریافت فایل از تلگرام یا اپ‌های دیگر
  void _onFileReceived(String filePath) async {
    // آپلود فایل به سرور
    final uploaded = await _fileHandler.uploadFile(filePath, webAppUrl);
    
    if (uploaded) {
      // اطلاع به JavaScript
      _controller.runJavaScript('''
        if (typeof window.onFlutterFileReceived === 'function') {
          window.onFlutterFileReceived('$filePath');
        }
      ''');
      
      _showSnackBar('فایل با موفقیت آپلود شد');
    } else {
      _showSnackBar('خطا در آپلود فایل');
    }
  }

  // دریافت پیام از JavaScript
  void _handleJavaScriptMessage(String message) {
    if (message.startsWith('share:')) {
      final fileUrl = message.substring(6);
      _fileHandler.shareFile(fileUrl);
    } else if (message.startsWith('download:')) {
      final fileUrl = message.substring(9);
      _fileHandler.downloadFile(fileUrl);
    }
  }

  void _showSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  void _showError(String message) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('خطا'),
        content: Text(message),
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
      body: SafeArea(
        child: Stack(
          children: [
            WebViewWidget(controller: _controller),
            
            // نوار بارگذاری
            if (_isLoading)
              const LinearProgressIndicator(),
            
            // دکمه‌های کنترل (اختیاری)
            Positioned(
              bottom: 16,
              left: 16,
              child: Row(
                children: [
                  FloatingActionButton.small(
                    heroTag: 'back',
                    onPressed: () async {
                      if (await _controller.canGoBack()) {
                        _controller.goBack();
                      }
                    },
                    child: const Icon(Icons.arrow_back),
                  ),
                  const SizedBox(width: 8),
                  FloatingActionButton.small(
                    heroTag: 'forward',
                    onPressed: () async {
                      if (await _controller.canGoForward()) {
                        _controller.goForward();
                      }
                    },
                    child: const Icon(Icons.arrow_forward),
                  ),
                  const SizedBox(width: 8),
                  FloatingActionButton.small(
                    heroTag: 'refresh',
                    onPressed: () => _controller.reload(),
                    child: const Icon(Icons.refresh),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
