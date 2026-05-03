import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext({
  user: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
});

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

  const signIn = async (email, password) => {
    const raw = await AsyncStorage.getItem(MOCK_USER_KEY);
    if (raw) {
      const stored = JSON.parse(raw);
      if (stored.email === email) {
        setUser(stored);
        return { user: stored };
      }
    }
    // Allow any login in mock mode
    const mockUser = { uid: 'mock-uid-' + Date.now(), email };
    await AsyncStorage.setItem(MOCK_USER_KEY, JSON.stringify(mockUser));
    setUser(mockUser);
    return { user: mockUser };
  };

  const signUp = async (email, password) => {
    const mockUser = { uid: 'mock-uid-' + Date.now(), email };
    await AsyncStorage.setItem(MOCK_USER_KEY, JSON.stringify(mockUser));
    setUser(mockUser);
    return { user: mockUser };
  };

  const signOut = async () => {
    await AsyncStorage.removeItem(MOCK_USER_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;
