import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/theme/app_theme.dart';
import 'features/admin/admin_dashboard_screen.dart';
import 'features/agent/agent_home_screen.dart';
import 'features/auth/login_screen.dart';
import 'features/shared/providers/auth_provider.dart';

class StlRiskMonitorApp extends StatelessWidget {
  const StlRiskMonitorApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'STL Risk Monitor',
      theme: AppTheme.light,
      home: const AuthGate(),
    );
  }
}

class AuthGate extends ConsumerWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authStateProvider);
    return auth.when(
      loading: () =>
          const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (error, _) => Scaffold(body: Center(child: Text('$error'))),
      data: (firebaseUser) {
        if (firebaseUser == null) return const LoginScreen();
        final profile = ref.watch(appUserProvider);
        return profile.when(
          loading: () =>
              const Scaffold(body: Center(child: CircularProgressIndicator())),
          error: (error, _) => Scaffold(body: Center(child: Text('$error'))),
          data: (user) {
            if (user == null || !user.active) {
              return const Scaffold(
                body: Center(
                    child: Text(
                        'No active user profile found. Contact an administrator.')),
              );
            }
            return user.isAdmin
                ? const AdminDashboardScreen()
                : const AgentHomeScreen();
          },
        );
      },
    );
  }
}
