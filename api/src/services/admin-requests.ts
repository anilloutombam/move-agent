import { prisma } from "../db/prisma.js";
import { assertActorTransition } from "../domain/request-state.js";
import type { RequestStatus } from "../generated/prisma/client.js";

type AdminAction = "START_REVIEW" | "REQUEST_INFO" | "APPROVE" | "REJECT";

const actionStatus: Record<AdminAction, RequestStatus> = {
  START_REVIEW: "UNDER_REVIEW",
  REQUEST_INFO: "INFO_REQUESTED",
  APPROVE: "APPROVED",
  REJECT: "REJECTED",
};

export class AdminRequestService {
  static async list({
    communityId,
    status,
  }: {
    communityId: string;
    status?: RequestStatus;
  }) {
    return prisma.moveRequest.findMany({
      where: { communityId, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
      include: {
        resident: { select: { id: true, name: true, email: true } },
        unit: { select: { number: true, tower: true } },
        assessments: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
  }

  static async get({ requestId, communityId }: { requestId: string; communityId: string }) {
    const request = await prisma.moveRequest.findFirst({
      where: { id: requestId, communityId },
      include: {
        resident: { select: { id: true, name: true, email: true } },
        unit: { select: { number: true, tower: true } },
        assessments: { orderBy: { createdAt: "desc" } },
        events: { orderBy: { createdAt: "asc" } },
        adminDecisions: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!request) throw new Error("REQUEST_NOT_FOUND");
    return request;
  }

  static async act({
    requestId,
    communityId,
    adminId,
    expectedVersion,
    action,
    reason,
  }: {
    requestId: string;
    communityId: string;
    adminId: string;
    expectedVersion: number;
    action: AdminAction;
    reason?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const admin = await tx.user.findFirst({
        where: { id: adminId, communityId, role: "ADMIN" },
      });
      if (!admin) throw new Error("ADMIN_NOT_FOUND");

      const request = await tx.moveRequest.findFirst({
        where: { id: requestId, communityId },
      });
      if (!request) throw new Error("REQUEST_NOT_FOUND");

      const to = actionStatus[action];
      assertActorTransition("ADMIN", request.status, to);

      const updated = await tx.moveRequest.updateMany({
        where: { id: request.id, version: expectedVersion },
        data: { status: to, version: { increment: 1 } },
      });
      if (updated.count !== 1) throw new Error("REQUEST_VERSION_CONFLICT");

      if (action !== "START_REVIEW") {
        await tx.adminDecision.create({
          data: { requestId: request.id, adminId, decision: action, reason },
        });
      }

      await tx.requestEvent.create({
        data: {
          requestId: request.id,
          type: `ADMIN_${action}`,
          actorId: adminId,
          data: { from: request.status, to, reason },
        },
      });

      return tx.moveRequest.findUniqueOrThrow({ where: { id: request.id } });
    });
  }
}
