import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/app_user.dart';

class FirestoreService {
  FirestoreService(this.db);

  final FirebaseFirestore db;

  Stream<AppUser?> userProfile(String uid) {
    return db.collection('users').doc(uid).snapshots().map((doc) {
      if (!doc.exists) return null;
      return AppUser.fromFirestore(doc);
    });
  }
}
