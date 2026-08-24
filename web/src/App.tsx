import { useEffect, useState } from "react";

type HealthState =
  | { status: "loading" }
  | { status: "ok" }
  | { status: "error"; detail: string };

/**
 * M0 placeholder shell. Confirms the frontend builds, mounts, and can reach the
 * BFF (via the health endpoint). The real note list + editor arrive in M3.
 */
export function App(): React.JSX.Element {
  const [health, setHealth] = useState<HealthState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then(() => {
        if (!cancelled) setHealth({ status: "ok" });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setHealth({ status: "error", detail: err instanceof Error ? err.message : String(err) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="shell">
      <h1>litewrite</h1>
      <p className="tagline">Distraction-free notes, stored in your own AT Protocol repository.</p>
      <p className="health" data-status={health.status}>
        {health.status === "loading" && "Checking backend…"}
        {health.status === "ok" && "Backend reachable ✓"}
        {health.status === "error" && `Backend unreachable: ${health.detail}`}
      </p>
    </main>
  );
}
