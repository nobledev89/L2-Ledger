import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/utils/formatters.dart';
import '../../core/widgets/shell_scaffold.dart';
import '../shared/models/risk_config.dart';
import '../shared/models/tally.dart';
import '../shared/providers/auth_provider.dart';
import '../shared/providers/bet_provider.dart';
import '../shared/providers/tally_provider.dart';

class NumberDetailScreen extends ConsumerWidget {
  const NumberDetailScreen(
      {super.key, required this.drawId, required this.number});

  final String drawId;
  final String number;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tallies = ref.watch(talliesProvider(drawId)).valueOrNull ?? [];
    final tally = tallies.firstWhere((item) => item.number == number,
        orElse: () => Tally.empty(number));
    final config = ref
        .watch(riskConfigProvider((drawId: drawId, number: number)))
        .valueOrNull;
    final bets =
        ref.watch(numberBetsProvider((drawId: drawId, number: number)));
    final limit = config?.riskLimit ?? tally.riskLimit;
    return ShellScaffold(
      title: 'Number $number',
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ListTile(
              title: const Text('Total amount'),
              trailing: Text(formatAmount(tally.totalAmount))),
          ListTile(
              title: const Text('Exposure'),
              trailing: Text(formatAmount(tally.exposure))),
          ListTile(
              title: const Text('Limit'), trailing: Text(formatAmount(limit))),
          ListTile(
              title: const Text('Remaining'),
              trailing: Text(formatAmount(limit - tally.exposure))),
          SwitchListTile(
            title: const Text('Blocked for this draw'),
            value: config?.manuallyBlocked ?? tally.blocked,
            onChanged: (value) => _saveConfig(ref, config, value),
          ),
          OutlinedButton.icon(
            icon: const Icon(Icons.tune_outlined),
            label: const Text('Change risk limit'),
            onPressed: () => _changeLimit(context, ref, config),
          ),
          const Divider(),
          Text('Recent entries',
              style: Theme.of(context).textTheme.titleMedium),
          bets.when(
            loading: () => const LinearProgressIndicator(),
            error: (error, _) => Text('$error'),
            data: (items) {
              final byAgent = <String, num>{};
              final byBranch = <String, num>{};
              for (final bet in items) {
                byAgent.update(bet.agentId, (value) => value + bet.amount,
                    ifAbsent: () => bet.amount);
                byBranch.update(bet.branchId, (value) => value + bet.amount,
                    ifAbsent: () => bet.amount);
              }
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Grouped by agent'),
                  for (final entry in byAgent.entries)
                    ListTile(
                        title: Text(entry.key),
                        trailing: Text(formatAmount(entry.value))),
                  const Text('Grouped by branch'),
                  for (final entry in byBranch.entries)
                    ListTile(
                        title: Text(entry.key),
                        trailing: Text(formatAmount(entry.value))),
                  const Text('Recent bets'),
                  for (final bet in items.take(20))
                    ListTile(
                      title:
                          Text('${bet.agentId} - ${formatAmount(bet.amount)}'),
                      subtitle: Text(bet.createdAt == null
                          ? ''
                          : dateTimeFormat.format(bet.createdAt!)),
                      trailing: Text(bet.status.name),
                    ),
                  const Text(
                      'Audit logs are stored in auditLogs and can be queried by entityId.'),
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  Future<void> _saveConfig(
      WidgetRef ref, RiskConfig? current, bool blocked) async {
    final actor = ref.read(appUserProvider).valueOrNull;
    if (actor == null) return;
    final config = RiskConfig(
      number: number,
      riskLimit: current?.riskLimit ?? 100000,
      warningThresholdPercent: current?.warningThresholdPercent ?? 60,
      orangeThresholdPercent: current?.orangeThresholdPercent ?? 85,
      blockThresholdPercent: current?.blockThresholdPercent ?? 100,
      manuallyBlocked: blocked,
    );
    await ref
        .read(tallyServiceProvider)
        .setRiskConfig(drawId: drawId, config: config, updatedBy: actor.uid);
  }

  Future<void> _changeLimit(
      BuildContext context, WidgetRef ref, RiskConfig? current) async {
    final controller =
        TextEditingController(text: '${current?.riskLimit ?? 100000}');
    final saved = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Risk limit'),
        content: TextField(
            controller: controller, keyboardType: TextInputType.number),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Save')),
        ],
      ),
    );
    final actor = ref.read(appUserProvider).valueOrNull;
    if (saved == true && actor != null) {
      final config = RiskConfig(
        number: number,
        riskLimit: num.tryParse(controller.text) ?? 100000,
        warningThresholdPercent: current?.warningThresholdPercent ?? 60,
        orangeThresholdPercent: current?.orangeThresholdPercent ?? 85,
        blockThresholdPercent: current?.blockThresholdPercent ?? 100,
        manuallyBlocked: current?.manuallyBlocked ?? false,
      );
      await ref
          .read(tallyServiceProvider)
          .setRiskConfig(drawId: drawId, config: config, updatedBy: actor.uid);
    }
  }
}
