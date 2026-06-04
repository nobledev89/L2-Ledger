import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/bet.dart';
import '../services/bet_service.dart';
import 'auth_provider.dart';

final betServiceProvider = Provider<BetService>((ref) =>
    BetService(ref.watch(firestoreProvider), ref.watch(functionsProvider)));

final agentBetsProvider =
    StreamProvider.family<List<Bet>, ({String agentId, String drawId})>(
  (ref, args) =>
      ref.watch(betServiceProvider).watchAgentBets(args.agentId, args.drawId),
);

final recentBetsProvider = StreamProvider.family<List<Bet>, String>(
  (ref, drawId) => ref.watch(betServiceProvider).watchRecentBets(drawId),
);

final acceptedBetsProvider = StreamProvider.family<List<Bet>, String>(
  (ref, drawId) => ref.watch(betServiceProvider).watchAcceptedBets(drawId),
);

final pendingApprovalsProvider = StreamProvider.family<List<Bet>, String>(
  (ref, drawId) => ref.watch(betServiceProvider).watchPendingApprovals(drawId),
);

final numberBetsProvider =
    StreamProvider.family<List<Bet>, ({String drawId, String number})>(
  (ref, args) =>
      ref.watch(betServiceProvider).watchNumberBets(args.drawId, args.number),
);
