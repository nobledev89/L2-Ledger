import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/utils/formatters.dart';
import '../../core/widgets/shell_scaffold.dart';
import '../shared/models/bet.dart';
import '../shared/providers/auth_provider.dart';
import '../shared/providers/bet_provider.dart';
import '../shared/providers/draw_provider.dart';

class AgentBetsScreen extends ConsumerWidget {
  const AgentBetsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(appUserProvider).valueOrNull;
    final draw = ref.watch(selectedDrawProvider);
    if (user == null || draw == null) {
      return const ShellScaffold(
          title: 'My Bets', child: Center(child: Text('No draw selected.')));
    }
    final bets =
        ref.watch(agentBetsProvider((agentId: user.uid, drawId: draw.drawId)));
    return ShellScaffold(
      title: 'My Bets',
      child: bets.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text('$error')),
        data: (items) => ListView.builder(
          itemCount: items.length,
          itemBuilder: (_, index) {
            final bet = items[index];
            return ListTile(
              title: Text('${bet.number}  ${formatAmount(bet.amount)}'),
              subtitle: Text(
                  '${bet.createdAt == null ? '' : dateTimeFormat.format(bet.createdAt!)}  ${bet.customerRef}'),
              trailing: Text(bet.status.name),
              onTap: bet.status == BetStatus.accepted &&
                      DateTime.now().isBefore(draw.cutoffTime)
                  ? () => _requestVoid(context, ref, bet)
                  : null,
            );
          },
        ),
      ),
    );
  }

  Future<void> _requestVoid(
      BuildContext context, WidgetRef ref, Bet bet) async {
    final reason = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Request void'),
        content: TextField(
            controller: reason,
            decoration: const InputDecoration(labelText: 'Reason')),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Request')),
        ],
      ),
    );
    final user = ref.read(appUserProvider).valueOrNull;
    final draw = ref.read(selectedDrawProvider);
    if (confirmed == true && user != null && draw != null) {
      await ref.read(betServiceProvider).requestVoid(
          bet: bet, actor: user, draw: draw, reason: reason.text.trim());
    }
  }
}
