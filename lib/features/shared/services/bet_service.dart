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
          .where('agentId', isEqualTo: agentId)
          .orderBy('createdAt', descending: true)
          .limit(limit)
          .snapshots()
          .map((snap) => snap.docs.map(Bet.fromFirestore).toList());

  Stream<List<Bet>> watchRecentBets(String drawId, {int limit = 20}) => _db
      .collection('bets')
      .where('drawId', isEqualTo: drawId)
      .where('status',
          whereIn: [BetStatus.accepted.name, BetStatus.pendingApproval.name])
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
      .where('status', isEqualTo: BetStatus.pendingApproval.name)
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
    final result = await _functions.httpsCallable('submitBet').call({
      'drawId': draw.drawId,
      'number': number,
      'amount': amount,
      'customerRef': customerRef,
    });
    final data = Map<String, dynamic>.from(result.data as Map);
    return BetSubmissionResult(
      betId: data['betId'] as String,
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
    return _functions.httpsCallable('requestVoid').call({
      'betId': bet.betId,
      'reason': reason,
    });
  }

  Future<void> approveBet(Bet bet, AppUser admin) async {
    await _functions.httpsCallable('approveBet').call({'betId': bet.betId});
  }

  Future<void> rejectBet(Bet bet, AppUser admin, String reason) {
    return _functions.httpsCallable('rejectBet').call({
      'betId': bet.betId,
      'reason': reason,
    });
  }
}
