import 'package:cloud_firestore/cloud_firestore.dart';

class RiskConfig {
  const RiskConfig({
    required this.number,
    required this.riskLimit,
    required this.warningThresholdPercent,
    required this.orangeThresholdPercent,
    required this.blockThresholdPercent,
    required this.manuallyBlocked,
  });

  final String number;
  final num riskLimit;
  final int warningThresholdPercent;
  final int orangeThresholdPercent;
  final int blockThresholdPercent;
  final bool manuallyBlocked;

  factory RiskConfig.defaults(String number) => RiskConfig(
        number: number,
        riskLimit: 100000,
        warningThresholdPercent: 60,
        orangeThresholdPercent: 85,
        blockThresholdPercent: 100,
        manuallyBlocked: false,
      );

  factory RiskConfig.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return RiskConfig(
      number: data['number'] as String? ?? doc.id,
      riskLimit: data['riskLimit'] as num? ?? 100000,
      warningThresholdPercent: data['warningThresholdPercent'] as int? ?? 60,
      orangeThresholdPercent: data['orangeThresholdPercent'] as int? ?? 85,
      blockThresholdPercent: data['blockThresholdPercent'] as int? ?? 100,
      manuallyBlocked: data['manuallyBlocked'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toFirestore(String updatedBy) => {
        'number': number,
        'riskLimit': riskLimit,
        'warningThresholdPercent': warningThresholdPercent,
        'orangeThresholdPercent': orangeThresholdPercent,
        'blockThresholdPercent': blockThresholdPercent,
        'manuallyBlocked': manuallyBlocked,
        'updatedBy': updatedBy,
        'updatedAt': FieldValue.serverTimestamp(),
      };
}
