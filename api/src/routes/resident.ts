import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { authenticate } from "../auth/authenticate.js";
import { moveRequestDataSchema } from "../domain/request-data.js";
import { RequestService } from "../services/requests.js";
import { sendDomainError } from "./domain-error.js";

const createRequestSchema = z.object({
  type: z.enum(["MOVE_IN", "MOVE_OUT"]),
});

const requestParamsSchema = z.object({
  id: z.string().min(1),
});

const updateDraftSchema = z.object({
  expectedVersion: z.number().int().positive(),
  requestData: moveRequestDataSchema,
});

const versionSchema = z.object({
  expectedVersion: z.number().int().positive(),
});

export const residentRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", async (request, reply) => {
    if (request.user.role !== "RESIDENT") {
      return reply.code(403).send({ error: "Resident access required" });
    }
  });

  // Create a new move request
  app.post(
    "/requests",
    async (request, reply) => {
      const parsed = createRequestSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: "Invalid request",
          details: parsed.error.flatten(),
        });
      }

      try {
        const moveRequest = await RequestService.create({
          residentId: request.user.userId,
          communityId: request.user.communityId,
          type: parsed.data.type,
        });

        return reply.code(201).send(moveRequest);
      } catch (error) {
        return sendDomainError(error, reply);
      }
    },
  );

  // List the authenticated resident's requests
  app.get(
    "/requests",
    async (request, reply) => {
      const requests = await RequestService.listForResident({
        residentId: request.user.userId,
        communityId: request.user.communityId,
      });

      return reply.send(requests);
    },
  );

  // Get one request belonging to the authenticated resident
  app.get(
    "/requests/:id",
    async (request, reply) => {
      const parsedParams = requestParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.code(400).send({
          error: "Invalid request ID",
        });
      }

      try {
        const moveRequest = await RequestService.getForResident({
          requestId: parsedParams.data.id,
          residentId: request.user.userId,
          communityId: request.user.communityId,
        });

        return reply.send(moveRequest);
      } catch (error) {
        return sendDomainError(error, reply);
      }
    },
  );

  app.patch(
    "/requests/:id/draft",
    async (request, reply) => {
      const params = requestParamsSchema.safeParse(request.params);
      const body = updateDraftSchema.safeParse(request.body);

      if (!params.success || !body.success) {
        return reply.code(400).send({ error: "Invalid request" });
      }

      try {
        const result = await RequestService.updateDraft({
          requestId: params.data.id,
          residentId: request.user.userId,
          communityId: request.user.communityId,
          expectedVersion: body.data.expectedVersion,
          requestData: body.data.requestData,
        });
        return reply.send(result);
      } catch (error) {
        return sendDomainError(error, reply);
      }
    },
  );

  app.post(
    "/requests/:id/submit",
    async (request, reply) => {
      const params = requestParamsSchema.safeParse(request.params);
      const body = versionSchema.safeParse(request.body);
      if (!params.success || !body.success) {
        return reply.code(400).send({ error: "Invalid request" });
      }

      try {
        return await RequestService.submit({
          requestId: params.data.id,
          residentId: request.user.userId,
          communityId: request.user.communityId,
          expectedVersion: body.data.expectedVersion,
        });
      } catch (error) {
        return sendDomainError(error, reply);
      }
    },
  );

  app.post(
    "/requests/:id/cancel",
    async (request, reply) => {
      const params = requestParamsSchema.safeParse(request.params);
      const body = versionSchema.safeParse(request.body);
      if (!params.success || !body.success) {
        return reply.code(400).send({ error: "Invalid request" });
      }

      try {
        return await RequestService.cancel({
          requestId: params.data.id,
          residentId: request.user.userId,
          communityId: request.user.communityId,
          expectedVersion: body.data.expectedVersion,
        });
      } catch (error) {
        return sendDomainError(error, reply);
      }
    },
  );
};
