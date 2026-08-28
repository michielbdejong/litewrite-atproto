import { useEffect, useState } from "react";
import { api } from "./api";
import type { Profile } from "./types";
import { useNotes } from "./hooks/useNotes";
import { NoteList } from "./components/NoteList";
import { Editor } from "./components/Editor";

type AuthState =
  | { status: "loading" }
  | { status: "anon" }
  | { status: "authed"; profile: Profile };

export function App(): React.JSX.Element {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((profile) => {
        if (!cancelled) setAuth({ status: "authed", profile });
      })
      .catch(() => {
        if (!cancelled) setAuth({ status: "anon" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (auth.status === "loading") {
    return (
      <main className="center">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  if (auth.status === "anon") {
    return <SignIn />;
  }

  return <Workspace profile={auth.profile} />;
}

function SignIn(): React.JSX.Element {
  const [handle, setHandle] = useState("");
  const loginError = new URLSearchParams(window.location.search).get("error");

  function onSubmit(e: React.FormEvent): void {
    e.preventDefault();
    const h = handle.trim();
    if (h) window.location.href = `/login?handle=${encodeURIComponent(h)}`;
  }

  return (
    <main className="center">
      <div className="card signin">
        <h1>litewrite</h1>
        <p className="tagline">
          Distraction-free notes, stored in your own AT Protocol repository.
          <br />
          <strong>Notes are public</strong> — anyone can read them from your repo.
        </p>
        {loginError && (
          <p className="error" role="alert">
            Login didn’t complete ({loginError}). Please try again.
          </p>
        )}
        <form onSubmit={onSubmit} className="login">
          <label htmlFor="handle">Your atproto handle</label>
          <input
            id="handle"
            placeholder="alice.bsky.social"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
          />
          <button type="submit" disabled={!handle.trim()}>
            Sign in
          </button>
        </form>
        <p className="muted">Works with any atproto handle — bsky.social or a self-hosted PDS.</p>
      </div>
    </main>
  );
}

function Workspace({ profile }: { profile: Profile }): React.JSX.Element {
  const notes = useNotes();

  async function onLogout(): Promise<void> {
    await api.logout().catch(() => undefined);
    window.location.href = "/";
  }

  // Preserve the in-progress draft (already mirrored to localStorage by the
  // hook) and re-authenticate; on return the draft is restored.
  function onReauth(): void {
    window.location.href = `/login?handle=${encodeURIComponent(profile.handle)}`;
  }

  const expired = notes.saveState === "expired";

  return (
    <div className={"workspace" + (notes.draft ? " has-open" : "")}>
      <header className="topbar">
        <span className="brand">litewrite</span>
        <span className="spacer" />
        <span className="who muted">@{profile.handle}</span>
        <button type="button" className="linkish" onClick={() => void onLogout()}>
          Log out
        </button>
      </header>

      {expired && (
        <div className="banner" role="alert">
          Your session expired. Your text is safe —
          <button type="button" className="linkish" onClick={onReauth}>
            log in again
          </button>
          to keep writing.
        </div>
      )}

      <div className="panes">
        <NoteList
          notes={notes.notes}
          selectedRkey={notes.draft?.rkey ?? null}
          loading={notes.loading}
          error={notes.listError}
          onSelect={notes.selectNote}
          onNew={notes.newNote}
          onDelete={notes.removeNote}
          onRetry={notes.reload}
        />
        {notes.draft ? (
          <Editor
            draft={notes.draft}
            saveState={notes.saveState}
            onEdit={notes.editDraft}
            onRetry={notes.retrySave}
            onBack={notes.closeDraft}
          />
        ) : (
          <section className="editor empty-editor">
            <p className="muted">Select a note, or start a new one.</p>
          </section>
        )}
      </div>
    </div>
  );
}
