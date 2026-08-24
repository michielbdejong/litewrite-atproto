/**
 * OAuth routes: the BFF endpoints that drive the login round trip.
 *
 *   GET  /client-metadata.json  — the client metadata document (client_id target)
 *   GET  /jwks.json             — public key set for private_key_jwt
 *   GET  /login?handle=…        — begin authorization, redirect to the PDS
 *   GET  /oauth/callback        — exchange the code, set the session cookie
 *   POST /api/logout            — revoke tokens and clear the cookie
 */

import { Router } from "express";
import type { NodeOAuthClient } from "@atproto/oauth-client-node";
import { setSessionDid, clearSession, getSessionDid } from "../auth/session.js";

export function createOAuthRouter(client: NodeOAuthClient): Router {
  const router = Router();

  router.get("/client-metadata.json", (_req, res) => {
    res.json(client.clientMetadata);
  });

  router.get("/jwks.json", (_req, res) => {
    res.json(client.jwks);
  });

  router.get("/login", async (req, res) => {
    const handle = typeof req.query["handle"] === "string" ? req.query["handle"].trim() : "";
    if (!handle) {
      res.status(400).json({ error: "missing_handle" });
      return;
    }
    try {
      const url = await client.authorize(handle);
      res.redirect(url.toString());
    } catch (err) {
      // Most commonly an unresolvable handle or an unreachable PDS.
      console.error("[oauth] authorize failed:", (err as Error).message);
      res.redirect("/?error=login_failed");
    }
  });

  router.get("/oauth/callback", async (req, res) => {
    try {
      const params = new URLSearchParams(req.url.split("?")[1] ?? "");
      const { session } = await client.callback(params);
      await setSessionDid(req, res, session.did);
      res.redirect("/");
    } catch (err) {
      console.error("[oauth] callback failed:", (err as Error).message);
      res.redirect("/?error=callback_failed");
    }
  });

  router.post("/api/logout", async (req, res) => {
    const did = await getSessionDid(req, res);
    if (did) {
      // Revoke the DPoP tokens server-side so the session can't be restored,
      // then drop the browser cookie. Revocation failure shouldn't block logout.
      try {
        await client.revoke(did);
      } catch (err) {
        console.error("[oauth] revoke failed:", (err as Error).message);
      }
    }
    await clearSession(req, res);
    res.json({ ok: true });
  });

  return router;
}
