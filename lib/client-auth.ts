export type AuthRecovery = {href: string; portable: boolean; label: string};

/** Rebuild known authentication destinations; never navigate to API-provided URLs. */
export function authenticationRecovery(status: number, body: unknown, currentPath: string): AuthRecovery | null {
  if (status !== 401 || !body || typeof body !== 'object') return null;
  const result = body as {authRequired?: unknown; signInUrl?: unknown};
  if (result.authRequired !== true || typeof result.signInUrl !== 'string') return null;
  const base = 'https://mandate.local';
  if (!result.signInUrl.startsWith('/') || result.signInUrl.startsWith('//') || result.signInUrl.includes('\\')) return null;
  let endpoint: URL;
  try { endpoint = new URL(result.signInUrl, base); } catch { return null; }
  if (endpoint.origin !== base || !['/access', '/signin-with-chatgpt'].includes(endpoint.pathname)) return null;
  let returnTo = '/';
  if (currentPath.startsWith('/') && !currentPath.startsWith('//') && !currentPath.includes('\\')) {
    try {
      const current = new URL(currentPath, base);
      if (current.origin === base && !/^\/(access|signin-with-chatgpt|signout-with-chatgpt|callback|api)(\/|$)/.test(current.pathname)) returnTo = current.pathname + current.search + current.hash;
    } catch { /* An invalid return path goes to the desk. */ }
  }
  const portable = endpoint.pathname === '/access';
  return {
    href: `${endpoint.pathname}?${portable ? 'returnTo' : 'return_to'}=${encodeURIComponent(returnTo)}`,
    portable,
    label: portable ? 'Open workspace' : 'Sign in with ChatGPT',
  };
}
