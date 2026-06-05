import 'package:cloud_firestore/cloud_firestore.dart';

enum BetStatus {
  pendingSync,
  accepted,
  edited,
  cancelled,
  won,
  lost,
  paid,
  rejected
}

BetStatus betStatusFromString(String value) => BetStatus.values.firstWhere(
      (status) => status.name == value,
      orElse: () => BetStatus.accepted,
    );

class Bet {
  const Bet({
    required this.betId,
    required this.slipId,
    required this.referenceCode,
    required this.operatorId,
    required this.usherId,
    required this.createdBy,
    required this.createdByRole,
    required this.bettorName,
    required this.drawId,
    required this.drawDate,
    required this.drawSlot,
    required this.number,
    required this.amount,
    required this.payoutMultiplier,
    required this.potentialPayout,
    required this.status,
    this.createdAt,
    this.updatedAt,
  });

  final String betId;
  final String slipId;
  final String referenceCode;
  final String operatorId;
  final String? usherId;
  final String createdBy;
  final String createdByRole;
  final String bettorName;
  final String drawId;
  final String drawDate;
  final String drawSlot;
  final String number;
  final num amount;
  final num payoutMultiplier;
  final num potentialPayout;
  final BetStatus status;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  String get agentId => createdBy;
  String get branchId => operatorId;
  String get gameType => 'STL 2D';
  String get customerRef => referenceCode;
  num get exposure => potentialPayout;

  factory Bet.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return Bet(
      betId: data['betId'] as String? ?? doc.id,
      slipId: data['slipId'] as String? ?? '',
      referenceCode: data['referenceCode'] as String? ?? '',
      operatorId: data['operatorId'] as String? ?? '',
      usherId: data['usherId'] as String?,
      createdBy: data['createdBy'] as String? ?? '',
      createdByRole: data['createdByRole'] as String? ?? 'usher',
      bettorName: data['bettorName'] as String? ?? '',
      drawId: data['drawId'] as String? ?? '',
      drawDate: data['drawDate'] as String? ?? '',
      drawSlot: data['drawSlot'] as String? ?? '',
      number: data['number'] as String? ?? '',
      amount: data['amount'] as num? ?? 0,
      payoutMultiplier: data['payoutMultiplier'] as num? ?? 400,
      potentialPayout: data['potentialPayout'] as num? ?? 0,
      status: betStatusFromString(data['status'] as String? ?? 'accepted'),
      createdAt: (data['createdAt'] as Timestamp?)?.toDate(),
      updatedAt: (data['updatedAt'] as Timestamp?)?.toDate(),
    );
  }
}
