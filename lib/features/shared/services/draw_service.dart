import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';

import '../models/draw.dart';

class DrawService {
  DrawService(this._db, this._functions);

  final FirebaseFirestore _db;
  final FirebaseFunctions _functions;

  Stream<List<Draw>> watchOpenDraws({String? operatorId}) {
    Query<Map<String, dynamic>> query = _db
        .collection('draws')
        .where('status', whereIn: ['open', 'locked']);
    if (operatorId != null && operatorId.isNotEmpty) {
      query = query.where('operatorId', isEqualTo: operatorId);
    }
    return query
        .orderBy('drawTime')
        .snapshots()
        .map((snap) => snap.docs.map(Draw.fromFirestore).toList());
  }

  Stream<List<Draw>> watchAllDraws({String? operatorId}) {
    Query<Map<String, dynamic>> query = _db.collection('draws');
    if (operatorId != null && operatorId.isNotEmpty) {
      query = query.where('operatorId', isEqualTo: operatorId);
    }
    return query
        .orderBy('drawTime', descending: true)
        .snapshots()
        .map((snap) => snap.docs.map(Draw.fromFirestore).toList());
  }

  Future<List<String>> createFixedDraws({
    required String? operatorId,
    required String drawDate,
    required num payoutMultiplier,
  }) async {
    final result =
        await _functions.httpsCallable('createFixedDrawsForDate').call({
      if (operatorId != null && operatorId.isNotEmpty) 'operatorId': operatorId,
      'drawDate': drawDate,
      'cutoffMinutesBefore': {'2pm': 15, '5pm': 15, '9pm': 15},
      'payoutMultiplier': payoutMultiplier,
    });
    final data = Map<String, dynamic>.from(result.data as Map);
    return (data['drawIds'] as List<dynamic>).map((item) => '$item').toList();
  }

  Future<void> updateConfig(Draw draw, DrawStatus status) {
    return _functions.httpsCallable('updateDrawConfig').call({
      'drawId': draw.drawId,
      'cutoffTimeMillis': draw.cutoffTime.millisecondsSinceEpoch,
      'payoutMultiplier': draw.payoutMultiplier,
      'status': status.name,
    }).then((_) {});
  }

  Future<void> enterWinningNumber(String drawId, String winningNumber) {
    return _functions.httpsCallable('enterWinningNumber').call({
      'drawId': drawId,
      'winningNumber': winningNumber,
    }).then((_) {});
  }
}
