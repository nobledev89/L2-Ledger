import 'package:cloud_firestore/cloud_firestore.dart';

enum UserRole { agent, admin, superAdmin }

UserRole roleFromString(String value) => UserRole.values.firstWhere(
      (role) => role.name == value,
      orElse: () => UserRole.agent,
    );

class AppUser {
  const AppUser({
    required this.uid,
    required this.name,
    required this.email,
    required this.role,
    required this.branchId,
    required this.active,
  });

  final String uid;
  final String name;
  final String email;
  final UserRole role;
  final String branchId;
  final bool active;

  bool get isAdmin => role == UserRole.admin || role == UserRole.superAdmin;
  bool get isSuperAdmin => role == UserRole.superAdmin;

  factory AppUser.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return AppUser(
      uid: data['uid'] as String? ?? doc.id,
      name: data['name'] as String? ?? '',
      email: data['email'] as String? ?? '',
      role: roleFromString(data['role'] as String? ?? 'agent'),
      branchId: data['branchId'] as String? ?? '',
      active: data['active'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toFirestore() => {
        'uid': uid,
        'name': name,
        'email': email,
        'role': role.name,
        'branchId': branchId,
        'active': active,
        'updatedAt': FieldValue.serverTimestamp(),
      };
}
