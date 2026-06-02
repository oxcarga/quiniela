"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import {
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signOut as firebaseSignOut,
  updateProfile,
  isSignInWithEmailLink,
  type User,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const MAGIC_LINK_EMAIL_KEY = "emailForSignIn";
const SESSION_COOKIE = "auth_session";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  sendMagicLink: (email: string) => Promise<void>;
  confirmMagicLink: (url: string, email?: string) => Promise<User>;
  setDisplayName: (name: string) => Promise<void>;
  signOut: () => Promise<void>;
  isEmailLinkUrl: (url: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);

      // Keep the optimistic proxy cookie in sync with Firebase auth state
      if (firebaseUser) {
        document.cookie = `${SESSION_COOKIE}=1; path=/; max-age=604800; SameSite=Lax`;
      } else {
        document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`;
      }
    });

    return unsubscribe;
  }, []);

  const sendMagicLink = useCallback(async (email: string) => {
    const actionCodeSettings = {
      url: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm`,
      handleCodeInApp: true,
    };
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    localStorage.setItem(MAGIC_LINK_EMAIL_KEY, email);
  }, []);

  const confirmMagicLink = useCallback(
    async (url: string, emailOverride?: string): Promise<User> => {
      const email =
        emailOverride ?? localStorage.getItem(MAGIC_LINK_EMAIL_KEY);
      if (!email) {
        throw new Error("EMAIL_REQUIRED");
      }

      const result = await signInWithEmailLink(auth, email, url);
      localStorage.removeItem(MAGIC_LINK_EMAIL_KEY);

      // Create or update the Firestore user document
      await setDoc(
        doc(db, "users", result.user.uid),
        {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName ?? null,
          photoURL: result.user.photoURL ?? null,
          totalScore: 0,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      return result.user;
    },
    []
  );

  const setDisplayName = useCallback(
    async (name: string) => {
      if (!user) throw new Error("Not authenticated");
      await updateProfile(user, { displayName: name });
      // Refresh local state since updateProfile mutates the user object in place
      setUser({ ...user, displayName: name } as User);
      // Sync to Firestore
      await setDoc(
        doc(db, "users", user.uid),
        { displayName: name },
        { merge: true }
      );
    },
    [user]
  );

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  const isEmailLinkUrl = useCallback(
    (url: string) => isSignInWithEmailLink(auth, url),
    []
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        sendMagicLink,
        confirmMagicLink,
        setDisplayName,
        signOut,
        isEmailLinkUrl,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
