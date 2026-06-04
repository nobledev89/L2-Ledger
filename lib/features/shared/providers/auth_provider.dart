import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/app_user.dart';
import '../services/auth_service.dart';
import '../services/firestore_service.dart';

final firebaseAuthProvider =
    Provider<FirebaseAuth>((_) => FirebaseAuth.instance);
final firestoreProvider =
    Provider<FirebaseFirestore>((_) => FirebaseFirestore.instance);
final functionsProvider = Provider<FirebaseFunctions>(
    (_) => FirebaseFunctions.instanceFor(region: 'asia-northeast1'));

final authServiceProvider = Provider<AuthService>(
    (ref) => AuthService(ref.watch(firebaseAuthProvider)));
final firestoreServiceProvider = Provider<FirestoreService>(
    (ref) => FirestoreService(ref.watch(firestoreProvider)));

final authStateProvider = StreamProvider<User?>(
  (ref) => ref.watch(authServiceProvider).authStateChanges(),
);

final appUserProvider = StreamProvider<AppUser?>((ref) {
  final user = ref.watch(authStateProvider).valueOrNull;
  if (user == null) return Stream.value(null);
  return ref.watch(firestoreServiceProvider).userProfile(user.uid);
});
