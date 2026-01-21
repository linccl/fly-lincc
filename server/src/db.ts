import fs from "node:fs";
import path from "node:path";

import type { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";

import type { AppConfig } from "./config.js";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export async function initDb(app: FastifyInstance, config: AppConfig) {
  const dbFilePath = path.resolve(process.cwd(), config.database.path);
  fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: toSqliteUrl(dbFilePath)
      }
    }
  });

  await prisma.$connect();
  await ensureSchema(prisma);

  app.decorate("prisma", prisma);
  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
}

function toSqliteUrl(dbFilePath: string) {
  const rel = path.relative(process.cwd(), dbFilePath);
  const relPosix = rel.split(path.sep).join("/");
  const normalized = relPosix.startsWith(".") ? relPosix : `./${relPosix}`;
  return `file:${normalized}`;
}

async function ensureSchema(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Record" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "startAt" DATETIME NOT NULL,
      "endAt" DATETIME NOT NULL,
      "action" TEXT,
      "method" TEXT,
      "tool" TEXT,
      "note" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Record_endAt_gt_startAt" CHECK ("endAt" > "startAt")
    );
  `);

  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Record_startAt_idx" ON "Record"("startAt");`
  );
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Record_endAt_idx" ON "Record"("endAt");`);
}

