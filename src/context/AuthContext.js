import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';

const AuthContext = createContext({
  user: null,
  loading: true,
  signOut: async () => {},
  signInWithApple: async () => {},
  signInWithEmail: async () => {},
});

// Lightweight deterministic id from an email (local-only auth, no backend).
function uidFromEmail(email) {
  const normalized = String(email).trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 31 + normalized.charCodeAt(i)) | 0;
  }
  return 'email-' + Math.abs(hash).toString(36);
}

const MOCK_USER_KEY = 'mock_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(MOCK_USER_KEY).then((raw) => {
      if (raw) setUser(JSON.parse(raw));
      setLoading(false);
    });
  }, []);

  const signOut = async () => {
    await AsyncStorage.removeItem(MOCK_USER_KEY);
    setUser(null);
  };

  const signInWithApple = async () => {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    const existingRaw = await AsyncStorage.getItem('apple_user_' + credential.user);
    const existing = existingRaw ? JSON.parse(existingRaw) : null;
    const firstName = credential.fullName?.givenName || existing?.firstName || '';
    const lastName = credential.fullName?.familyName || existing?.lastName || '';
    const displayName = [firstName, lastName].filter(Boolean).join(' ') || 'Apple User';
    const appleUser = {
      uid: 'apple-' + credential.user,
      email: credential.email || existing?.email || `apple@privaterelay.appleid.com`,
      displayName,
      provider: 'apple',
    };
    await AsyncStorage.setItem('apple_user_' + credential.user, JSON.stringify({
      firstName, lastName, email: appleUser.email,
    }));
    await AsyncStorage.setItem(MOCK_USER_KEY, JSON.stringify(appleUser));
    setUser(appleUser);
    return { user: appleUser };
  };

  // Email sign-in / sign-up (local, cross-platform — works on Android & iOS).
  // Creates the account on first use, restores it on return (basic local check).
  const signInWithEmail = async (email, password, name) => {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !password) {
      throw new Error('missing-credentials');
    }
    const uid = uidFromEmail(cleanEmail);
    const accountKey = 'email_account_' + uid;
    const existingRaw = await AsyncStorage.getItem(accountKey);
    const existing = existingRaw ? JSON.parse(existingRaw) : null;

    if (existing) {
      // Returning user — verify password.
      if (existing.password && existing.password !== password) {
        throw new Error('wrong-password');
      }
    }

    const displayName =
      (name && name.trim()) || existing?.displayName || cleanEmail.split('@')[0];
    const emailUser = {
      uid,
      email: cleanEmail,
      displayName,
      provider: 'email',
    };
    await AsyncStorage.setItem(
      accountKey,
      JSON.stringify({ ...emailUser, password })
    );
    await AsyncStorage.setItem(MOCK_USER_KEY, JSON.stringify(emailUser));
    setUser(emailUser);
    return { user: emailUser };
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut, signInWithApple, signInWithEmail }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;
