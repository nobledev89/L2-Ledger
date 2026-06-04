import 'package:intl/intl.dart';

final amountFormat = NumberFormat('#,##0.##');
final dateTimeFormat = DateFormat('MMM d, h:mm a');

String formatAmount(num amount) => amountFormat.format(amount);
