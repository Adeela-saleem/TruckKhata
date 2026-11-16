import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as auth from '../platform/auth';
import type { PublicAccount } from '../platform/auth';

type AuthState = {
  user: PublicAccount | null;
  ready: boolean;
  signIn: (email: string, password: string, remember: boolean) => Promise<void>;
  signUp: (input: { name: string; email: string; phone?: string; password: string }) => Promise<void>;
  signOut: () => void;
  update: (changes: { name: string; email: string; phone: string }) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth outside AuthProvider');
  return value;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicAccount | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { auth.currentAccount().then(setUser).finally(() => setReady(true)); }, []);

  const signIn = useCallback(async (email: string, password: string, remember: boolean) => {
    const account = await auth.signIn(email, password);
    auth.saveSession(account.id, remember);
    setUser(account);
  }, []);
  const signUp = useCallback(async (input: { name: string; email: string; phone?: string; password: string }) => {
    const account = await auth.signUp(input);
    auth.saveSession(account.id, true);
    setUser(account);
  }, []);
  const signOut = useCallback(() => { auth.clearSession(); setUser(null); }, []);
  const update = useCallback(async (changes: { name: string; email: string; phone: string }) => {
    if (!user) return;
    setUser(await auth.updateAccount(user.id, changes));
  }, [user]);

  const value = useMemo(() => ({ user, ready, signIn, signUp, signOut, update }), [user, ready, signIn, signUp, signOut, update]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
