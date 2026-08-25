/**
 * Note record operations against the user's (or any actor's) atproto repo.
 *
 * All records use our generated lexicon schema (`npm run lexgen`): `noteSchema`
 * gives us `build()` (injects `$type` and validates) for writes and
 * `safeParse()` for validating reads. Records live in the actor's public repo
 * under `com.michielbdejong.litewrite.note`.
 *
 * These helpers take an `Agent` so the same code serves both the authenticated
 * owner (read/write via the OAuth session) and, later, an unauthenticated
 * reader viewing someone else's repo (M2.5).
 */

import type { Agent } from "@atproto/api";
import { l } from "@atproto/lex";
import {
  main as noteSchema,
  $nsid as NOTE_COLLECTION,
  type Main as NoteRecord,
} from "../lexicon/com/michielbdejong/litewrite/note.js";

export { NOTE_COLLECTION };

/** What the API returns to the browser for a single note. */
export interface NoteDTO {
  rkey: string;
  uri: string;
  cid: string | null;
  text: string;
  title: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface NoteInput {
  text: string;
  title?: string;
  /** Preserved across edits; the client sends the note's original createdAt. */
  createdAt?: string;
}

/** at://did/collection/rkey -> rkey */
function rkeyFromUri(uri: string): string {
  return uri.split("/").pop() ?? "";
}

function toDto(uri: string, cid: string | null, record: NoteRecord): NoteDTO {
  return {
    rkey: rkeyFromUri(uri),
    uri,
    cid,
    text: record.text,
    title: record.title ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt ?? null,
  };
}

/**
 * Cast an ISO string to the schema's branded datetime type. The actual value
 * is still validated at runtime by `noteSchema.build`; this only satisfies the
 * compiler (the strings we pass come from `Date#toISOString`).
 */
const asDatetime = (s: string): l.DatetimeString => s as l.DatetimeString;

/**
 * Build and validate a note record, omitting absent optional fields.
 *
 * NB: `build()` only injects `$type` — it does NOT enforce constraints like
 * `maxLength`. So we validate explicitly with `check()`, which throws on invalid
 * input (callers turn that into a 400). We use `check()` rather than the
 * `assert()` assertion-signature form, which trips TS2775 when called on an
 * imported schema. We validate client-side rather than relying on the PDS's
 * `validate` flag because the PDS can't validate our custom lexicon until it's
 * published/resolvable. (See FRICTION.md.)
 */
function buildRecord(input: NoteInput, createdAt: string, updatedAt: string): NoteRecord {
  const record = noteSchema.build({
    text: input.text,
    createdAt: asDatetime(createdAt),
    updatedAt: asDatetime(updatedAt),
    ...(input.title !== undefined && input.title !== "" ? { title: input.title } : {}),
  });
  noteSchema.check(record);
  return record;
}

export async function createNote(agent: Agent, did: string, input: NoteInput): Promise<NoteDTO> {
  const now = new Date().toISOString();
  const record = buildRecord(input, now, now);
  const res = await agent.com.atproto.repo.createRecord({
    repo: did,
    collection: NOTE_COLLECTION,
    record,
    // `validate` left unset: the PDS validates only lexicons it can resolve, and
    // our custom lexicon may not be resolvable yet. We validate in buildRecord().
  });
  return toDto(res.data.uri, res.data.cid, record);
}

export async function putNote(
  agent: Agent,
  did: string,
  rkey: string,
  input: NoteInput,
): Promise<NoteDTO> {
  const now = new Date().toISOString();
  const createdAt = input.createdAt ?? now;
  const record = buildRecord(input, createdAt, now);
  const res = await agent.com.atproto.repo.putRecord({
    repo: did,
    collection: NOTE_COLLECTION,
    rkey,
    record,
    // See createNote: validated client-side in buildRecord() instead.
  });
  return toDto(res.data.uri, res.data.cid, record);
}

export async function deleteNote(agent: Agent, did: string, rkey: string): Promise<void> {
  await agent.com.atproto.repo.deleteRecord({
    repo: did,
    collection: NOTE_COLLECTION,
    rkey,
  });
}

/** Fetch one note. Returns null if the record isn't a valid note. */
export async function getNote(agent: Agent, actor: string, rkey: string): Promise<NoteDTO | null> {
  const res = await agent.com.atproto.repo.getRecord({
    repo: actor,
    collection: NOTE_COLLECTION,
    rkey,
  });
  const parsed = noteSchema.safeParse(res.data.value);
  if (!parsed.success) return null;
  return toDto(res.data.uri, res.data.cid ?? null, parsed.value);
}

export interface NoteList {
  notes: NoteDTO[];
  cursor: string | null;
}

/**
 * List an actor's notes, newest first. Records that don't validate against the
 * lexicon are skipped rather than failing the whole list — anyone can write
 * arbitrary records to their own repo.
 */
export async function listNotes(
  agent: Agent,
  actor: string,
  opts: { limit?: number; cursor?: string } = {},
): Promise<NoteList> {
  const res = await agent.com.atproto.repo.listRecords({
    repo: actor,
    collection: NOTE_COLLECTION,
    limit: opts.limit ?? 100,
    reverse: true,
    ...(opts.cursor ? { cursor: opts.cursor } : {}),
  });

  const notes: NoteDTO[] = [];
  for (const rec of res.data.records) {
    const parsed = noteSchema.safeParse(rec.value);
    if (parsed.success) {
      notes.push(toDto(rec.uri, rec.cid, parsed.value));
    }
  }
  // Newest first by createdAt (TID order ≈ chronological, but be explicit).
  notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { notes, cursor: res.data.cursor ?? null };
}
