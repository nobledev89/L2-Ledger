import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';

import '../models/draw.dart';

class DrawService {
  DrawService(this._db, this._functions);

  final FirebaseFirestore _db;
  final FirebaseFunctions _functions;

  Stream<List<Draw>> watchOpenDraws() => _db
      .collection('draws')
      .where('status', whereIn: ['open', 'locked'])
      .orderBy('drawTime')
      .snapshots()
      .map((snap) => snap.docs.map(Draw.fromFirestore).toList());

  Stream<List<Draw>> watchAllDraws() => _db
      .collection('draws')
      .orderBy('drawTime', descending: true)
      .snapshots()
      .map((snap) => snap.docs.map(Draw.fromFirestore).toList());

  Future<String> createDraw({
    required String gameType,
    required DateTime drawTime,
    required DateTime cutoffTime,
    required num payoutMultiplier,
    required String createdBy,
  }) async {
    final result = await _functions.httpsCallable('createDraw').call({
      'gameType': gameType,
      'drawTimeMillis': drawTime.millisecondsSinceEpoch,
      'cutoffTimeMillis': cutoffTime.millisecondsSinceEpoch,
      'defaultPayoutMultiplier': payoutMultiplier,
    });
    final data = Map<String, dynamic>.from(result.data as Map);
    return data['drawId'] as String;
  }

  Future<void> updateStatus(String drawId, DrawStatus status,
      {String officialResult = ''}) {
    return _functions.httpsCallable('updateDrawStatus').call({
      'drawId': drawId,
      'status': status.name,
      if (officialResult.isNotEmpty) 'officialResult': officialResult,
    }).then((_) {});
  }
}
