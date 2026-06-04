import 'package:cloud_firestore/cloud_firestore.dart';

enum DrawStatus { open, locked, completed }

DrawStatus drawStatusFromString(String value) => DrawStatus.values.firstWhere(
      (status) => status.name == value,
      orElse: () => DrawStatus.locked,
    );

class Draw {
  const Draw({
    required this.drawId,
    required this.gameType,
    required this.drawTime,
    required this.cutoffTime,
    required this.status,
    required this.officialResult,
    required this.defaultPayoutMultiplier,
    required this.createdBy,
  });

  final String drawId;
  final String gameType;
  final DateTime drawTime;
  final DateTime cutoffTime;
  final DrawStatus status;
  final String officialResult;
  final num defaultPayoutMultiplier;
  final String createdBy;

  bool get isOpenNow =>
      status == DrawStatus.open && DateTime.now().isBefore(cutoffTime);

  factory Draw.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return Draw(
      drawId: doc.id,
      gameType: data['gameType'] as String? ?? 'STL 2D',
      drawTime: (data['drawTime'] as Timestamp?)?.toDate() ?? DateTime.now(),
      cutoffTime:
          (data['cutoffTime'] as Timestamp?)?.toDate() ?? DateTime.now(),
      status: drawStatusFromString(data['status'] as String? ?? 'locked'),
      officialResult: data['officialResult'] as String? ?? '',
      defaultPayoutMultiplier: data['defaultPayoutMultiplier'] as num? ?? 400,
      createdBy: data['createdBy'] as String? ?? '',
    );
  }

  Map<String, dynamic> toFirestore() => {
        'gameType': gameType,
        'drawTime': Timestamp.fromDate(drawTime),
        'cutoffTime': Timestamp.fromDate(cutoffTime),
        'status': status.name,
        'officialResult': officialResult,
        'defaultPayoutMultiplier': defaultPayoutMultiplier,
        'createdBy': createdBy,
        'updatedAt': FieldValue.serverTimestamp(),
      };
}
