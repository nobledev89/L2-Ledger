import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/draw.dart';
import '../services/draw_service.dart';
import 'auth_provider.dart';

final drawServiceProvider = Provider<DrawService>((ref) =>
    DrawService(ref.watch(firestoreProvider), ref.watch(functionsProvider)));

final drawsProvider = StreamProvider<List<Draw>>(
  (ref) {
    final user = ref.watch(appUserProvider).valueOrNull;
    return ref.watch(drawServiceProvider).watchAllDraws(
          operatorId: user?.isSuperAdmin == true ? null : user?.operatorId,
        );
  },
);

final openDrawsProvider = StreamProvider<List<Draw>>(
  (ref) {
    final user = ref.watch(appUserProvider).valueOrNull;
    return ref.watch(drawServiceProvider).watchOpenDraws(
          operatorId: user?.isSuperAdmin == true ? null : user?.operatorId,
        );
  },
);

final selectedDrawIdProvider = StateProvider<String?>((_) => null);

final selectedDrawProvider = Provider<Draw?>((ref) {
  final draws = ref.watch(openDrawsProvider).valueOrNull ??
      ref.watch(drawsProvider).valueOrNull ??
      [];
  final selectedId = ref.watch(selectedDrawIdProvider);
  if (draws.isEmpty) return null;
  return draws.firstWhere((draw) => draw.drawId == selectedId,
      orElse: () => draws.first);
});
