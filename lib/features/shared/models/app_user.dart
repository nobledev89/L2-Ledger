import 'package:cloud_firestore/cloud_firestore.dart';

enum UserRole { usher, manager, coOperator, operator, superAdmin }

UserRole roleFromString(String value) => UserRole.values.firstWhere(
      (role) => role.name == value,
      orElse: () => UserRole.usher,
    );

class AppUser {
  const AppUser({
    required this.uid,
    required this.name,
    required this.email,
    required this.role,
    required this.operatorId,
    required this.active,
  });

  final String uid;
  final String name;
  final String email;
  final UserRole role;
  final String operatorId;
  final bool active;

  bool get isSuperAdmin => role == UserRole.superAdmin;
  bool get isOperatorStaff =>
      role == UserRole.operator ||
      role == UserRole.coOperator ||
      role == UserRole.manager;
  bool get canCreateDirectBets =>
      role == UserRole.operator ||
      role == UserRole.coOperator ||
      role == UserRole.manager;
  bool get canManageFinancials =>
      role == UserRole.operator ||
      role == UserRole.coOperator ||
      role == UserRole.superAdmin;

  factory AppUser.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return AppUser(
      uid: data['uid'] as String? ?? doc.id,
      name: data['name'] as String? ?? '',
      email: data['email'] as String? ?? '',
      role: roleFromString(data['role'] as String? ?? 'usher'),
      operatorId: data['operatorId'] as String? ?? '',
      active: data['active'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toFirestore() => {
        'uid': uid,
        'name': name,
        'email': email,
        'role': role.name,
        'operatorId': operatorId,
        'active': active,
        'updatedAt': FieldValue.serverTimestamp(),
      };
}
