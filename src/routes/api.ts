/**
 * Authenticated application API surface that isn't note CRUD.
 * Currently just `/api/me`. Notes live in routes/notes.ts.
 */

import { Router } from "express";
import type { NodeOAuthClient } from "@atproto/oauth-client-node";
import { XRPCError } from "@atproto/api";
import { requireAgent } from "../auth/require-agent.js";
import { clearSession } from "../auth/session.js";

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
