import type { FastifyInstance } from "fastify";
import { z } from "zod";

const MAX_PAGE_SIZE = 100;

const recordBodySchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  action: z.string().max(100).optional().nullable(),
  method: z.string().max(100).optional().nullable(),
  tool: z.string().max(100).optional().nullable(),
  note: z.string().max(2000).optional().nullable()
});

const recordIdSchema = z.object({
  id: z.coerce.number().int().positive()
});

const listQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20)
});

export function registerRecordRoutes(app: FastifyInstance) {
  app.get("/api/records", async (req) => {
    const query = listQuerySchema.parse(req.query);
    const where =
      query.from || query.to
        ? {
            startAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lt: new Date(query.to) } : {})
            }
          }
        : {};

    const skip = (query.page - 1) * query.pageSize;
    const take = query.pageSize;

    const [total, items] = await Promise.all([
      app.prisma.record.count({ where }),
      app.prisma.record.findMany({
        where,
        orderBy: { startAt: "desc" },
        skip,
        take
      })
    ]);

    return {
      page: query.page,
      pageSize: query.pageSize,
      total,
      items
    };
  });

  app.get("/api/records/:id", async (req, reply) => {
    const params = recordIdSchema.parse(req.params);
    const record = await app.prisma.record.findUnique({ where: { id: params.id } });
    if (!record) {
      await reply.code(404).send({ error: "NOT_FOUND" });
      return;
    }
    return record;
  });

  app.post("/api/records", async (req, reply) => {
    const body = recordBodySchema.parse(req.body);
    const startAt = new Date(body.startAt);
    const endAt = new Date(body.endAt);
    if (!(startAt < endAt)) {
      await reply.code(400).send({ error: "INVALID_TIME_RANGE" });
      return;
    }

    const created = await app.prisma.record.create({
      data: {
        startAt,
        endAt,
        action: normalizeOptionalText(body.action),
        method: normalizeOptionalText(body.method),
        tool: normalizeOptionalText(body.tool),
        note: normalizeOptionalText(body.note)
      }
    });

    await reply.code(201).send(created);
  });

  app.put("/api/records/:id", async (req, reply) => {
    const params = recordIdSchema.parse(req.params);
    const body = recordBodySchema.parse(req.body);
    const startAt = new Date(body.startAt);
    const endAt = new Date(body.endAt);
    if (!(startAt < endAt)) {
      await reply.code(400).send({ error: "INVALID_TIME_RANGE" });
      return;
    }

    const updated = await app.prisma.record.updateMany({
      where: { id: params.id },
      data: {
        startAt,
        endAt,
        action: normalizeOptionalText(body.action),
        method: normalizeOptionalText(body.method),
        tool: normalizeOptionalText(body.tool),
        note: normalizeOptionalText(body.note)
      }
    });

    if (updated.count === 0) {
      await reply.code(404).send({ error: "NOT_FOUND" });
      return;
    }

    const record = await app.prisma.record.findUnique({ where: { id: params.id } });
    await reply.send(record);
  });

  app.delete("/api/records/:id", async (req, reply) => {
    const params = recordIdSchema.parse(req.params);
    const deleted = await app.prisma.record.deleteMany({ where: { id: params.id } });
    if (deleted.count === 0) {
      await reply.code(404).send({ error: "NOT_FOUND" });
      return;
    }
    await reply.send({ ok: true });
  });
}

function normalizeOptionalText(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

