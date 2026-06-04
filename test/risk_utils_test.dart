import 'package:flutter_test/flutter_test.dart';
import 'package:stl_risk_monitor/core/utils/risk_utils.dart';

void main() {
  test('risk status thresholds match MVP rules', () {
    expect(riskStatusFor(exposure: 59, riskLimit: 100), 'green');
    expect(riskStatusFor(exposure: 60, riskLimit: 100), 'yellow');
    expect(riskStatusFor(exposure: 85, riskLimit: 100), 'orange');
    expect(riskStatusFor(exposure: 100, riskLimit: 100), 'red');
    expect(
        riskStatusFor(exposure: 10, riskLimit: 100, blocked: true), 'blocked');
  });

  test('normalizes two digit numbers', () {
    expect(twoDigitNumber('7'), '07');
    expect(twoDigitNumber('42'), '42');
  });
}
