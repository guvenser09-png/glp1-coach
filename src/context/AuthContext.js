import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

const AuthContext = createContext({
  user: null,
  loading: true,
  signOut: async () => {},
  signInWithEmail: async () => {},
  resendConfirmation: async () => {},
});

// Build the app-facing user shape from a Supabase auth user.
// displayName comes from user_metadata.name, else the email prefix.
function mapUser(authUser) {
  if (!authUser) return null;
  const email = authUser.email || '';
  const metaName =
    authUser.user_metadata && authUser.user_metadata.name
      ? String(authUser.user_metadata.name).trim()
      : '';
  const displayName = metaName || (email ? email.split('@')[0] : 'User');
  return {
    uid: authUser.id,
    email,
    displayName,
  };
}

// Map raw Supabase auth errors to short, friendly codes the UI can switch on.
// Bilingual user-facing wording lives in the screens; we throw stable codes.
function friendlyAuthError(error) {
  const msg = String((error && error.message) || error || '').toLowerCase();
  if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
    return new Error('wrong-password');
  }
  if (
    msg.includes('already registered') ||
    msg.includes('already exists') ||
    msg.includes('user already')
  ) {
    return new Error('email-exists');
  }
  if (msg.includes('email not confirmed') || msg.includes('not confirmed')) {
    return new Error('confirm-email');
  }
  if (msg.includes('invalid email') || msg.includes('email address')) {
    return new Error('invalid-email');
  }
  if (msg.includes('password')) {
    // e.g. "Password should be at least 6 characters"
    return new Error('weak-password');
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return new Error('network-error');
  }
  return new Error((error && error.message) || 'auth-error');
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // If Supabase isn't configured, don't hang on the splash — just resolve.
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    // Initial session check: hydrate the user, then flip loading off.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setUser(mapUser(data && data.session ? data.session.user : null));
        setLoading(false);
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });

    // Keep the user in sync with sign-in / sign-out / token refresh.
    let subscription = null;
    try {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!mounted) return;
        setUser(mapUser(session ? session.user : null));
        setLoading(false);
      });
      subscription = data ? data.subscription : null;
    } catch (e) {
      // Never let auth-listener setup crash startup.
    }

    return () => {
      mounted = false;
      try {
        if (subscription) subscription.unsubscribe();
      } catch (e) {
        // ignore
      }
    };
  }, []);

  const signOut = async () => {
    try {
      if (isSupabaseConfigured()) {
        await supabase.auth.signOut();
      }
    } catch (e) {
      // Even if the network call fails, clear local user so the UI returns to login.
    } finally {
      setUser(null);
    }
  };

  // Resend the signup confirmation email for an address that registered but
  // hasn't confirmed yet. Surfaces a coded error the UI can show to the user.
  const resendConfirmation = async (email) => {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail) {
      throw new Error('missing-credentials');
    }
    if (!isSupabaseConfigured()) {
      throw new Error('auth-unavailable');
    }
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: cleanEmail,
    });
    if (error) throw friendlyAuthError(error);
    return { ok: true };
  };

  // Email sign-up / sign-in via Supabase Auth.
  // If `name` is provided -> sign up (new account). Otherwise -> sign in.
  const signInWithEmail = async (email, password, name) => {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !password) {
      throw new Error('missing-credentials');
    }
    if (!isSupabaseConfigured()) {
      throw new Error('auth-unavailable');
    }

    const wantsSignUp = !!(name && String(name).trim());

    try {
      if (wantsSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { data: { name: String(name).trim() } },
        });
        if (error) throw friendlyAuthError(error);

        // Some projects already have this email but unconfirmed: supabase-js
        // returns a user with an empty identities array and no session.
        if (
          data &&
          data.user &&
          Array.isArray(data.user.identities) &&
          data.user.identities.length === 0
        ) {
          throw new Error('email-exists');
        }

        // Email-confirmation enabled -> no session until the user confirms.
        if (!data || !data.session) {
          throw new Error('confirm-email');
        }

        const mapped = mapUser(data.session.user);
        setUser(mapped);
        return { user: mapped };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (error) throw friendlyAuthError(error);
      if (!data || !data.session) {
        throw new Error('auth-error');
      }
      const mapped = mapUser(data.session.user);
      setUser(mapped);
      return { user: mapped };
    } catch (e) {
      // Re-throw typed/coded errors as-is; wrap anything unexpected.
      if (e instanceof Error && e.message) throw e;
      throw new Error('auth-error');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut, signInWithEmail, resendConfirmation }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;
