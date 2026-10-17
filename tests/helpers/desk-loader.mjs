// Unit-test boundary only: exercise the real action code without Cloudflare D1.
// node:module register() is supported by the project's Node 22 baseline.
const store = `
export async function readState(key) { return globalThis.__mandateDemoTestStore.read(key); }
export async function saveState(key, state, expected) { return globalThis.__mandateDemoTestStore.save(key, state, expected); }
`;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === '../db/store' && context.parentURL?.endsWith('/lib/desk.ts')) {
    return { url: `data:text/javascript,${encodeURIComponent(store)}`, shortCircuit: true };
  }
  if (specifier.startsWith('.') && context.parentURL?.endsWith('.ts') && !/\.[a-z]+$/i.test(specifier)) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
}
