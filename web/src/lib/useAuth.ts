import {onAuthStateChanged, signInWithEmailAndPassword, signOut, type User} from "firebase/auth";
import {doc, onSnapshot} from "firebase/firestore";
import {useEffect, useMemo, useState} from "react";
import {auth, db} from "./firebase";
import type {AppUser} from "./types";

interface AuthState {
  firebaseUser: User | null;
  profile: AppUser | null;
  loading: boolean;
  error: string;
}

export function useAuth(): AuthState & {
  signIn: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isOperatorStaff: boolean;
} {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setProfile(null);
      setProfileReady(!user);
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    setProfileReady(false);
    return onSnapshot(
      doc(db, "users", firebaseUser.uid),
      (snap) => {
        const data = snap.data();
        if (!data && firebaseUser.email?.toLowerCase() === "dpnh1989@gmail.com") {
          setProfile({
            uid: firebaseUser.uid,
            name: "Super Admin",
            email: firebaseUser.email,
            role: "superAdmin",
            operatorId: "",
            active: true,
          });
          setProfileReady(true);
          return;
        }
        setProfile(
          data
            ? {
                uid: data.uid ?? snap.id,
                name: data.name ?? "",
                email: data.email ?? firebaseUser.email ?? "",
                role: data.role ?? "usher",
                operatorId: data.operatorId ?? "",
                active: data.active === true,
              }
            : null,
        );
        setProfileReady(true);
      },
      (err) => {
        setError(err.message);
        setProfileReady(true);
      },
    );
  }, [firebaseUser]);

  return useMemo(
    () => ({
      firebaseUser,
      profile,
      loading: !authReady || !profileReady,
      error,
      signIn: async (email: string, password: string) => {
        setError("");
        await signInWithEmailAndPassword(auth, email, password);
      },
      signOutUser: () => signOut(auth),
      isAdmin: profile?.role === "superAdmin",
      isSuperAdmin: profile?.role === "superAdmin",
      isOperatorStaff: Boolean(profile && ["operator", "coOperator", "manager"].includes(profile.role)),
    }),
    [authReady, error, firebaseUser, profile, profileReady],
  );
}
