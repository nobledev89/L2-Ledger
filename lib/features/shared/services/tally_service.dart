import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';

import '../models/risk_config.dart';
import '../models/tally.dart';

class TallyService {
  TallyService(this._db, this._functions);

  final FirebaseFirestore _db;
  final FirebaseFunctions _functions;

  Stream<List<Tally>> watchTallies(String drawId) {
    return _db
        .collection('drawTallies')
        .doc(drawId)
        .collection('numbers')
        .snapshots()
        .map((snap) {
      final byNumber = {
        for (final doc in snap.docs) doc.id: Tally.fromFirestore(doc)
      };
      return List.generate(100, (i) => i.toString().padLeft(2, '0'))
          .map((number) => byNumber[number] ?? Tally.empty(number))
          .toList();
    });
  }

  Future<void> setRiskConfig({
    required String drawId,
    required RiskConfig config,
    required String updatedBy,
  }) {
    return _functions.httpsCallable('setRiskConfig').call({
      'drawId': drawId,
      'number': config.number,
      'riskLimit': config.riskLimit,
      'warningThresholdPercent': config.warningThresholdPercent,
      'orangeThresholdPercent': config.orangeThresholdPercent,
      'blockThresholdPercent': config.blockThresholdPercent,
      'manuallyBlocked': config.manuallyBlocked,
    }).then((_) {});
  }

  Stream<RiskConfig> watchRiskConfig(String drawId, String number) {
    return _db
        .collection('riskConfigs')
        .doc(drawId)
        .collection('numbers')
        .doc(number)
        .snapshots()
        .map((doc) => doc.exists
            ? RiskConfig.fromFirestore(doc)
            : RiskConfig.defaults(number));
  }
}
