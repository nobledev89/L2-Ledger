import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/utils/formatters.dart';
import '../../core/widgets/shell_scaffold.dart';
import '../shared/providers/draw_provider.dart';
import '../shared/providers/bet_provider.dart';
import '../shared/providers/tally_provider.dart';

class ReportsScreen extends ConsumerWidget {
  const ReportsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final draw = ref.watch(selectedDrawProvider);
    if (draw == null) {
      return const ShellScaffold(
          title: 'Reports', child: Center(child: Text('No draw selected.')));
    }
    final tallies = ref.watch(talliesProvider(draw.drawId));
    final acceptedBets =
        ref.watch(acceptedBetsProvider(draw.drawId)).valueOrNull ?? [];
    return ShellScaffold(
      title: 'Reports',
      child: tallies.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text('$error')),
        data: (items) {
          final totalSales =
              items.fold<num>(0, (sum, tally) => sum + tally.totalAmount);
          final winningMatches = draw.officialResult.isEmpty
              ? []
              : items
                  .where((tally) => tally.number == draw.officialResult)
                  .toList();
          final winning = winningMatches.isEmpty ? null : winningMatches.first;
          final payoutExposure = winning?.exposure ?? 0;
          final byAgent = <String, num>{};
          final byBranch = <String, num>{};
          for (final bet in acceptedBets) {
            byAgent.update(bet.agentId, (value) => value + bet.amount,
                ifAbsent: () => bet.amount);
            byBranch.update(bet.branchId, (value) => value + bet.amount,
                ifAbsent: () => bet.amount);
          }
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text('Sales by draw',
                  style: Theme.of(context).textTheme.titleMedium),
              ListTile(
                  title: Text(draw.drawId),
                  trailing: Text(formatAmount(totalSales))),
              Text('Sales by agent',
                  style: Theme.of(context).textTheme.titleMedium),
              for (final entry in byAgent.entries)
                ListTile(
                    title: Text(entry.key),
                    trailing: Text(formatAmount(entry.value))),
              Text('Sales by branch',
                  style: Theme.of(context).textTheme.titleMedium),
              for (final entry in byBranch.entries)
                ListTile(
                    title: Text(entry.key),
                    trailing: Text(formatAmount(entry.value))),
              Text('Per-number totals',
                  style: Theme.of(context).textTheme.titleMedium),
              for (final tally in items.where((tally) => tally.totalAmount > 0))
                ListTile(
                    title: Text(tally.number),
                    trailing: Text(formatAmount(tally.totalAmount))),
              Text('Winning number payout exposure',
                  style: Theme.of(context).textTheme.titleMedium),
              ListTile(
                  title: Text(draw.officialResult.isEmpty
                      ? 'Not completed'
                      : draw.officialResult),
                  trailing: Text(formatAmount(payoutExposure))),
              Text('Net position estimate',
                  style: Theme.of(context).textTheme.titleMedium),
              ListTile(
                  title: const Text('Sales minus winning exposure'),
                  trailing: Text(formatAmount(totalSales - payoutExposure))),
              const Divider(),
              const Text('TODO: export this report as PDF/CSV.'),
            ],
          );
        },
      ),
    );
  }
}
