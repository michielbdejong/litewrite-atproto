import type { Draft, SaveState } from "../hooks/useNotes";
import { SaveStatus } from "./SaveStatus";

interface Props {
  draft: Draft;
  saveState: SaveState;
  onEdit: (patch: { title?: string; text?: string }) => void;
  onRetry: () => void;
  onBack: () => void;
}

export function Editor({ draft, saveState, onEdit, onRetry, onBack }: Props): React.JSX.Element {
  return (
    <section className="editor">
      <div className="editor-bar">
        <button type="button" className="back-btn" onClick={onBack} aria-label="Back to list">
          ‹ Notes
        </button>
        <SaveStatus state={saveState} onRetry={onRetry} />
      </div>

      <input
        className="editor-title"
        placeholder="Title"
        value={draft.title}
        onChange={(e) => onEdit({ title: e.target.value })}
        aria-label="Note title"
      />

      <textarea
        className="editor-body"
        placeholder="Start writing…"
        value={draft.text}
        onChange={(e) => onEdit({ text: e.target.value })}
        aria-label="Note body"
        autoFocus
      />
    </section>
  );
}
