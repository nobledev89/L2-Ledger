import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/risk_config.dart';
import '../models/tally.dart';
import '../services/tally_service.dart';
import 'auth_provider.dart';

final tallyServiceProvider = Provider<TallyService>((ref) =>
    TallyService(ref.watch(firestoreProvider), ref.watch(functionsProvider)));

final talliesProvider = StreamProvider.family<List<Tally>, String>(
  (ref, drawId) => ref.watch(tallyServiceProvider).watchTallies(drawId),
);

final riskConfigProvider =
    StreamProvider.family<RiskConfig, ({String drawId, String number})>(
  (ref, args) =>
      ref.watch(tallyServiceProvider).watchRiskConfig(args.drawId, args.number),
);
