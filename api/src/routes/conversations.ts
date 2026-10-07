import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { authenticate } from "../auth/authenticate.js";
import { ConversationService } from "../services/conversations.js";
import { AgentOrchestrator } from "../agent/orchestrator.js";
import { loadLlmConfig, createLlmProvider, LlmError } from "../llm/index.js";
import { sendDomainError } from "./domain-error.js";

const paramsSchema = z.object({ id: z.string().min(1) });
const createSchema = z.object({ requestId: z.string().min(1).optional() });
const messageSchema = z.object({ content: z.string().trim().min(1).max(8000) });
const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const conversationRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticate);

  app.post("/", async (request, reply) => {
    const body = createSchema.safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ error: "Invalid request" });
    try {
      const conversation = await ConversationService.create(request.user, body.data.requestId);
      return reply.code(201).send(conversation);
    } catch (error) {
      return sendDomainError(error, reply);
    }
  });

  app.get("/", async (request, reply) => {
    const query = paginationSchema.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "Invalid query" });
    return ConversationService.list(request.user, query.data.page, query.data.limit);
  });

  app.get("/:id", async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    const query = paginationSchema.safeParse(request.query);
    if (!params.success || !query.success) {
      return reply.code(400).send({ error: "Invalid request" });
    }
    try {
      return await ConversationService.get(
        request.user,
        params.data.id,
        query.data.page,
        query.data.limit,
      );
    } catch (error) {
      return sendDomainError(error, reply);
    }
  });

  app.post("/:id/messages", async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    const body = messageSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({ error: "Invalid request" });
    }
    try {
      const message = await ConversationService.addUserMessage(
        request.user,
        params.data.id,
        body.data.content,
      );
      return reply.code(201).send(message);
    } catch (error) {
      return sendDomainError(error, reply);
    }
  });

  app.post("/:id/respond", async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    const body = messageSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({ error: "Invalid request" });
    }

    try {
      const orchestrator = new AgentOrchestrator(
        createLlmProvider(loadLlmConfig()),
      );
      return await orchestrator.respond(request.user, params.data.id, body.data.content);
    } catch (error) {
      if (error instanceof LlmError) {
        request.log.error({ code: error.code, status: error.status }, "LLM request failed");
        const isRateLimited = error.status === 429;
        return reply.code(isRateLimited ? 429 : 502).send({
          error: isRateLimited
            ? "The assistant is busy. Please wait a minute and try again."
            : "The assistant is temporarily unavailable. Please try again.",
          code: error.code,
        });
      }
      return sendDomainError(error, reply);
    }
  });
};
