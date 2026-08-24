import { useEffect, useState } from "react";

interface Profile {
  did: string;
  handle: string;
  displayName: string | null;
  avatar: string | null;
}

type AuthState =
  | { status: "loading" }
  | { status: "anon" }
  | { status: "authed"; profile: Profile };

/**
 * M1 shell: proves the OAuth round trip end to end. Logged out, it shows a
 * handle login form; logged in, it renders the profile fetched from the PDS via
 * the BFF. The note list + editor replace this in M3.
 */
export function App(): React.JSX.Element {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [handle, setHandle] = useState("");
  const loginError = new URLSearchParams(window.location.search).get("error");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) {
          setAuth({ status: "authed", profile: (await res.json()) as Profile });
        } else {
          setAuth({ status: "anon" });
        }
      })
      .catch(() => {
        if (!cancelled) setAuth({ status: "anon" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function onLogin(e: React.FormEvent): void {
    e.preventDefault();
    const h = handle.trim();
    if (h) window.location.href = `/login?handle=${encodeURIComponent(h)}`;
  }

  async function onLogout(): Promise<void> {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <main className="shell">
      <header className="masthead">
        <h1>litewrite</h1>
        <p className="tagline">
          Distraction-free notes, stored in your own AT Protocol repository.
          <br />
          <strong>Notes are public</strong> — anyone can read them from your repo.
        </p>
      </header>

      {auth.status === "loading" && <p className="muted">Loading…</p>}

      {auth.status === "anon" && (
        <section className="card">
          <h2>Sign in</h2>
          {loginError && (
            <p className="error" role="alert">
              Login didn’t complete ({loginError}). Please try again.
            </p>
          )}
          <form onSubmit={onLogin} className="login">
            <label htmlFor="handle">Your atproto handle</label>
            <input
              id="handle"
              name="handle"
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
          <p className="muted">
            Works with any atproto handle — bsky.social or a self-hosted PDS.
          </p>
        </section>
      )}

      {auth.status === "authed" && (
        <section className="card">
          <div className="profile">
            {auth.profile.avatar && (
              <img className="avatar" src={auth.profile.avatar} alt="" width={48} height={48} />
            )}
            <div>
              <div className="display-name">{auth.profile.displayName ?? auth.profile.handle}</div>
              <div className="muted">@{auth.profile.handle}</div>
            </div>
          </div>
          <p className="muted did">{auth.profile.did}</p>
          <button type="button" onClick={() => void onLogout()}>
            Log out
          </button>
        </section>
      )}
    </main>
  );
}
