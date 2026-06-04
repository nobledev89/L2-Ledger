import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants/app_constants.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/shell_scaffold.dart';
import '../shared/models/draw.dart';
import '../shared/providers/auth_provider.dart';
import '../shared/providers/draw_provider.dart';

class DrawManagementScreen extends ConsumerWidget {
  const DrawManagementScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final draws = ref.watch(drawsProvider);
    return ShellScaffold(
      title: 'Draw Management',
      actions: [
        IconButton(
            icon: const Icon(Icons.add),
            onPressed: () => _createDraw(context, ref)),
      ],
      child: draws.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text('$error')),
        data: (items) => ListView(
          children: [
            for (final draw in items)
              ListTile(
                title: Text(
                    '${draw.gameType} ${dateTimeFormat.format(draw.drawTime)}'),
                subtitle:
                    Text('Cutoff ${dateTimeFormat.format(draw.cutoffTime)}'),
                trailing: PopupMenuButton<DrawStatus>(
                  initialValue: draw.status,
                  onSelected: (status) async {
                    var result = '';
                    if (status == DrawStatus.completed) {
                      result = await _resultDialog(context) ?? '';
                    }
                    await ref.read(drawServiceProvider).updateStatus(
                        draw.drawId, status,
                        officialResult: result);
                  },
                  itemBuilder: (_) => const [
                    PopupMenuItem(value: DrawStatus.open, child: Text('Open')),
                    PopupMenuItem(
                        value: DrawStatus.locked, child: Text('Lock')),
                    PopupMenuItem(
                        value: DrawStatus.completed, child: Text('Complete')),
                  ],
                  child: Text(draw.status.name),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _createDraw(BuildContext context, WidgetRef ref) async {
    final actor = ref.read(appUserProvider).valueOrNull;
    if (actor == null) return;
    final now = DateTime.now();
    await ref.read(drawServiceProvider).createDraw(
          gameType: AppConstants.defaultGameType,
          drawTime: now.add(const Duration(hours: 2)),
          cutoffTime: now.add(const Duration(hours: 1, minutes: 45)),
          payoutMultiplier: AppConstants.defaultPayoutMultiplier,
          createdBy: actor.uid,
        );
  }

  Future<String?> _resultDialog(BuildContext context) {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Official result'),
        content: TextField(
            controller: controller,
            maxLength: 2,
            keyboardType: TextInputType.number),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () =>
                  Navigator.pop(context, controller.text.padLeft(2, '0')),
              child: const Text('Complete')),
        ],
      ),
    );
  }
}
