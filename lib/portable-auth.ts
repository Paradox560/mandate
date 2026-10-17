/** Server-only portable sessions. Ninoo visitors never inherit the Sites owner's workspace. */
export const PORTABLE_COOKIE = 'mandate_session';
const SESSION_MS = 12 * 60 * 60 * 1000;
export type PortableAuthConfig = {secret: string; accessCode?: string; mode: 'code' | 'open'};
export function portableRuntime() {return process.env.MANDATE_RUNTIME === 'node';}
export function portableAuthConfig(): PortableAuthConfig {
  const secret = process.env.MANDATE_SESSION_SECRET || '';
  const mode = process.env.MANDATE_ACCESS_MODE === 'open' ? 'open' : 'code';
  const accessCode = process.env.MANDATE_ACCESS_CODE || '';
  if (secret.length < 32) throw new Error('Set MANDATE_SESSION_SECRET to a random value of at least 32 characters in the server environment.');
  const isFourDigitCode = accessCode.length === 4 && /^[0-9]{4}$/.test(accessCode);
  const isLongCode = accessCode.length >= 12 && accessCode.length <= 128;
  if (mode === 'code' && !isFourDigitCode && !isLongCode) throw new Error('Set MANDATE_ACCESS_CODE to exactly four digits or a demo access code between 12 and 128 characters in the server environment.');
  return {secret, mode, accessCode};
}
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function decode(text: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) throw new Error('Invalid session encoding.');
  return Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
}
async function key(secret: string) {return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign','verify']);}
export async function createPortableSession(config: PortableAuthConfig, now = Date.now()) {
  const id = crypto.randomUUID();
  const payload = encode(new TextEncoder().encode(JSON.stringify({id,expiresAt:now + SESSION_MS})));
  const signature = await crypto.subtle.sign('HMAC', await key(config.secret), new TextEncoder().encode(payload));
  return {token:`${payload}.${encode(new Uint8Array(signature))}`,userId:`ninoo:session:${id}`,maxAge:SESSION_MS / 1000};
}
export async function verifyPortableSession(token: string | undefined, config: PortableAuthConfig, now = Date.now()): Promise<string | null> {
  if (!token || token.length > 1024) return null;
  try {
    const parts = token.split('.'); if (parts.length !== 2) return null;
    if (!await crypto.subtle.verify('HMAC',await key(config.secret),decode(parts[1]),new TextEncoder().encode(parts[0]))) return null;
    const value = JSON.parse(new TextDecoder().decode(decode(parts[0]))) as {id?:unknown;expiresAt?:unknown};
    if (typeof value.id !== 'string' || !/^[a-f0-9-]{36}$/.test(value.id) || typeof value.expiresAt !== 'number' || value.expiresAt <= now || value.expiresAt > now + SESSION_MS) return null;
    return `ninoo:session:${value.id}`;
  } catch {return null;}
}
export function sessionCookie(request: Request) {
  const matches = request.headers.get('cookie')?.split(';').map(part => part.trim()).filter(part => part.startsWith(`${PORTABLE_COOKIE}=`)) || [];
  // A sibling path/domain cookie must not silently choose which account opens.
  return matches.length === 1 ? matches[0].slice(PORTABLE_COOKIE.length + 1) : undefined;
}

/** One-process demo throttle; reserve before asynchronous code verification. */
export class PortableLoginLimiter {
  private failed = 0;
  private pending = 0;
  private startedAt: number | null = null;
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(limit = 20, windowMs = 60_000) {
    this.limit = limit; this.windowMs = windowMs;
  }

  reserve(now = Date.now()): ((failed: boolean) => void) | null {
    if (this.startedAt === null || now - this.startedAt >= this.windowMs || now < this.startedAt) {
      this.failed = 0; this.startedAt = now;
    }
    if (this.failed + this.pending >= this.limit) return null;
    const window = this.startedAt;
    this.pending += 1;
    let released = false;
    return failed => {
      if (released) return;
      released = true; this.pending -= 1;
      if (failed && this.startedAt === window) this.failed += 1;
    };
  }
}
export async function checkAccessCode(input: string, expected: string) {
  const hash = async (value: string) => new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
  const [left,right] = await Promise.all([hash(input),hash(expected)]);
  let difference = 0; for (let i=0;i<left.length;i++) difference |= left[i]^right[i]; return difference === 0;
}
export function safeReturnTo(value: string | null) {
  if (!value?.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/?judge=1';
  const url = new URL(value,'https://local.invalid');
  if (url.origin !== 'https://local.invalid' || url.pathname.startsWith('/access') || url.pathname.startsWith('/api/')) return '/?judge=1';
  return url.pathname + url.search + url.hash;
}
