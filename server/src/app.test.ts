import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createApp } from "./app.js";
import type { AppConfig } from "./config.js";

function base64url(buffer: Buffer) {
  return buffer.toString("base64url");
}

function hashPasswordScrypt(password: string) {
  const salt = crypto.randomBytes(16);
  const cost = 16384;
  const blockSize = 8;
  const parallelization = 1;
  const keylen = 32;
  const derivedKey = crypto.scryptSync(password, salt, keylen, {
    cost,
    blockSize,
    parallelization
  });

  return `scrypt$${cost}$${blockSize}$${parallelization}$${base64url(salt)}$${base64url(derivedKey)}`;
}

function buildConfig() {
  const dbFilePath = path.join(os.tmpdir(), `fly-lincc-test-${crypto.randomUUID()}.db`);

  const config: AppConfig = {
    host: "127.0.0.1",
    port: 3000,
    portFallback: { enabled: false, maxAttempts: 1 },
    database: { path: dbFilePath },
    auth: {
      passwordHash: hashPasswordScrypt("test-password"),
      sessionSecret: base64url(crypto.randomBytes(32)),
      session: { cookieName: "sd_session", ttlDays: 1 }
    }
  };

  return config;
}

async function login(app: Awaited<ReturnType<typeof createApp>>) {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { password: "test-password" }
  });
  expect(res.statusCode).toBe(200);

  const setCookie = res.headers["set-cookie"];
  expect(setCookie).toBeTypeOf("string");

  const cookie = String(setCookie).split(";")[0] ?? "";
  expect(cookie).toContain("sd_session=");
  return cookie;
}

describe("app", () => {
  it("blocks unauthenticated access", async () => {
    const app = await createApp(buildConfig());
    await app.ready();
    const res = await app.inject({ method: "GET", url: "/api/records" });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("creates and lists records", async () => {
    const app = await createApp(buildConfig());
    await app.ready();
    const cookie = await login(app);

    const startAt = new Date("2026-01-01T10:00:00.000Z").toISOString();
    const endAt = new Date("2026-01-01T10:30:00.000Z").toISOString();

    const created = await app.inject({
      method: "POST",
      url: "/api/records",
      headers: { cookie },
      payload: { startAt, endAt, action: null, method: null, tool: null, note: null }
    });
    expect(created.statusCode).toBe(201);

    const list = await app.inject({
      method: "GET",
      url: "/api/records?page=1&pageSize=20",
      headers: { cookie }
    });
    expect(list.statusCode).toBe(200);
    const json = list.json() as { total: number };
    expect(json.total).toBe(1);

    await app.close();
  });
});

