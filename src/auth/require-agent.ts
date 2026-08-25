/**
 * Shared helper: resolve a request to an authenticated `Agent`, or send a 401.
 *
 * Every authenticated API handler funnels through this. If the stored OAuth
 * session can no longer be restored (revoked, or expired beyond refresh), the
 * stale cookie is cleared so the client can show a clean logged-out state
 * instead of looping.
 */

import type { Request, Response } from "express";
import type { NodeOAuthClient } from "@atproto/oauth-client-node";
import { Agent } from "@atproto/api";
import { getSessionDid, clearSession } from "./session.js";

export async function requireAgent(
  client: NodeOAuthClient,
  req: Request,
  res: Response,
): Promise<Agent | null> {
  const did = await getSessionDid(req, res);
  if (!did) {
    res.status(401).json({ error: "not_authenticated" });
    return null;
  }
  try {
    const oauthSession = await client.restore(did);
    return new Agent(oauthSession);
  } catch (err) {
    console.error("[api] session restore failed:", (err as Error).message);
    await clearSession(req, res);
    res.status(401).json({ error: "session_expired" });
    return null;
  }
}
