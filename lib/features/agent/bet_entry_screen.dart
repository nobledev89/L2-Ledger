import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/utils/formatters.dart';
import '../../core/utils/risk_utils.dart';
import '../../core/widgets/shell_scaffold.dart';
import '../shared/models/app_user.dart';
import '../shared/models/draw.dart';
import '../shared/models/tally.dart';
import '../shared/providers/auth_provider.dart';
import '../shared/providers/bet_provider.dart';
import '../shared/providers/draw_provider.dart';
import '../shared/providers/tally_provider.dart';

class BetEntryScreen extends ConsumerStatefulWidget {
  const BetEntryScreen({super.key});

  @override
  ConsumerState<BetEntryScreen> createState() => _BetEntryScreenState();
}

class _BetEntryScreenState extends ConsumerState<BetEntryScreen> {
  final number = TextEditingController();
  final amount = TextEditingController();
  final customerRef = TextEditingController();
  String? message;
  var busy = false;

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(appUserProvider).valueOrNull;
    final draws = ref.watch(openDrawsProvider).valueOrNull ?? [];
    final selected = ref.watch(selectedDrawProvider);
    final selectedId = ref.watch(selectedDrawIdProvider) ?? selected?.drawId;
    final normalized =
        number.text.length <= 2 ? twoDigitNumber(number.text) : number.text;
    final config = selected == null || !RegExp(r'^\d{2}$').hasMatch(normalized)
        ? null
        : ref
            .watch(riskConfigProvider(
                (drawId: selected.drawId, number: normalized)))
            .valueOrNull;
    final List<Tally> tallies = selected == null
        ? []
        : ref.watch(talliesProvider(selected.drawId)).valueOrNull ?? [];
    final currentTally =
        tallies.where((tally) => tally.number == normalized).toList();
    final currentExposure =
        currentTally.isEmpty ? 0 : currentTally.first.exposure;
    final enteredAmount = num.tryParse(amount.text) ?? 0;
    final projectedExposure = selected == null
        ? 0
        : currentExposure + enteredAmount * selected.defaultPayoutMultiplier;
    final projectedRisk = config == null
        ? 'green'
        : riskStatusFor(
            exposure: projectedExposure,
            riskLimit: config.riskLimit,
            blocked: config.manuallyBlocked,
            warningThresholdPercent: config.warningThresholdPercent,
            orangeThresholdPercent: config.orangeThresholdPercent,
          );

    return ShellScaffold(
      title: 'Create Bet',
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          DropdownButtonFormField<String>(
            initialValue: selectedId,
            decoration: const InputDecoration(labelText: 'Draw'),
            items: draws
                .map((draw) => DropdownMenuItem(
                      value: draw.drawId,
                      child: Text(
                          '${draw.gameType} - ${dateTimeFormat.format(draw.drawTime)}'),
                    ))
                .toList(),
            onChanged: (value) =>
                ref.read(selectedDrawIdProvider.notifier).state = value,
          ),
          const SizedBox(height: 12),
          TextFormField(
            readOnly: true,
            initialValue: selected?.gameType ?? 'STL 2D',
            decoration: const InputDecoration(labelText: 'Game type'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: number,
            decoration: const InputDecoration(labelText: 'Number 00-99'),
            maxLength: 2,
            keyboardType: TextInputType.number,
            style: Theme.of(context).textTheme.displaySmall,
            onChanged: (_) => setState(() {}),
          ),
          if (config?.manuallyBlocked == true)
            const Text('This number is blocked for the selected draw.',
                style: TextStyle(color: Colors.red)),
          if (config != null && !config.manuallyBlocked)
            Text('Risk limit: ${formatAmount(config.riskLimit)}'),
          const SizedBox(height: 12),
          TextField(
            controller: amount,
            decoration: const InputDecoration(labelText: 'Amount'),
            keyboardType: TextInputType.number,
            onChanged: (_) => setState(() {}),
          ),
          if (projectedRisk == 'yellow' || projectedRisk == 'orange')
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text('Warning: projected risk is $projectedRisk.',
                  style: TextStyle(color: riskColor(projectedRisk))),
            ),
          if (projectedRisk == 'red')
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: Text(
                  'Projected exposure is over limit. Submission will require admin approval.',
                  style: TextStyle(color: Colors.red)),
            ),
          const SizedBox(height: 12),
          TextField(
            controller: customerRef,
            decoration: const InputDecoration(
                labelText: 'Customer reference (optional)'),
          ),
          if (message != null) ...[
            const SizedBox(height: 12),
            Text(message!),
          ],
          const SizedBox(height: 20),
          FilledButton(
            onPressed: busy || user == null || selected == null
                ? null
                : () => _submit(user, selected),
            child: Text(busy ? 'Submitting...' : 'Submit bet'),
          ),
        ],
      ),
    );
  }

  Future<void> _submit(AppUser user, Draw draw) async {
    setState(() {
      busy = true;
      message = null;
    });
    try {
      final result = await ref.read(betServiceProvider).submitBet(
            agent: user,
            draw: draw,
            number: number.text,
            amount: num.tryParse(amount.text) ?? 0,
            customerRef: customerRef.text.trim(),
          );
      setState(() {
        message = result.message;
        number.clear();
        amount.clear();
        customerRef.clear();
      });
    } catch (e) {
      setState(() => message = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }
}
