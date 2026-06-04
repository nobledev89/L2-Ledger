import 'package:flutter/material.dart';

String riskStatusFor({
  required num exposure,
  required num riskLimit,
  bool blocked = false,
  int warningThresholdPercent = 60,
  int orangeThresholdPercent = 85,
}) {
  if (blocked) return 'blocked';
  if (riskLimit <= 0) return 'red';
  final percent = exposure / riskLimit;
  if (percent >= 1) return 'red';
  if (percent >= orangeThresholdPercent / 100) return 'orange';
  if (percent >= warningThresholdPercent / 100) return 'yellow';
  return 'green';
}

Color riskColor(String status) {
  switch (status) {
    case 'yellow':
      return const Color(0xffffc107);
    case 'orange':
      return const Color(0xffff8f00);
    case 'red':
      return const Color(0xffd32f2f);
    case 'blocked':
      return const Color(0xff757575);
    default:
      return const Color(0xff2e7d32);
  }
}

String twoDigitNumber(String input) => input.trim().padLeft(2, '0');
