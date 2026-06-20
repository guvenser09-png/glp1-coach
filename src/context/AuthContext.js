import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

const AuthContext = createContext({
  user: null,
  loading: true,
  signOut: async () => {},
  signInWithApple: async () => {},
  signInWithEmail: async () => {},
});

// B5: never let corrupt/garbage storage crash startup or sign-in.
// Parse defensively and fall back to a safe default on any error.
function safeParse(raw, fallback = null) {
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

// A4: strengthen the email -> uid derivation. Replace the weak 31-multiplier
// hash with a cryptographic SHA-256 digest of the normalized email. Returns a
// stable, collision-resistant id. Falls back to a non-crypto digest only if
// the native module is somehow unavailable, preserving deterministic behavior.
async function uidFromEmail(email) {
  const normalized = String(email).trim().toLowerCase();
  try {
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      'glp1-uid:' + normalized
    );
    // Keep the existing 'email-' prefix; truncate the hex for a compact id.
    return 'email-' + digest.slice(0, 32);
  } catch (e) {
    // Defensive fallback — keeps auth working even if crypto digest fails.
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      hash = (hash * 31 + normalized.charCodeAt(i)) | 0;
    }
    return 'email-' + Math.abs(hash).toString(36);
  }
}

// A2: hash passwords (salted SHA-256) before storing; never store plaintext.
// Salt is a per-account random hex string so identical passwords don't collide.
async function makeSalt() {
  try {
    const bytes = await Crypto.getRandomBytesAsync(16);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch (e) {
    // Extremely unlikely; fall back to a UUID-derived salt.
    return Crypto.randomUUID().replace(/-/g, '');
  }
}

async function hashPassword(password, salt) {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    'glp1-pwd:' + salt + ':' + String(password)
  );
}

const MOCK_USER_KEY = 'mock_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(MOCK_USER_KEY)
      .then((raw) => {
        if (!mounted) return;
        // B5: guard JSON.parse so a corrupt record can't white-screen startup.
        const parsed = safeParse(raw, null);
        if (parsed) setUser(parsed);
        setLoading(false);
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
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
    // B5: guard JSON.parse on the stored Apple record.
    const existing = safeParse(existingRaw, null);
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
    const uid = await uidFromEmail(cleanEmail);
    const accountKey = 'email_account_' + uid;
    const existingRaw = await AsyncStorage.getItem(accountKey);
    // B5: guard JSON.parse — corrupt account record is treated as no account.
    const existing = safeParse(existingRaw, null);

    if (existing) {
      // Returning user — verify password against the stored hash.
      if (existing.passwordHash && existing.passwordSalt) {
        // A2: compare hashes, never plaintext.
        const candidate = await hashPassword(password, existing.passwordSalt);
        if (candidate !== existing.passwordHash) {
          throw new Error('wrong-password');
        }
      } else if (existing.password) {
        // A2 migration: legacy plaintext record. Verify against plaintext once,
        // then transparently upgrade to a salted hash below.
        if (existing.password !== password) {
          throw new Error('wrong-password');
        }
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

    // A2: always persist a freshly salted hash — never store the plaintext.
    const passwordSalt = existing?.passwordSalt || (await makeSalt());
    const passwordHash = await hashPassword(password, passwordSalt);
    await AsyncStorage.setItem(
      accountKey,
      JSON.stringify({ ...emailUser, passwordHash, passwordSalt })
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
