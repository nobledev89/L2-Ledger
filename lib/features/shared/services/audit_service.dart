import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:uuid/uuid.dart';

class AuditService {
  AuditService(this._db);

  final FirebaseFirestore _db;

  Future<void> log({
    required String actorId,
    required String actorRole,
    required String action,
    required String entityType,
    required String entityId,
    Map<String, dynamic>? before,
    Map<String, dynamic>? after,
    String reason = '',
  }) {
    final id = const Uuid().v4();
    return _db.collection('auditLogs').doc(id).set({
      'actorId': actorId,
      'actorRole': actorRole,
      'action': action,
      'entityType': entityType,
      'entityId': entityId,
      'before': before ?? {},
      'after': after ?? {},
      'reason': reason,
      'createdAt': FieldValue.serverTimestamp(),
    });
  }
}
