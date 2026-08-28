import { useCallback, useEffect, useRef, useState } from "react";
import { api, SessionExpiredError } from "../api";
import type { Note } from "../types";

export type SaveState = "idle" | "saving" | "saved" | "error" | "expired";

/** The editor buffer for the open note. `rkey === null` means unsaved-new. */
export interface Draft {
  rkey: string | null;
  title: string;
  text: string;
  /** Original createdAt, preserved across edits (or the new note's creation time). */
  createdAt: string;
}

interface UseNotes {
  notes: Note[];
  loading: boolean;
  listError: string | null;
  draft: Draft | null;
  saveState: SaveState;
  selectNote: (rkey: string) => void;
  newNote: () => void;
  editDraft: (patch: Partial<Pick<Draft, "title" | "text">>) => void;
  removeNote: (rkey: string) => void;
  closeDraft: () => void;
  retrySave: () => void;
  reload: () => void;
}

const AUTOSAVE_MS = 800;
const DRAFT_KEY = "litewrite:draft";

function loadStoredDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

function storeDraft(draft: Draft | null): void {
  try {
    if (draft) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    // storage unavailable (private mode etc.) — non-fatal
  }
}

export function useNotes(): UseNotes {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const draftRef = useRef<Draft | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  draftRef.current = draft;

  const reload = useCallback(() => {
    setLoading(true);
    setListError(null);
    api
      .listNotes()
      .then((res) => setNotes(res.notes))
      .catch((err: unknown) => setListError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
    // Restore an in-progress draft (e.g. after a session-expiry re-login) so
    // typed-but-unsaved text is never lost.
    const stored = loadStoredDraft();
    if (stored) {
      setDraft(stored);
      setSaveState("idle");
    }
  }, [reload]);

  const doSave = useCallback(async () => {
    const current = draftRef.current;
    if (!current) return;
    // Don't create an empty record for a brand-new note that's still blank.
    if (current.rkey === null && current.text.trim() === "" && current.title.trim() === "") {
      return;
    }
    setSaveState("saving");
    try {
      const payload = {
        text: current.text,
        ...(current.title.trim() !== "" ? { title: current.title } : {}),
      };
      if (current.rkey === null) {
        const created = await api.createNote(payload);
        // Adopt the server-assigned rkey without clobbering later keystrokes.
        setDraft((d) => (d ? { ...d, rkey: created.rkey, createdAt: created.createdAt } : d));
        setNotes((list) => [created, ...list]);
      } else {
        const saved = await api.putNote(current.rkey, { ...payload, createdAt: current.createdAt });
        setNotes((list) => list.map((n) => (n.rkey === saved.rkey ? saved : n)));
      }
      setSaveState("saved");
    } catch (err) {
      setSaveState(err instanceof SessionExpiredError ? "expired" : "error");
    }
  }, []);

  const scheduleSave = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void doSave(), AUTOSAVE_MS);
  }, [doSave]);

  const flushPending = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const editDraft = useCallback(
    (patch: Partial<Pick<Draft, "title" | "text">>) => {
      setDraft((d) => {
        if (!d) return d;
        const next = { ...d, ...patch };
        storeDraft(next);
        return next;
      });
      setSaveState("idle");
      scheduleSave();
    },
    [scheduleSave],
  );

  const selectNote = useCallback(
    (rkey: string) => {
      flushPending();
      const note = notes.find((n) => n.rkey === rkey);
      if (!note) return;
      const next: Draft = {
        rkey: note.rkey,
        title: note.title ?? "",
        text: note.text,
        createdAt: note.createdAt,
      };
      setDraft(next);
      storeDraft(null); // only unsaved-new drafts are worth persisting
      setSaveState("idle");
    },
    [notes, flushPending],
  );

  const newNote = useCallback(() => {
    flushPending();
    const next: Draft = { rkey: null, title: "", text: "", createdAt: new Date().toISOString() };
    setDraft(next);
    storeDraft(next);
    setSaveState("idle");
  }, [flushPending]);

  const removeNote = useCallback(
    (rkey: string) => {
      const prev = notes;
      setNotes((list) => list.filter((n) => n.rkey !== rkey)); // optimistic
      if (draftRef.current?.rkey === rkey) {
        setDraft(null);
        storeDraft(null);
      }
      api.deleteNote(rkey).catch((err: unknown) => {
        if (err instanceof SessionExpiredError) setSaveState("expired");
        else setNotes(prev); // rollback on failure
      });
    },
    [notes],
  );

  const closeDraft = useCallback(() => {
    flushPending();
    void doSave(); // best-effort save before closing
    setDraft(null);
    storeDraft(null);
  }, [flushPending, doSave]);

  const retrySave = useCallback(() => void doSave(), [doSave]);

  // Clear the persisted draft once it's safely saved.
  useEffect(() => {
    if (saveState === "saved" && draft && draft.rkey !== null) storeDraft(null);
  }, [saveState, draft]);

  return {
    notes,
    loading,
    listError,
    draft,
    saveState,
    selectNote,
    newNote,
    editDraft,
    removeNote,
    closeDraft,
    retrySave,
    reload,
  };
}
