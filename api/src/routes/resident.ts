import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { z } from "zod";

import { authenticate } from "../auth/authenticate.js";
import { RequestService } from "../services/requests.js";

const createRequestSchema = z.object({
  type: z.enum(["MOVE_IN", "MOVE_OUT"]),
});

const requestParamsSchema = z.object({
  id: z.string().min(1),
});

const updateDraftSchema = z.object({
  expectedVersion: z.number().int().positive(),
  requestData: z.object({
    moveDate: z.iso.date().optional(),
    preferredTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
    vehicleNumber: z.string().optional(),
    documents: z.array(z.string()).optional(),
  }),
});

const versionSchema = z.object({
  expectedVersion: z.number().int().positive(),
});

export const residentRoutes: FastifyPluginAsync = async (app) => {
  // Create a new move request
  app.post(
    "/requests",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      if (request.user.role !== "RESIDENT") {
        return reply.code(403).send({
          error: "Resident access required",
        });
      }

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
        if (
          error instanceof Error &&
          error.message === "RESIDENT_UNIT_NOT_FOUND"
        ) {
          return reply.code(400).send({
            error: "Resident does not have an assigned unit",
          });
        }

        if (
          error instanceof Error &&
          error.message === "ACTIVE_POLICY_NOT_FOUND"
        ) {
          return reply.code(409).send({
            error: "No active community policy",
          });
        }

        throw error;
      }
    },
  );

  // List the authenticated resident's requests
  app.get(
    "/requests",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      if (request.user.role !== "RESIDENT") {
        return reply.code(403).send({
          error: "Resident access required",
        });
      }

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
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      if (request.user.role !== "RESIDENT") {
        return reply.code(403).send({
          error: "Resident access required",
        });
      }

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
        if (
          error instanceof Error &&
          error.message === "REQUEST_NOT_FOUND"
        ) {
          return reply.code(404).send({
            error: "Request not found",
          });
        }

        throw error;
      }
    },
  );

  app.patch(
  "/requests/:id/draft",
  {
    preHandler: authenticate,
  },
  async (request, reply) => {
    if (request.user.role !== "RESIDENT") {
      return reply.code(403).send({
        error: "Resident access required",
      });
    }

    const params = requestParamsSchema.safeParse(request.params);
    const body = updateDraftSchema.safeParse(request.body);

    if (!params.success || !body.success) {
      return reply.code(400).send({
        error: "Invalid request",
      });
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
      if (
        error instanceof Error &&
        error.message === "REQUEST_NOT_FOUND"
      ) {
        return reply.code(404).send({
          error: "Request not found",
        });
      }

      if (
        error instanceof Error &&
        error.message === "REQUEST_VERSION_CONFLICT"
      ) {
        return reply.code(409).send({
          error: "Request was modified. Refresh and try again.",
        });
      }

      if (
        error instanceof Error &&
        error.message === "REQUEST_NOT_EDITABLE"
      ) {
        return reply.code(409).send({
          error: "Request can no longer be edited",
        });
      }

      throw error;
    }
  },
  );

  app.post(
    "/requests/:id/submit",
    { preHandler: authenticate },
    async (request, reply) => {
      if (request.user.role !== "RESIDENT") {
        return reply.code(403).send({ error: "Resident access required" });
      }

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
        return handleWorkflowError(error, reply);
      }
    },
  );

  app.post(
    "/requests/:id/cancel",
    { preHandler: authenticate },
    async (request, reply) => {
      if (request.user.role !== "RESIDENT") {
        return reply.code(403).send({ error: "Resident access required" });
      }

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
        return handleWorkflowError(error, reply);
      }
    },
  );
};

function handleWorkflowError(error: unknown, reply: FastifyReply) {
  if (!(error instanceof Error)) throw error;
  if (error.message === "REQUEST_NOT_FOUND") {
    return reply.code(404).send({ error: "Request not found" });
  }
  if (error.message === "REQUEST_VERSION_CONFLICT") {
    return reply.code(409).send({ error: "Request was modified. Refresh and try again." });
  }
  if (error.message === "REQUEST_NOT_SUBMITTABLE") {
    return reply.code(409).send({ error: "Request does not currently satisfy submission requirements" });
  }
  if (error.message.startsWith("INVALID_REQUEST_TRANSITION") || error.message.startsWith("FORBIDDEN_REQUEST_TRANSITION")) {
    return reply.code(409).send({ error: "Request action is not allowed in its current state" });
  }
  throw error;
}
