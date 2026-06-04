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

Create at least one admin user document after signing up or manually creating a Firebase Auth user:

```text
users/{uid}
uid: "{uid}"
name: "Admin"
email: "admin@example.com"
role: "superAdmin"
branchId: "main"
active: true
createdAt: server timestamp
updatedAt: server timestamp
```

Create a branch:

```text
branches/main
name: "Main Branch"
area: "Metro"
active: true
```

Create an open draw from the app's Draw Management screen, or seed:

```text
draws/{drawId}
gameType: "STL 2D"
drawTime: timestamp
cutoffTime: timestamp
status: "open"
officialResult: ""
defaultPayoutMultiplier: 400
createdBy: "{adminUid}"
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
  `submitBet`, `requestVoid`, `approveBet`, `rejectBet`, `setRiskConfig`, `createDraw`, and `updateDrawStatus`.
- Firestore rules deny direct client writes to bets, draws, tallies, risk configs, and audit logs.
- Firebase Auth email/password must be enabled in the Firebase Console.
- TODO: add Firebase Hosting admin dashboard when web support is prioritized.
- TODO: add device identity and richer online presence tracking.
- TODO: add PDF/CSV exports for reports.
- TODO: enable Firebase App Check before broad distribution.
- TODO: configure monitoring alerts, backup/export policy, and formal compliance review before real operations.
