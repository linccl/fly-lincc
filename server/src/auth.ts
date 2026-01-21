import crypto from "node:crypto";

import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { AppConfig } from "./config.js";

declare module "fastify" {
  interface FastifyRequest {
    auth?: {
      iat: number;
      exp: number;
    };
  }
}

const loginBodySchema = z.object({
  password: z.string().min(8).max(256)
});

export function registerAuth(app: FastifyInstance, config: AppConfig) {
  const cookieName = config.auth.session.cookieName;

  app.addHook("onRequest", async (req, reply) => {
    if (!(req.url === "/api" || req.url.startsWith("/api/"))) return;
    if (req.url.startsWith("/api/health")) return;
    if (req.url.startsWith("/api/auth/login")) return;
    if (req.url.startsWith("/api/auth/logout")) return;

    const token = req.cookies[cookieName];
    const payload = token ? verifySessionToken(token, config.auth.sessionSecret) : null;
    if (!payload) {
      await reply.code(401).send({ error: "UNAUTHORIZED" });
      return;
    }
    req.auth = payload;
  });

  app.post(
    "/api/auth/login",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: 60_000
        }
      }
    },
    async (req, reply) => {
      const body = loginBodySchema.parse(req.body);
      if (!verifyPassword(body.password, config.auth.passwordHash)) {
        await reply.code(401).send({ error: "INVALID_PASSWORD" });
        return;
      }

      const token = createSessionToken(config.auth.sessionSecret, config.auth.session.ttlDays);
      reply.setCookie(cookieName, token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: config.auth.session.ttlDays * 24 * 60 * 60
      });
      await reply.send({ ok: true });
    }
  );

  app.post("/api/auth/logout", async (_req, reply) => {
    reply.clearCookie(cookieName, { path: "/" });
    await reply.send({ ok: true });
  });

  app.get("/api/auth/me", async () => ({ ok: true }));
}

function createSessionToken(secret: string, ttlDays: number) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + ttlDays * 24 * 60 * 60;
  const payload = Buffer.from(JSON.stringify({ iat, exp })).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifySessionToken(token: string, secret: string) {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;

  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (!safeEqualBase64Url(sig, expected)) return null;

  let data: unknown;
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  const parsed = z
    .object({
      iat: z.number().int().nonnegative(),
      exp: z.number().int().nonnegative()
    })
    .safeParse(data);
  if (!parsed.success) return null;

  if (parsed.data.exp <= Math.floor(Date.now() / 1000)) return null;
  return parsed.data;
}

function safeEqualBase64Url(a: string, b: string) {
  const aBuf = Buffer.from(a, "base64url");
  const bBuf = Buffer.from(b, "base64url");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function verifyPassword(password: string, stored: string) {
  const parts = stored.split("$");
  if (parts.length !== 6) return false;
  const [algorithm, costStr, blockSizeStr, parallelStr, saltB64, keyB64] = parts;
  if (algorithm !== "scrypt") return false;

  const cost = Number.parseInt(costStr, 10);
  const blockSize = Number.parseInt(blockSizeStr, 10);
  const parallelization = Number.parseInt(parallelStr, 10);
  if (!Number.isFinite(cost) || !Number.isFinite(blockSize) || !Number.isFinite(parallelization)) {
    return false;
  }

  let salt: Buffer;
  let key: Buffer;
  try {
    salt = Buffer.from(saltB64, "base64url");
    key = Buffer.from(keyB64, "base64url");
  } catch {
    return false;
  }

  const derived = crypto.scryptSync(password, salt, key.length, {
    cost,
    blockSize,
    parallelization
  });
  return crypto.timingSafeEqual(derived, key);
}
