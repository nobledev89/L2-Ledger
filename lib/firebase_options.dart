import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) return web;
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        throw UnsupportedError(
            'Run flutterfire configure to generate Firebase options.');
    }
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyDwHsVqUTIrfsaZFoN7tMufAuWDWzhfW8w',
    appId: '1:75073765141:android:2197b7752b6d273074331c',
    messagingSenderId: '75073765141',
    projectId: 'posd-b2422',
    storageBucket: 'posd-b2422.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyBbhlJgedKUcM7Ukfd3S6KXs9-BsA5mj1U',
    appId: '1:75073765141:ios:b0ad3ed61411c11074331c',
    messagingSenderId: '75073765141',
    projectId: 'posd-b2422',
    storageBucket: 'posd-b2422.firebasestorage.app',
    iosBundleId: 'com.example.stlRiskMonitor',
  );

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'REPLACE_WITH_FLUTTERFIRE_CONFIG',
    appId: 'REPLACE_WITH_FLUTTERFIRE_CONFIG',
    messagingSenderId: 'REPLACE_WITH_FLUTTERFIRE_CONFIG',
    projectId: 'REPLACE_WITH_FLUTTERFIRE_CONFIG',
    authDomain: 'REPLACE_WITH_FLUTTERFIRE_CONFIG',
    storageBucket: 'REPLACE_WITH_FLUTTERFIRE_CONFIG',
  );
}
