import type { Note } from "../types";

interface Props {
  notes: Note[];
  selectedRkey: string | null;
  loading: boolean;
  error: string | null;
  onSelect: (rkey: string) => void;
  onNew: () => void;
  onDelete: (rkey: string) => void;
  onRetry: () => void;
}

function preview(note: Note): string {
  const body = note.text.trim().split("\n")[0] ?? "";
  return body.length > 0 ? body : "Empty note";
}

function heading(note: Note): string {
  const t = note.title?.trim();
  return t && t.length > 0 ? t : preview(note);
}

export function NoteList({
  notes,
  selectedRkey,
  loading,
  error,
  onSelect,
  onNew,
  onDelete,
  onRetry,
}: Props): React.JSX.Element {
  return (
    <aside className="notelist">
      <div className="notelist-head">
        <span className="notelist-title">Notes</span>
        <button type="button" className="new-btn" onClick={onNew} aria-label="New note">
          + New
        </button>
      </div>

      {loading && <p className="muted pad">Loading…</p>}

      {error && !loading && (
        <div className="pad">
          <p className="error">Couldn’t load notes.</p>
          <button type="button" className="linkish" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}

      {!loading && !error && notes.length === 0 && (
        <p className="muted pad">No notes yet. Start writing →</p>
      )}

      <ul className="notes">
        {notes.map((note) => (
          <li key={note.rkey}>
            <button
              type="button"
              className={"note-item" + (note.rkey === selectedRkey ? " selected" : "")}
              onClick={() => onSelect(note.rkey)}
            >
              <span className="note-heading">{heading(note)}</span>
              {note.title?.trim() && <span className="note-sub">{preview(note)}</span>}
            </button>
            <button
              type="button"
              className="delete-btn"
              aria-label="Delete note"
              title="Delete note"
              onClick={() => onDelete(note.rkey)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
