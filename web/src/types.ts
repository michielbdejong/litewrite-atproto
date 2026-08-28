export interface Profile {
  did: string;
  handle: string;
  displayName: string | null;
  avatar: string | null;
}

export interface Note {
  rkey: string;
  uri: string;
  cid: string | null;
  text: string;
  title: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface NoteList {
  notes: Note[];
  cursor: string | null;
}

/** Fields the client sends when creating or updating a note. */
export interface NoteInput {
  text: string;
  title?: string;
  createdAt?: string;
}
