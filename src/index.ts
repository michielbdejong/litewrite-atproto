/**
 * Server entry point.
 *
 * A single Express process that (in production) serves the built React app as
 * static files and exposes the BFF API on the same origin. Same-origin keeps
 * the session cookie simple and avoids CORS entirely.
 *
 * M0 scaffolding: this wires up config, the database (connection check +
 * migrations), a health endpoint, and static serving of the Vite build. The
 * OAuth routes and note API land in M1/M2.
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import express from "express";
import { env } from "./env.js";
import { assertDbConnection, runMigrations, pool } from "./db.js";
import { createOAuthClient } from "./auth/client.js";
import { createOAuthRouter } from "./routes/oauth.js";
import { createApiRouter } from "./routes/api.js";
import { createNotesRouter } from "./routes/notes.js";

const serverDir = dirname(fileURLToPath(import.meta.url));
// In production the compiled server lives in dist/; the web build is web/dist.
const webDist = join(serverDir, "..", "web", "dist");

async function main(): Promise<void> {
  await assertDbConnection();
  await runMigrations();

  const oauthClient = await createOAuthClient();

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", true); // Heroku terminates TLS at the router.
  app.use(express.json());

  // Liveness/readiness probe: also confirms the DB round-trips.
  app.get("/api/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok" });
    } catch {
      res.status(503).json({ status: "db_unavailable" });
    }
  });

  // OAuth metadata + login round trip, and the authenticated API.
  app.use(createOAuthRouter(oauthClient));
  app.use("/api", createApiRouter(oauthClient));
  app.use("/api/notes", createNotesRouter(oauthClient));

  // Serve the built SPA. In dev, the Vite dev server proxies /api to this
  // process instead (see web/vite.config.ts), so static serving is a no-op.
  app.use(express.static(webDist));

  // SPA fallback: any non-API GET returns index.html so client routing works.
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(join(webDist, "index.html"));
  });

  const server = app.listen(env.port, () => {
    console.log(`[server] listening on ${env.publicUrl} (port ${env.port}, ${env.nodeEnv})`);
  });

  const shutdown = (signal: string): void => {
    console.log(`[server] ${signal} received, shutting down`);
    server.close(() => {
      void pool.end().then(() => process.exit(0));
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err: unknown) => {
  console.error("[server] fatal startup error:", err);
  process.exit(1);
});
