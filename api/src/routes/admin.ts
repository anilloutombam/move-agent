import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { authenticate } from "../auth/authenticate.js";
import { AdminRequestService } from "../services/admin-requests.js";
import { sendDomainError } from "./domain-error.js";

const paramsSchema = z.object({ id: z.string().min(1) });
const querySchema = z.object({
  status: z.enum([
    "DRAFT", "COLLECTING_INFORMATION", "READY_TO_SUBMIT", "SUBMITTED",
    "UNDER_REVIEW", "INFO_REQUESTED", "APPROVED", "REJECTED", "CANCELLED",
  ]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
const actionSchema = z.object({
  expectedVersion: z.number().int().positive(),
  reason: z.string().trim().min(1).max(1000).optional(),
});

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", async (request, reply) => {
    if (request.user.role !== "ADMIN") {
      return reply.code(403).send({ error: "Admin access required" });
    }
  });

  app.get("/requests", async (request, reply) => {
    const query = querySchema.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "Invalid query" });
    return AdminRequestService.list({
      communityId: request.user.communityId,
      status: query.data.status,
      page: query.data.page,
      limit: query.data.limit,
    });
  });

  app.get("/requests/:id", async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "Invalid request ID" });
    try {
      return await AdminRequestService.get({
        requestId: params.data.id,
        communityId: request.user.communityId,
      });
    } catch (error) {
      return sendDomainError(error, reply);
    }
  });

  for (const route of [
    ["review", "START_REVIEW"],
    ["request-info", "REQUEST_INFO"],
    ["approve", "APPROVE"],
    ["reject", "REJECT"],
  ] as const) {
    app.post(`/requests/:id/${route[0]}`, async (request, reply) => {
      const params = paramsSchema.safeParse(request.params);
      const body = actionSchema.safeParse(request.body);
      if (!params.success || !body.success) {
        return reply.code(400).send({ error: "Invalid request" });
      }
      if (["REQUEST_INFO", "REJECT"].includes(route[1]) && !body.data.reason) {
        return reply.code(400).send({ error: "A reason is required for this action" });
      }
      try {
        return await AdminRequestService.act({
          requestId: params.data.id,
          communityId: request.user.communityId,
          adminId: request.user.userId,
          expectedVersion: body.data.expectedVersion,
          action: route[1],
          reason: body.data.reason,
        });
      } catch (error) {
        return sendDomainError(error, reply);
      }
    });
  }
};
