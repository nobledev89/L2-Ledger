import 'package:cloud_firestore/cloud_firestore.dart';

class Tally {
  const Tally({
    required this.number,
    required this.totalAmount,
    required this.exposure,
    required this.betCount,
    required this.riskLimit,
    required this.riskStatus,
    required this.blocked,
  });

  final String number;
  final num totalAmount;
  final num exposure;
  final int betCount;
  final num riskLimit;
  final String riskStatus;
  final bool blocked;

  factory Tally.empty(String number) => Tally(
        number: number,
        totalAmount: 0,
        exposure: 0,
        betCount: 0,
        riskLimit: 100000,
        riskStatus: 'green',
        blocked: false,
      );

  factory Tally.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return Tally(
      number: data['number'] as String? ?? doc.id,
      totalAmount: data['totalAmount'] as num? ?? 0,
      exposure:
          (data['potentialPayout'] as num?) ?? (data['exposure'] as num?) ?? 0,
      betCount: data['betCount'] as int? ?? 0,
      riskLimit: data['riskLimit'] as num? ?? 100000,
      riskStatus: data['riskStatus'] as String? ?? 'green',
      blocked: data['blocked'] as bool? ?? false,
    );
  }
}
