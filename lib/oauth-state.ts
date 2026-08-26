// CSRF-guard for the OAuth `state` param — a single-server in-memory nonce
// store. Fine for this app's actual scale (one local dev process, one
// operator); would need a real store (Redis, DB row) behind a load balancer
// or multi-instance deployment, but that's not this app's situation.

const pendingStates = new Map<string, { workspaceId: string; provider: string; createdAt: number }>();
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes — plenty for a user to complete the OAuth dialog

function purgeExpired() {
  const now = Date.now();
  for (const [key, value] of pendingStates) {
    if (now - value.createdAt > STATE_TTL_MS) pendingStates.delete(key);
  }
}

export function createOAuthState(workspaceId: string, provider: string): string {
  purgeExpired();
  const state = crypto.randomUUID();
  pendingStates.set(state, { workspaceId, provider, createdAt: Date.now() });
  return state;
}

/** One-time use — consumes the state so a replayed callback can't reuse it. */
export function consumeOAuthState(state: string): { workspaceId: string; provider: string } | null {
  purgeExpired();
  const entry = pendingStates.get(state);
  if (!entry) return null;
  pendingStates.delete(state);
  return { workspaceId: entry.workspaceId, provider: entry.provider };
}
