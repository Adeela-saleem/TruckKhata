import { AppError, newId } from '../core/db/core';
import { idbGet, idbSet } from './idb';

/**
 * Local accounts for a browser-only app. Passwords are never stored: only a PBKDF2 hash
 * with a random salt. This keeps a shared computer's casual users out of the khata; it is
 * not a substitute for server security, since anyone with full access to the browser's
 * storage could still read the data itself.
 */
export type Account = { id: string; name: string; email: string; phone: string | null; salt: string; hash: string; createdAt: string };
export type PublicAccount = Omit<Account, 'salt' | 'hash'>;

const USERS = 'users';
const SESSION = 'tk-session';
const ITERATIONS = 150_000;

const toB64 = (bytes: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromB64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function hashPassword(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: ITERATIONS }, key, 256);
  return toB64(bits);
}

const strip = ({ salt: _s, hash: _h, ...rest }: Account): PublicAccount => rest;
const accounts = async () => (await idbGet<Account[]>('auth', USERS)) ?? [];
const normalEmail = (email: string) => email.trim().toLowerCase();

export async function hasAccounts() {
  return (await accounts()).length > 0;
}

function checkPassword(password: string) {
  if (password.length < 6) throw new AppError('web.auth.errors.shortPassword');
}

export async function signUp(input: { name: string; email: string; phone?: string; password: string }): Promise<PublicAccount> {
  const email = normalEmail(input.email);
  if (!input.name.trim()) throw new AppError('errors.nameRequired');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError('web.auth.errors.badEmail');
  checkPassword(input.password);
  const list = await accounts();
  if (list.some((a) => a.email === email)) throw new AppError('web.auth.errors.emailTaken');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const account: Account = {
    id: newId(), name: input.name.trim(), email, phone: input.phone?.trim() || null,
    salt: toB64(salt), hash: await hashPassword(input.password, salt), createdAt: new Date().toISOString(),
  };
  await idbSet('auth', USERS, [...list, account]);
  return strip(account);
}

export async function signIn(email: string, password: string): Promise<PublicAccount> {
  const found = (await accounts()).find((a) => a.email === normalEmail(email));
  // Same message for an unknown email and a wrong password, so neither is revealed.
  if (!found || (await hashPassword(password, fromB64(found.salt))) !== found.hash) throw new AppError('web.auth.errors.wrongLogin');
  return strip(found);
}

export async function updateAccount(id: string, changes: { name: string; email: string; phone: string }): Promise<PublicAccount> {
  const email = normalEmail(changes.email);
  if (!changes.name.trim()) throw new AppError('errors.nameRequired');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError('web.auth.errors.badEmail');
  const list = await accounts();
  if (list.some((a) => a.email === email && a.id !== id)) throw new AppError('web.auth.errors.emailTaken');
  const next = list.map((a) => (a.id === id ? { ...a, name: changes.name.trim(), email, phone: changes.phone.trim() || null } : a));
  await idbSet('auth', USERS, next);
  return strip(next.find((a) => a.id === id) as Account);
}

export async function changePassword(id: string, current: string, next: string) {
  const list = await accounts();
  const me = list.find((a) => a.id === id);
  if (!me || (await hashPassword(current, fromB64(me.salt))) !== me.hash) throw new AppError('web.auth.errors.wrongPassword');
  checkPassword(next);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await hashPassword(next, salt);
  await idbSet('auth', USERS, list.map((a) => (a.id === id ? { ...a, salt: toB64(salt), hash } : a)));
}

/** "Keep me signed in" survives closing the browser; otherwise the session ends with the tab. */
export function saveSession(id: string, remember: boolean) {
  try {
    (remember ? localStorage : sessionStorage).setItem(SESSION, id);
    (remember ? sessionStorage : localStorage).removeItem(SESSION);
  } catch { /* storage blocked: stays signed in for this page only */ }
}

export function clearSession() {
  try { localStorage.removeItem(SESSION); sessionStorage.removeItem(SESSION); } catch { /* ignore */ }
}

export async function currentAccount(): Promise<PublicAccount | null> {
  let id: string | null = null;
  try { id = localStorage.getItem(SESSION) ?? sessionStorage.getItem(SESSION); } catch { /* ignore */ }
  if (!id) return null;
  const found = (await accounts()).find((a) => a.id === id);
  return found ? strip(found) : null;
}
