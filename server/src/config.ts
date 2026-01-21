import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { z } from "zod";

const portSchema = z.number().int().min(1).max(65535);

const configSchema = z.object({
  host: z.string().default("0.0.0.0"),
  port: portSchema.default(3000),
  portFallback: z
    .object({
      enabled: z.boolean().default(true),
      maxAttempts: z.number().int().min(0).max(200).default(20)
    })
    .default({ enabled: true, maxAttempts: 20 }),
  database: z
    .object({
      path: z.string().min(1).default("./data/app.db")
    })
    .default({ path: "./data/app.db" }),
  auth: z
    .object({
      passwordHash: z.string().default(""),
      sessionSecret: z.string().default(""),
      session: z
        .object({
          cookieName: z.string().min(1).default("sd_session"),
          ttlDays: z.number().int().min(1).max(3650).default(30)
        })
        .default({ cookieName: "sd_session", ttlDays: 30 })
    })
    .default({
      passwordHash: "",
      sessionSecret: "",
      session: { cookieName: "sd_session", ttlDays: 30 }
    })
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(): AppConfig {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    const rel = path.relative(process.cwd(), configPath);
    throw new Error(`Missing ${rel}. Run: pnpm set-password (or: npm run set-password)`);
  }

  const raw = fs.readFileSync(configPath, "utf8");
  const json = JSON.parse(raw);
  const config = configSchema.parse(json);

  if (!config.auth.passwordHash) {
    throw new Error("Missing auth.passwordHash. Run: pnpm set-password");
  }
  if (config.auth.sessionSecret.length < 32) {
    throw new Error(
      "Missing auth.sessionSecret. Run: pnpm set-password (it will auto-generate if empty)."
    );
  }

  return config;
}

function getConfigPath() {
  const envPath = process.env.CONFIG_PATH;
  if (envPath) return path.resolve(envPath);
  return path.resolve(process.cwd(), "config", "config.json");
}
