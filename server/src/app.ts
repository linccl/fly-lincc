import fs from "node:fs";
import path from "node:path";

import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import staticPlugin from "@fastify/static";
import { ZodError } from "zod";

import type { AppConfig } from "./config.js";
import { registerAuth } from "./auth.js";
import { initDb } from "./db.js";
import { registerRecordRoutes } from "./records.js";

export async function createApp(_config: AppConfig) {
  const app = Fastify({
    logger: true
  });

  await app.register(cookie);
  await app.register(rateLimit, { global: false });

  await registerStatic(app);

  await initDb(app, _config);
  registerAuth(app, _config);
  registerRecordRoutes(app);

  app.setErrorHandler(async (err, _req, reply) => {
    if (err instanceof ZodError) {
      await reply.code(400).send({ error: "BAD_REQUEST" });
      return;
    }
    await reply.send(err);
  });

  app.get("/api/health", async () => ({ ok: true }));

  return app;
}

async function registerStatic(app: FastifyInstance) {
  const distDir = path.resolve(process.cwd(), "web", "dist");
  const indexHtml = path.join(distDir, "index.html");
  if (!fs.existsSync(indexHtml)) {
    app.get("/", async (_req, reply) => {
      await reply
        .type("text/plain; charset=utf-8")
        .send('Web not built. Run: "pnpm build" (or "npm run build"), then restart.');
    });
    return;
  }

  await app.register(staticPlugin, { root: distDir });
  app.setNotFoundHandler(async (req, reply) => {
    if (req.url === "/api" || req.url.startsWith("/api/")) {
      await reply.code(404).send({ error: "NOT_FOUND" });
      return;
    }
    // SPA fallback
    await reply.sendFile("index.html");
  });
}
