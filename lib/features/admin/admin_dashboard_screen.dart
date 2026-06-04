import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/utils/formatters.dart';
import '../../core/utils/risk_utils.dart';
import '../../core/widgets/shell_scaffold.dart';
import '../shared/models/bet.dart';
import '../shared/models/tally.dart';
import '../shared/providers/auth_provider.dart';
import '../shared/providers/bet_provider.dart';
import '../shared/providers/draw_provider.dart';
import '../shared/providers/tally_provider.dart';
import 'draw_management_screen.dart';
import 'number_detail_screen.dart';
import 'reports_screen.dart';

class AdminDashboardScreen extends ConsumerWidget {
  const AdminDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final draw = ref.watch(selectedDrawProvider);
    final tallies = draw == null
        ? const AsyncValue<List<Tally>>.data([])
        : ref.watch(talliesProvider(draw.drawId));
    final recent = draw == null
        ? const AsyncValue<List<Bet>>.data([])
        : ref.watch(recentBetsProvider(draw.drawId));
    final pending = draw == null
        ? const AsyncValue<List<Bet>>.data([])
        : ref.watch(pendingApprovalsProvider(draw.drawId));

    return ShellScaffold(
      title: 'Admin Dashboard',
      actions: [
        IconButton(
          tooltip: 'Draws',
          icon: const Icon(Icons.schedule_outlined),
          onPressed: () => Navigator.push(context,
              MaterialPageRoute(builder: (_) => const DrawManagementScreen())),
        ),
        IconButton(
          tooltip: 'Reports',
          icon: const Icon(Icons.analytics_outlined),
          onPressed: () => Navigator.push(context,
              MaterialPageRoute(builder: (_) => const ReportsScreen())),
        ),
        IconButton(
          tooltip: 'Sign out',
          icon: const Icon(Icons.logout),
          onPressed: () => ref.read(authServiceProvider).signOut(),
        ),
      ],
      child: draw == null
          ? const Center(
              child: Text('No draw selected. Create or open a draw.'))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                    '${draw.gameType} - ${dateTimeFormat.format(draw.drawTime)}'),
                Text('Cutoff: ${_timeRemaining(draw.cutoffTime)} remaining'),
                const SizedBox(height: 12),
                tallies.when(
                  loading: () => const LinearProgressIndicator(),
                  error: (error, _) => Text('$error'),
                  data: (items) => _DashboardBody(
                      drawId: draw.drawId,
                      tallies: items,
                      recent: recent,
                      pending: pending),
                ),
              ],
            ),
    );
  }

  String _timeRemaining(DateTime cutoff) {
    final diff = cutoff.difference(DateTime.now());
    if (diff.isNegative) return 'cutoff passed';
    return '${diff.inHours}h ${diff.inMinutes.remainder(60)}m';
  }
}

class _DashboardBody extends ConsumerWidget {
  const _DashboardBody({
    required this.drawId,
    required this.tallies,
    required this.recent,
    required this.pending,
  });

  final String drawId;
  final List<Tally> tallies;
  final AsyncValue<List<Bet>> recent;
  final AsyncValue<List<Bet>> pending;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final highest = [...tallies]
      ..sort((a, b) => b.exposure.compareTo(a.exposure));
    final top = highest.isEmpty ? Tally.empty('00') : highest.first;
    final totalSales =
        tallies.fold<num>(0, (sum, tally) => sum + tally.totalAmount);
    final acceptedCount =
        tallies.fold<int>(0, (sum, tally) => sum + tally.betCount);
    final redCount = tallies.where((tally) => tally.riskStatus == 'red').length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _Metric(label: 'Total sales', value: formatAmount(totalSales)),
            _Metric(label: 'Accepted bets', value: '$acceptedCount'),
            _Metric(label: 'Active agents', value: 'TODO'),
            _Metric(label: 'Highest #', value: top.number),
            _Metric(
                label: 'Highest exposure', value: formatAmount(top.exposure)),
            _Metric(label: 'Red risk', value: '$redCount'),
          ],
        ),
        const SizedBox(height: 20),
        Text('00-99 Risk Grid', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: 100,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 5,
            childAspectRatio: 1.15,
            crossAxisSpacing: 6,
            mainAxisSpacing: 6,
          ),
          itemBuilder: (_, index) {
            final number = index.toString().padLeft(2, '0');
            final tally = tallies.firstWhere((t) => t.number == number,
                orElse: () => Tally.empty(number));
            return InkWell(
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(
                    builder: (_) =>
                        NumberDetailScreen(drawId: drawId, number: number)),
              ),
              child: Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color:
                      riskColor(tally.blocked ? 'blocked' : tally.riskStatus),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: DefaultTextStyle(
                  style: const TextStyle(
                      color: Colors.white, fontWeight: FontWeight.w600),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(number,
                          style: Theme.of(context)
                              .textTheme
                              .titleLarge
                              ?.copyWith(color: Colors.white)),
                      Text(formatAmount(tally.totalAmount),
                          maxLines: 1, overflow: TextOverflow.ellipsis),
                      Text(formatAmount(tally.exposure),
                          maxLines: 1, overflow: TextOverflow.ellipsis),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
        const SizedBox(height: 20),
        Text('Hot Numbers', style: Theme.of(context).textTheme.titleMedium),
        for (final tally in highest.take(10))
          ListTile(
              title: Text(tally.number),
              trailing: Text(formatAmount(tally.exposure))),
        Text('Recent Bets', style: Theme.of(context).textTheme.titleMedium),
        recent.when(
          loading: () => const LinearProgressIndicator(),
          error: (error, _) => Text('$error'),
          data: (bets) => Column(
            children: [
              for (final bet in bets)
                ListTile(
                    title: Text('${bet.number} ${formatAmount(bet.amount)}'),
                    trailing: Text(bet.status.name)),
            ],
          ),
        ),
        Text('Pending Approvals',
            style: Theme.of(context).textTheme.titleMedium),
        pending.when(
          loading: () => const LinearProgressIndicator(),
          error: (error, _) => Text('$error'),
          data: (bets) => Column(
            children: [
              for (final bet in bets)
                ListTile(
                  title: Text('${bet.number} ${formatAmount(bet.amount)}'),
                  subtitle: Text('Exposure ${formatAmount(bet.exposure)}'),
                  trailing: Wrap(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.check_circle_outline),
                        onPressed: () {
                          final admin = ref.read(appUserProvider).valueOrNull;
                          if (admin != null) {
                            unawaited(ref
                                .read(betServiceProvider)
                                .approveBet(bet, admin));
                          }
                        },
                      ),
                      IconButton(
                        icon: const Icon(Icons.cancel_outlined),
                        onPressed: () {
                          final admin = ref.read(appUserProvider).valueOrNull;
                          if (admin != null) {
                            unawaited(ref
                                .read(betServiceProvider)
                                .rejectBet(bet, admin, 'Rejected by admin'));
                          }
                        },
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 150,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: Theme.of(context).textTheme.labelMedium),
            Text(value, style: Theme.of(context).textTheme.titleLarge),
          ]),
        ),
      ),
    );
  }
}
