import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/utils/formatters.dart';
import '../../core/widgets/shell_scaffold.dart';
import '../shared/models/bet.dart';
import '../shared/providers/auth_provider.dart';
import '../shared/providers/bet_provider.dart';
import '../shared/providers/draw_provider.dart';
import 'agent_bets_screen.dart';
import 'bet_entry_screen.dart';

class AgentHomeScreen extends ConsumerWidget {
  const AgentHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(appUserProvider).valueOrNull;
    final draw = ref.watch(selectedDrawProvider);
    final bets = user == null || draw == null
        ? const AsyncValue<List<Bet>>.data([])
        : ref
            .watch(agentBetsProvider((agentId: user.uid, drawId: draw.drawId)));

    return ShellScaffold(
      title: 'Agent Home',
      actions: [
        IconButton(
          tooltip: 'Sign out',
          icon: const Icon(Icons.logout),
          onPressed: () => ref.read(authServiceProvider).signOut(),
        ),
      ],
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: draw == null
                  ? const Text('No active draw is available.')
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(draw.gameType,
                            style: Theme.of(context).textTheme.titleLarge),
                        Text('Draw: ${dateTimeFormat.format(draw.drawTime)}'),
                        Text(
                            'Cutoff: ${dateTimeFormat.format(draw.cutoffTime)}'),
                        Text('Status: ${draw.status.name}'),
                      ],
                    ),
            ),
          ),
          const SizedBox(height: 12),
          bets.when(
            loading: () => const LinearProgressIndicator(),
            error: (error, _) => Text('$error'),
            data: (items) {
              final acceptedSales = items
                  .where((bet) => bet.status == BetStatus.accepted)
                  .fold<num>(0, (sum, bet) => sum + bet.amount);
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ListTile(
                    title: const Text('Agent total sales'),
                    trailing: Text(formatAmount(acceptedSales),
                        style: Theme.of(context).textTheme.titleLarge),
                  ),
                  const ListTile(
                    leading: Icon(Icons.cloud_done_outlined),
                    title: Text('Sync status'),
                    trailing: Text('Online'),
                  ),
                  const Divider(),
                  Text('Last 10 submitted bets',
                      style: Theme.of(context).textTheme.titleMedium),
                  for (final bet in items.take(10))
                    ListTile(
                      title: Text('${bet.number}  ${formatAmount(bet.amount)}'),
                      subtitle: Text(bet.customerRef),
                      trailing: Text(bet.status.name),
                    ),
                ],
              );
            },
          ),
          const SizedBox(height: 20),
          FilledButton.icon(
            icon: const Icon(Icons.add_circle_outline),
            label: const Text('Create bet'),
            onPressed: draw == null
                ? null
                : () => Navigator.push(context,
                    MaterialPageRoute(builder: (_) => const BetEntryScreen())),
          ),
          OutlinedButton.icon(
            icon: const Icon(Icons.list_alt_outlined),
            label: const Text('View own bets'),
            onPressed: draw == null
                ? null
                : () => Navigator.push(context,
                    MaterialPageRoute(builder: (_) => const AgentBetsScreen())),
          ),
        ],
      ),
    );
  }
}
