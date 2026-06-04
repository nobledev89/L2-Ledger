import 'package:cloud_firestore/cloud_firestore.dart';

enum BetStatus { accepted, pendingApproval, rejected, voidRequested, voided }

BetStatus betStatusFromString(String value) => BetStatus.values.firstWhere(
      (status) => status.name == value,
      orElse: () => BetStatus.accepted,
    );

class Bet {
  const Bet({
    required this.betId,
    required this.drawId,
    required this.agentId,
    required this.branchId,
    required this.gameType,
    required this.number,
    required this.amount,
    required this.payoutMultiplier,
    required this.exposure,
    required this.status,
    required this.customerRef,
    this.createdAt,
    this.updatedAt,
    this.approvedBy,
    this.approvedAt,
    this.voidReason,
  });

  final String betId;
  final String drawId;
  final String agentId;
  final String branchId;
  final String gameType;
  final String number;
  final num amount;
  final num payoutMultiplier;
  final num exposure;
  final BetStatus status;
  final String customerRef;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final String? approvedBy;
  final DateTime? approvedAt;
  final String? voidReason;

  factory Bet.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return Bet(
      betId: data['betId'] as String? ?? doc.id,
      drawId: data['drawId'] as String? ?? '',
      agentId: data['agentId'] as String? ?? '',
      branchId: data['branchId'] as String? ?? '',
      gameType: data['gameType'] as String? ?? 'STL 2D',
      number: data['number'] as String? ?? '',
      amount: data['amount'] as num? ?? 0,
      payoutMultiplier: data['payoutMultiplier'] as num? ?? 400,
      exposure: data['exposure'] as num? ?? 0,
      status: betStatusFromString(data['status'] as String? ?? 'accepted'),
      customerRef: data['customerRef'] as String? ?? '',
      createdAt: (data['createdAt'] as Timestamp?)?.toDate(),
      updatedAt: (data['updatedAt'] as Timestamp?)?.toDate(),
      approvedBy: data['approvedBy'] as String?,
      approvedAt: (data['approvedAt'] as Timestamp?)?.toDate(),
      voidReason: data['voidReason'] as String?,
    );
  }

  Map<String, dynamic> toFirestore() => {
        'betId': betId,
        'drawId': drawId,
        'agentId': agentId,
        'branchId': branchId,
        'gameType': gameType,
        'number': number,
        'amount': amount,
        'payoutMultiplier': payoutMultiplier,
        'exposure': exposure,
        'status': status.name,
        'customerRef': customerRef,
        'updatedAt': FieldValue.serverTimestamp(),
        'approvedBy': approvedBy,
        'voidReason': voidReason,
      };
}
