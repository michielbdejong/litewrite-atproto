/**
 * Unit tests for the note repo helper — the record build/validate/map logic.
 *
 * These run offline against a mock Agent (no PDS): they lock in the subtle
 * bits — `build()` injects `$type` but does NOT enforce constraints (we call
 * `check()` for that), createdAt is preserved across edits while updatedAt is
 * bumped, and invalid records are skipped when listing.
 *
 * Run with: npm run test:unit
 * The live PDS round trip is covered by the Playwright suite (M5).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import type { Agent } from "@atproto/api";
import { createNote, putNote, listNotes, NOTE_COLLECTION } from "../src/notes/repo.js";

interface Captured {
  repo: string;
  collection: string;
  rkey?: string;
  record: { $type: string; text: string; title?: string; createdAt: string; updatedAt?: string };
}

/** A mock Agent that records the repo calls it receives. */
function mockAgent(captured: Captured[]): Agent {
  const agent = {
    com: {
      atproto: {
        repo: {
          createRecord: async (input: Captured) => {
            captured.push(input);
            return { data: { uri: `at://${input.repo}/${input.collection}/rkey${captured.length}`, cid: `cid${captured.length}` } };
          },
          putRecord: async (input: Captured) => {
            captured.push(input);
            return { data: { uri: `at://${input.repo}/${input.collection}/${input.rkey}`, cid: "cidput" } };
          },
          listRecords: async ({ repo, collection }: { repo: string; collection: string }) => ({
            data: {
              records: [
                { uri: `at://${repo}/${collection}/aaa`, cid: "c1", value: { $type: collection, text: "older", createdAt: "2020-01-01T00:00:00.000Z" } },
                { uri: `at://${repo}/${collection}/bbb`, cid: "c2", value: { $type: collection, text: "newer", createdAt: "2024-01-01T00:00:00.000Z" } },
                { uri: `at://${repo}/${collection}/junk`, cid: "c3", value: { $type: collection, foo: "no text" } },
              ],
              cursor: null,
            },
          }),
        },
      },
    },
  };
  return agent as unknown as Agent;
}

const DID = "did:plc:test123";

test("createNote injects $type, sets timestamps, maps DTO", async () => {
  const captured: Captured[] = [];
  const dto = await createNote(mockAgent(captured), DID, { text: "hello", title: "Hi" });
  assert.equal(NOTE_COLLECTION, "com.michielbdejong.litewrite.note");
  assert.equal(captured[0]?.record.$type, NOTE_COLLECTION);
  assert.equal(captured[0]?.record.text, "hello");
  assert.equal(captured[0]?.record.title, "Hi");
  assert.ok(captured[0]?.record.createdAt);
  assert.ok(captured[0]?.record.updatedAt);
  assert.equal(dto.rkey, "rkey1");
});

test("createNote rejects an invalid record (over-long text)", async () => {
  await assert.rejects(() => createNote(mockAgent([]), DID, { text: "a".repeat(100001) }));
});

test("putNote preserves createdAt and bumps updatedAt", async () => {
  const captured: Captured[] = [];
  const orig = "2019-05-05T05:05:05.000Z";
  const dto = await putNote(mockAgent(captured), DID, "myrkey", { text: "edited", createdAt: orig });
  assert.equal(captured[0]?.record.createdAt, orig);
  assert.ok((captured[0]?.record.updatedAt ?? "") > orig);
  assert.equal(dto.rkey, "myrkey");
});

test("listNotes skips invalid records and sorts newest-first", async () => {
  const { notes } = await listNotes(mockAgent([]), DID);
  assert.equal(notes.length, 2);
  assert.equal(notes[0]?.text, "newer");
  assert.equal(notes[1]?.text, "older");
});
