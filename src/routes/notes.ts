/**
 * Note CRUD for the authenticated user.
 *
 *   GET    /api/notes          — list my notes
 *   POST   /api/notes          — create a note (PDS assigns the rkey/TID)
 *   GET    /api/notes/:rkey     — read one of my notes
 *   PUT    /api/notes/:rkey     — create-or-update a note at rkey
 *   DELETE /api/notes/:rkey     — delete a note
 *
 * The read-only cross-repo reader (any actor's notes) lands in M2.5.
 */

import { Router } from "express";
import type { Request, Response } from "express";
import type { NodeOAuthClient } from "@atproto/oauth-client-node";
import { requireAgent } from "../auth/require-agent.js";
import { createNote, putNote, deleteNote, getNote, listNotes, type NoteInput } from "../notes/repo.js";

/** Validate and extract a note payload from a request body. */
function parseNoteInput(body: unknown): NoteInput | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (typeof b["text"] !== "string") return null;
  if (b["title"] !== undefined && typeof b["title"] !== "string") return null;
  if (b["createdAt"] !== undefined && typeof b["createdAt"] !== "string") return null;
  return {
    text: b["text"],
    ...(typeof b["title"] === "string" ? { title: b["title"] } : {}),
    ...(typeof b["createdAt"] === "string" ? { createdAt: b["createdAt"] } : {}),
  };
}

export function createNotesRouter(client: NodeOAuthClient): Router {
  const router = Router();

  // Any write path can fail lexicon validation (bad input) — surface as 400.
  const asBadRequest = (res: Response, err: unknown): void => {
    console.error("[notes] operation failed:", (err as Error).message);
    res.status(400).json({ error: "invalid_note", detail: (err as Error).message });
  };

  router.get("/", async (req, res) => {
    const agent = await requireAgent(client, req, res);
    if (!agent) return;
    const list = await listNotes(agent, agent.did ?? "");
    res.json(list);
  });

  router.post("/", async (req: Request, res: Response) => {
    const agent = await requireAgent(client, req, res);
    if (!agent) return;
    const input = parseNoteInput(req.body);
    if (!input) {
      res.status(400).json({ error: "invalid_note" });
      return;
    }
    try {
      res.status(201).json(await createNote(agent, agent.did ?? "", input));
    } catch (err) {
      asBadRequest(res, err);
    }
  });

  router.get("/:rkey", async (req, res) => {
    const agent = await requireAgent(client, req, res);
    if (!agent) return;
    const rkey = req.params.rkey;
    if (!rkey) {
      res.status(400).json({ error: "missing_rkey" });
      return;
    }
    const note = await getNote(agent, agent.did ?? "", rkey);
    if (!note) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(note);
  });

  router.put("/:rkey", async (req: Request, res: Response) => {
    const agent = await requireAgent(client, req, res);
    if (!agent) return;
    const rkey = req.params.rkey;
    if (!rkey) {
      res.status(400).json({ error: "missing_rkey" });
      return;
    }
    const input = parseNoteInput(req.body);
    if (!input) {
      res.status(400).json({ error: "invalid_note" });
      return;
    }
    try {
      res.json(await putNote(agent, agent.did ?? "", rkey, input));
    } catch (err) {
      asBadRequest(res, err);
    }
  });

  router.delete("/:rkey", async (req, res) => {
    const agent = await requireAgent(client, req, res);
    if (!agent) return;
    const rkey = req.params.rkey;
    if (!rkey) {
      res.status(400).json({ error: "missing_rkey" });
      return;
    }
    await deleteNote(agent, agent.did ?? "", rkey);
    res.json({ ok: true });
  });

  return router;
}
