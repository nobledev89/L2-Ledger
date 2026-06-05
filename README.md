# stl_risk_monitor

Flutter + Firebase MVP for authorized STL/PCSO-related agent entry, real-time tallying, risk monitoring, audit logs, and settlement-style reports.

This app does not support public, anonymous, or unlicensed betting. It is intended only for authorized operational users with Firebase Auth accounts and Firestore user roles.

## Setup

```bash
flutter create . --project-name stl_risk_monitor --platforms android,ios
flutter pub get
firebase login
dart pub global activate flutterfire_cli
flutterfire configure
flutter run
```

Enable Firebase Authentication email/password and Cloud Firestore before running.

## Seed Data

The only super admin account is:

```text
email: "dpnh1989@gmail.com"
password: "Password123" for demo/testing only
role: "superAdmin"
```

After signing in as `dpnh1989@gmail.com`, use the web Operators screen to seed demo data. The seeder creates real Firebase Auth users:

```text
operator1@test.local / Password123
cooperator1@test.local / Password123
manager1@test.local / Password123
usher1-1@test.local through usher1-5@test.local / Password123

operator2@test.local / Password123
cooperator2@test.local / Password123
manager2@test.local / Password123
usher2-1@test.local through usher2-5@test.local / Password123
```

The demo data includes two operators, one co-operator per operator, one manager per operator, five ushers per operator, fixed draws from five days back through three days forward, demo bets, reports, and sample blocked red numbers.

Create fixed daily draws from Draw Management, or seed:

```text
draws/{drawId}
operatorId: "{operatorId}"
drawDate: "YYYY-MM-DD"
drawSlot: "2pm" | "5pm" | "9pm"
drawTime: timestamp
cutoffTime: timestamp
status: "open"
payoutMultiplier: 400
blockedNumbers: []
createdAt: server timestamp
updatedAt: server timestamp
```

## Firebase

Deploy backend:

```bash
firebase deploy --only functions,firestore --force
```

## OTA Updates

This project is prepared for Shorebird Code Push for Flutter OTA updates.

Install and authenticate the Shorebird CLI once:

```powershell
iwr -UseBasicParsing 'https://raw.githubusercontent.com/shorebirdtech/install/main/install.ps1' | iex
.\scripts\shorebird.ps1 doctor
shorebird login
```

Initialize the app with your Shorebird account:

```powershell
.\scripts\shorebird.ps1 init
```

That creates `shorebird.yaml` and registers the app with Shorebird. Commit the generated `shorebird.yaml`.

Create the first OTA-capable Android release:

```powershell
.\scripts\shorebird.ps1 release-android
```

After users install that Shorebird-built release, ship Dart-only fixes with:

```powershell
.\scripts\shorebird.ps1 patch-android
```

iOS releases and patches use `release-ios` and `patch-ios`, but must be run from macOS with Xcode.

Native Android/iOS changes, new permissions, plugin native changes, signing changes, and app version changes still require a normal store/app release.

## Notes

- Critical writes are handled by callable Cloud Functions:
  `submitBetSlip`, `cancelBetSlipBeforeCutoff`, `createFixedDrawsForDate`,
  `enterWinningNumber`, `markBetPaid`, `blockNumberForDraw`,
  `unblockNumberForDraw`, `addOperatorWithLogin`, `addCoOperatorWithLogin`,
  `addManagerWithLogin`, `addUsherWithLogin`, `computeDailyReport`,
  `computeWeeklyBilling`, `markBillingPaid`, `lockOverdueOperators`, and
  `seedDemoData`.
- Firestore rules deny direct client writes to bets, draws, tallies, risk configs, and audit logs.
- Firebase Auth email/password must be enabled in the Firebase Console.
- TODO: add Firebase Hosting admin dashboard when web support is prioritized.
- TODO: add device identity and richer online presence tracking.
- TODO: add PDF/CSV exports for reports.
- TODO: enable Firebase App Check before broad distribution.
- TODO: configure monitoring alerts, backup/export policy, and formal compliance review before real operations.
