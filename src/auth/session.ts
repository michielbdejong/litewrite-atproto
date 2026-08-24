/**
 * Browser session: a stateless, encrypted HTTP-only cookie (iron-session)
 * holding just the authenticated account DID.
 *
 * We keep no server-side row for the browser session — the cookie is the
 * session. Credential invalidation still works at the token layer: logout (and
 * any forced revocation) calls `client.revoke(did)`, which kills the DPoP
 * tokens in the OAuth session store regardless of any cookie a client holds.
 * The cookie is encrypted and signed, `SameSite=Lax`, and `Secure` in
 * production.
 */

import type { Request, Response } from "express";
import { getIronSession } from "iron-session";
import { env } from "../env.js";

export interface SessionData {
  did?: string;
}

const cookieName = "litewrite_sid";

function sessionOptions() {
  return {
    password: env.oauth.cookieSecret,
    cookieName,
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: env.nodeEnv === "production",
      path: "/",
    },
  };
}

export async function getSession(req: Request, res: Response) {
  return getIronSession<SessionData>(req, res, sessionOptions());
}

/** The authenticated DID for this request, or null if not logged in. */
export async function getSessionDid(req: Request, res: Response): Promise<string | null> {
  const session = await getSession(req, res);
  return session.did ?? null;
}

export async function setSessionDid(req: Request, res: Response, did: string): Promise<void> {
  const session = await getSession(req, res);
  session.did = did;
  await session.save();
}

export async function clearSession(req: Request, res: Response): Promise<void> {
  const session = await getSession(req, res);
  session.destroy();
}
