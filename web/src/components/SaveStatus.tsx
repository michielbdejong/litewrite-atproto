import type { SaveState } from "../hooks/useNotes";

const LABEL: Record<SaveState, string> = {
  idle: "",
  saving: "Saving…",
  saved: "Saved · public",
  error: "Couldn’t save",
  expired: "Session expired",
};

/** Small, unobtrusive save-state indicator. */
export function SaveStatus({ state, onRetry }: { state: SaveState; onRetry: () => void }): React.JSX.Element {
  return (
    <span className="save-status" data-state={state} role="status" aria-live="polite">
      {LABEL[state]}
      {state === "error" && (
        <button type="button" className="linkish" onClick={onRetry}>
          Retry
        </button>
      )}
    </span>
  );
}
