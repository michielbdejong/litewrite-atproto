/**
 * Authenticated application API surface that isn't note CRUD.
 * Currently just `/api/me`. Notes live in routes/notes.ts.
 */

import { Router } from "express";
import type { NodeOAuthClient } from "@atproto/oauth-client-node";
import { requireAgent } from "../auth/require-agent.js";

export function createApiRouter(client: NodeOAuthClient): Router {
  const router = Router();

  router.get("/me", async (req, res) => {
    const agent = await requireAgent(client, req, res);
    if (!agent) return;
    const did = agent.did ?? "";
    const profile = await agent.getProfile({ actor: did });
    res.json({
      did,
      handle: profile.data.handle,
      displayName: profile.data.displayName ?? null,
      avatar: profile.data.avatar ?? null,
    });
  });

  return router;
}
