import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';

import '../models/app_user.dart';
import '../models/bet.dart';
import '../models/draw.dart';

class BetSubmissionResult {
  const BetSubmissionResult(
      {required this.betId, required this.status, required this.message});

  final String betId;
  final BetStatus status;
  final String message;
}

class BetService {
  BetService(this._db, this._functions);

  final FirebaseFirestore _db;
  final FirebaseFunctions _functions;

  Stream<List<Bet>> watchAgentBets(String agentId, String drawId,
          {int limit = 50}) =>
      _db
          .collection('bets')
          .where('drawId', isEqualTo: drawId)
          .where('createdBy', isEqualTo: agentId)
          .orderBy('createdAt', descending: true)
          .limit(limit)
          .snapshots()
          .map((snap) => snap.docs.map(Bet.fromFirestore).toList());

  Stream<List<Bet>> watchRecentBets(String drawId, {int limit = 20}) => _db
      .collection('bets')
      .where('drawId', isEqualTo: drawId)
      .where('status',
          whereIn: [BetStatus.accepted.name, BetStatus.edited.name])
      .orderBy('createdAt', descending: true)
      .limit(limit)
      .snapshots()
      .map((snap) => snap.docs.map(Bet.fromFirestore).toList());

  Stream<List<Bet>> watchAcceptedBets(String drawId) => _db
      .collection('bets')
      .where('drawId', isEqualTo: drawId)
      .where('status', isEqualTo: BetStatus.accepted.name)
      .snapshots()
      .map((snap) => snap.docs.map(Bet.fromFirestore).toList());

  Stream<List<Bet>> watchPendingApprovals(String drawId) => _db
      .collection('bets')
      .where('drawId', isEqualTo: drawId)
      .where('status', isEqualTo: BetStatus.rejected.name)
      .orderBy('createdAt', descending: true)
      .snapshots()
      .map((snap) => snap.docs.map(Bet.fromFirestore).toList());

  Stream<List<Bet>> watchNumberBets(String drawId, String number) => _db
      .collection('bets')
      .where('drawId', isEqualTo: drawId)
      .where('number', isEqualTo: number)
      .orderBy('createdAt', descending: true)
      .snapshots()
      .map((snap) => snap.docs.map(Bet.fromFirestore).toList());

  Future<BetSubmissionResult> submitBet({
    required AppUser agent,
    required Draw draw,
    required String number,
    required num amount,
    required String customerRef,
  }) async {
    final result = await _functions.httpsCallable('submitBetSlip').call({
      'drawId': draw.drawId,
      'bettorName': customerRef.isEmpty ? 'Walk-in' : customerRef,
      'lines': [
        {'number': number, 'amount': amount}
      ],
    });
    final data = Map<String, dynamic>.from(result.data as Map);
    return BetSubmissionResult(
      betId: data['slipId'] as String,
      status: betStatusFromString(data['status'] as String),
      message: data['message'] as String,
    );
  }

  Future<void> requestVoid({
    required Bet bet,
    required AppUser actor,
    required Draw draw,
    required String reason,
  }) {
    return _functions.httpsCallable('cancelBetSlipBeforeCutoff').call({
      'slipId': bet.slipId,
      'reason': reason,
    });
  }

  Future<void> approveBet(Bet bet, AppUser admin) async {
    await _functions.httpsCallable('markBetPaid').call({'betId': bet.betId});
  }

  Future<void> rejectBet(Bet bet, AppUser admin, String reason) {
    return _functions
        .httpsCallable('cancelBetSlipBeforeCutoff')
        .call({'slipId': bet.slipId, 'reason': reason});
  }
}
