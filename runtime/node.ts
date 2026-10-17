import {NodeD1Database} from './node-d1.ts';

let database: NodeD1Database | undefined;

/** Server-only alias for cloudflare:workers in the explicit Ninoo Node build. */
export const env = {
  get DB() { return database ??= new NodeD1Database(); },
  get NICRRON_API_KEY() { return process.env.NICRRON_API_KEY; },
  get NICRRON_MODEL() { return process.env.NICRRON_MODEL; },
  get PRISM_API_KEY() { return process.env.PRISM_API_KEY; },
  get PRISM_PROJECT_ID() { return process.env.PRISM_PROJECT_ID; },
  get PRISM_AGENT_ID() { return process.env.PRISM_AGENT_ID; },
  get PRISM_ENFORCE() { return process.env.PRISM_ENFORCE; },
  get PRISM_HOST() { return process.env.PRISM_HOST; },
};
