import { prisma } from "../db/prisma.js";
import { DomainError } from "../domain/errors.js";
import { assertActorTransition, type WorkflowActor } from "../domain/request-state.js";
import type { RequestStatus } from "../generated/prisma/client.js";

export type TransitionInput = {
  requestId: string;
  actorId: string;
  actorRole: WorkflowActor;
  communityId: string;
  to: RequestStatus;
  expectedVersion: number;
  eventType?: string;
  reason?: string;
  decision?: string;
};

export class RequestWorkflowService {
  static async transition(input: TransitionInput) {
    return prisma.$transaction(async (tx) => {
      const actor = await tx.user.findFirst({
        where: {
          id: input.actorId,
          communityId: input.communityId,
          role: input.actorRole,
        },
      });
      if (!actor) {
        throw new DomainError(input.actorRole === "ADMIN" ? "ADMIN_NOT_FOUND" : "REQUEST_NOT_FOUND");
      }

      const request = await tx.moveRequest.findFirst({
        where: {
          id: input.requestId,
          communityId: input.communityId,
          ...(input.actorRole === "RESIDENT" ? { residentId: input.actorId } : {}),
        },
      });
      if (!request) throw new DomainError("REQUEST_NOT_FOUND");

      assertActorTransition(input.actorRole, request.status, input.to);

      const result = await tx.moveRequest.updateMany({
        where: { id: request.id, version: input.expectedVersion },
        data: {
          status: input.to,
          version: { increment: 1 },
          ...(input.to === "SUBMITTED" ? { submittedAt: new Date() } : {}),
        },
      });
      if (result.count !== 1) throw new DomainError("REQUEST_VERSION_CONFLICT");

      if (input.decision) {
        await tx.adminDecision.create({
          data: {
            requestId: request.id,
            adminId: input.actorId,
            decision: input.decision,
            reason: input.reason,
          },
        });
      }

      await tx.requestEvent.create({
        data: {
          requestId: request.id,
          type: input.eventType ?? `STATUS_CHANGED_TO_${input.to}`,
          actorId: input.actorId,
          data: { from: request.status, to: input.to, reason: input.reason },
        },
      });

      return tx.moveRequest.findUniqueOrThrow({ where: { id: request.id } });
    });
  }
}
