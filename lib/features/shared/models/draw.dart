import 'package:cloud_firestore/cloud_firestore.dart';

enum DrawStatus { open, locked, completed }

DrawStatus drawStatusFromString(String value) => DrawStatus.values.firstWhere(
      (status) => status.name == value,
      orElse: () => DrawStatus.locked,
    );

class Draw {
  const Draw({
    required this.drawId,
    required this.operatorId,
    required this.drawDate,
    required this.drawSlot,
    required this.drawTime,
    required this.cutoffTime,
    required this.status,
    required this.winningNumber,
    required this.blockedNumbers,
    required this.payoutMultiplier,
  });

  final String drawId;
  final String operatorId;
  final String drawDate;
  final String drawSlot;
  final DateTime drawTime;
  final DateTime cutoffTime;
  final DrawStatus status;
  final String winningNumber;
  final List<String> blockedNumbers;
  final num payoutMultiplier;

  String get gameType => 'STL 2D';
  String get officialResult => winningNumber;
  num get defaultPayoutMultiplier => payoutMultiplier;

  bool get isOpenNow =>
      status == DrawStatus.open && DateTime.now().isBefore(cutoffTime);

  factory Draw.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return Draw(
      drawId: data['drawId'] as String? ?? doc.id,
      operatorId: data['operatorId'] as String? ?? '',
      drawDate: data['drawDate'] as String? ?? '',
      drawSlot: data['drawSlot'] as String? ?? '',
      drawTime: (data['drawTime'] as Timestamp?)?.toDate() ?? DateTime.now(),
      cutoffTime:
          (data['cutoffTime'] as Timestamp?)?.toDate() ?? DateTime.now(),
      status: drawStatusFromString(data['status'] as String? ?? 'locked'),
      winningNumber: data['winningNumber'] as String? ?? '',
      blockedNumbers: (data['blockedNumbers'] as List<dynamic>? ?? [])
          .map((item) => '$item')
          .toList(),
      payoutMultiplier: data['payoutMultiplier'] as num? ??
          data['defaultPayoutMultiplier'] as num? ??
          400,
    );
  }
}
