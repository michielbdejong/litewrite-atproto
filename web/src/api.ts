import type { Note, NoteInput, NoteList, Profile } from "./types";

/** Thrown when the server says the session is gone (401). */
export class SessionExpiredError extends Error {
  constructor() {
    super("session_expired");
    this.name = "SessionExpiredError";
  }
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (res.status === 401) throw new SessionExpiredError();
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string; detail?: string };
      detail = body.detail ?? body.error ?? detail;
    } catch {
      // non-JSON error body; keep the status
    }
    throw new Error(detail);
  }
  // 204/empty bodies parse as undefined.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  me: () => request<Profile>("/api/me"),

  logout: () => request<{ ok: true }>("/api/logout", { method: "POST" }),

  listNotes: () => request<NoteList>("/api/notes"),

  createNote: (input: NoteInput) =>
    request<Note>("/api/notes", { method: "POST", body: JSON.stringify(input) }),

  putNote: (rkey: string, input: NoteInput) =>
    request<Note>(`/api/notes/${encodeURIComponent(rkey)}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),

  deleteNote: (rkey: string) =>
    request<{ ok: true }>(`/api/notes/${encodeURIComponent(rkey)}`, { method: "DELETE" }),
};
