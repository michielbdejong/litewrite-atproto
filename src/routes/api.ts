/**
 * Authenticated application API. In M1 this is just `/api/me`; note CRUD lands
 * in M2. Every handler resolves the DID from the session cookie, restores the
 * OAuth session, and talks to the PDS through an `Agent` (which handles DPoP
 * and token refresh transparently).
 */

import { Router } from "express";
import type { Request, Response } from "express";
import type { NodeOAuthClient } from "@atproto/oauth-client-node";
import { Agent, XRPCError } from "@atproto/api";
import { getSessionDid, clearSession } from "../auth/session.js";

/**
 * Resolve the current request to an authenticated `Agent`, or send a 401 and
 * return null. If the stored OAuth session can no longer be restored (revoked
 * or expired beyond refresh), the stale cookie is cleared so the client can
 * present a clean logged-out state instead of looping.
 */
async function requireAgent(
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

export function createApiRouter(client: NodeOAuthClient): Router {
  const router = Router();

  router.get("/me", async (req, res) => {
    const agent = await requireAgent(client, req, res);
    if (!agent) return;
    const did = agent.did ?? "";
    let profile;
    try {
      profile = await agent.getProfile({ actor: did });
    } catch (err) {
      // A 401/403 here (e.g. ScopeMissingError) means the stored session was
      // granted under a scope that no longer covers this call — refreshing
      // the access token won't fix it, only a fresh /login will. Clear the
      // session so the client re-prompts instead of retrying forever, and
      // don't let this fall through as an unhandled rejection: an async
      // Express handler that throws crashes the whole process (Express 4
      // doesn't catch async errors), taking the app down for every user over
      // one stale session (see issue #8).
      if (err instanceof XRPCError && (err.status === 401 || err.status === 403)) {
        console.error("[api] insufficient session scope:", err.message);
        await clearSession(req, res);
        res.status(401).json({ error: "session_expired" });
        return;
      }
      console.error("[api] profile fetch failed:", (err as Error).message);
      res.status(502).json({ error: "profile_unavailable" });
      return;
    }
    res.json({
      did,
      handle: profile.data.handle,
      displayName: profile.data.displayName ?? null,
      avatar: profile.data.avatar ?? null,
    });
  });

  return router;
}
