import 'dart:io';
import 'package:flutter/material.dart';
import 'package:receive_sharing_intent/receive_sharing_intent.dart';
import 'package:share_plus/share_plus.dart';
import 'package:file_picker/file_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:dio/dio.dart';
import 'package:permission_handler/permission_handler.dart';

class FileSharingHandler {
  Function(String)? _onFileReceived;

  void init(Function(String) onFileReceived) {
    _onFileReceived = onFileReceived;
    _listenToIncomingShares();
  }

  // گوش دادن به فایل‌های دریافتی از تلگرام و...
  void _listenToIncomingShares() {
    // فایل‌های دریافتی وقتی اپ بسته است
    ReceiveSharingIntent.getInitialMedia().then((List<SharedMediaFile> value) {
      if (value.isNotEmpty) {
        _handleSharedFiles(value);
      }
    });

    // فایل‌های دریافتی وقتی اپ باز است
    ReceiveSharingIntent.getMediaStream().listen((List<SharedMediaFile> value) {
      _handleSharedFiles(value);
    });

    // متن دریافتی
    ReceiveSharingIntent.getTextStream().listen((String value) {
      debugPrint('Received text: $value');
    });
  }

  void _handleSharedFiles(List<SharedMediaFile> files) {
    for (var file in files) {
      if (file.path.isNotEmpty) {
        _onFileReceived?.call(file.path);
      }
    }
  }

  // آپلود فایل به سرور
  Future<bool> uploadFile(String filePath, String serverUrl) async {
    try {
      final file = File(filePath);
      if (!await file.exists()) return false;

      final dio = Dio();
      final fileName = file.path.split('/').last;

      FormData formData = FormData.fromMap({
        'file': await MultipartFile.fromFile(file.path, filename: fileName),
        'category': 'shared', // دسته‌بندی پیش‌فرض
      });

      final response = await dio.post(
        '$serverUrl/api/files/upload/', // آدرس API آپلود
        data: formData,
        options: Options(
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        ),
      );

      return response.statusCode == 200 || response.statusCode == 201;
    } catch (e) {
      debugPrint('Upload error: $e');
      return false;
    }
  }

  // اشتراک‌گذاری فایل با تلگرام
  Future<void> shareFile(String fileUrl) async {
    try {
      // دانلود فایل از سرور
      final file = await _downloadFileFromUrl(fileUrl);
      if (file != null) {
        await Share.shareXFiles([XFile(file.path)]);
      }
    } catch (e) {
      debugPrint('Share error: $e');
    }
  }

  // دانلود فایل
  Future<void> downloadFile(String fileUrl) async {
    try {
      // درخواست مجوز
      if (await Permission.storage.request().isGranted) {
        final file = await _downloadFileFromUrl(fileUrl);
        if (file != null) {
          debugPrint('File downloaded: ${file.path}');
        }
      }
    } catch (e) {
      debugPrint('Download error: $e');
    }
  }

  // دانلود فایل از URL
  Future<File?> _downloadFileFromUrl(String url) async {
    try {
      final dio = Dio();
      final fileName = url.split('/').last;
      final dir = await getTemporaryDirectory();
      final filePath = '${dir.path}/$fileName';

      await dio.download(url, filePath);
      return File(filePath);
    } catch (e) {
      debugPrint('Download from URL error: $e');
      return null;
    }
  }

  // انتخاب فایل از گوشی
  Future<String?> pickFile() async {
    try {
      FilePickerResult? result = await FilePicker.platform.pickFiles();
      if (result != null) {
        return result.files.single.path;
      }
    } catch (e) {
      debugPrint('Pick file error: $e');
    }
    return null;
  }
}
