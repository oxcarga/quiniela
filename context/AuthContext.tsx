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
  signInWithEmailLink,
  signOut as firebaseSignOut,
  updateProfile,
  isSignInWithEmailLink,
  type User,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const MAGIC_LINK_EMAIL_KEY = "emailForSignIn";
const SESSION_COOKIE = "auth_session";
// Optimistic gate cookie for the proxy. It must outlive any realistic gap
// between visits so a still-logged-in user (Firebase session persists in
// IndexedDB, which is ITP-exempt in an installed PWA) is never bounced to
// /login by the server before client JS can confirm auth. The client
// (onAuthStateChanged) is the real gate and clears this the instant Firebase
// reports no user, so a long lifetime here is safe. 400d = browser cookie cap.
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signInLinkDEV: string;
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
  const [signInLinkDEV, setSignInLinkDEV] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);

      // Keep the optimistic proxy cookie in sync with Firebase auth state
      if (firebaseUser) {
        document.cookie = `${SESSION_COOKIE}=1; path=/; max-age=${SESSION_COOKIE_MAX_AGE}; SameSite=Lax`;
      } else {
        document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`;
      }
    });

    return unsubscribe;
  }, []);

  const sendMagicLink = useCallback(async (email: string) => {
    const res = await fetch("/api/auth/send-magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const { error } = await res.json();
      throw new Error(error ?? "Error al enviar el enlace");
    }
    const resJson = await res.json();
    if (resJson.link) {
      setSignInLinkDEV(resJson.link);
    }
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

      return result.user;
    },
    []
  );

  const setDisplayName = useCallback(
    async (name: string) => {
      if (!user) throw new Error("Not authenticated");
      await updateProfile(user, { displayName: name });
      // Use auth.currentUser — spreading would strip Firebase prototype methods
      setUser(auth.currentUser);
      // Sync to Firestore — write full profile so leaderboard and scoring have all fields
      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          email: user.email,
          photoURL: user.photoURL ?? null,
          displayName: name,
        },
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
        signInLinkDEV,
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
