import { seededState } from './fixtures.ts';
import type { DeskState, MarketMode, WorkspaceMode } from './types.ts';

/** Storage identifiers are derived only from the authenticated server identity. */
export async function workspaceStorageKey(userId: string, workspace: WorkspaceMode): Promise<string> {
  if (workspace === 'desk') return userId;
  const identity = JSON.stringify(['mandate', 'guided-demo', 1, userId]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity));
  const hash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
  return `mandate:guided-demo:v1:${hash}`;
}

export function workspaceMarketMode(workspace: WorkspaceMode, requested: MarketMode = 'yahoo'): MarketMode {
  if(requested !== 'yahoo') throw new Error('Synthetic replay is retired. Use Yahoo Finance prices.');
  return 'yahoo';
}

/** Run this before any workspace read or provider call. */
export function assertWorkspaceAction(action: string, workspace: WorkspaceMode): void {
  if ((action === 'start_demo' || action === 'demo_sample') && workspace !== 'demo') {
    throw new Error('This action is available only in the guided demo workspace.');
  }
}

export function assertDemoStarted(action: string, workspace: WorkspaceMode, state: DeskState): void {
  if (workspace === 'demo' && action !== 'start_demo' && !state.demoStartedAt) {
    throw new Error('Start the guided demo before running an action. Your main desk is unchanged.');
  }
}

/** Same starting ledger and mandate, without fixtures that look like completed steps. */
export function createDemoState(now = Date.now(), started = false): DeskState {
  const state = seededState(now);
  state.research = [];
  state.orders = [];
  state.audit = [];
  state.integration = { prismLastStatus: 'No demo provider calls yet', knowledgeBaseSynced: false };
  if (started) state.demoStartedAt = new Date(now).toISOString();
  return state;
}

/** The existing store seeds new rows; GET never exposes those fixtures as demo runs. */
export function workspaceState(state: DeskState, workspace: WorkspaceMode): DeskState {
  if (workspace !== 'demo' || state.demoStartedAt) return state;
  const createdAt = Date.parse(state.createdAt);
  return {
    ...createDemoState(Number.isFinite(createdAt) ? createdAt : Date.now()),
    version: state.version,
  };
}
