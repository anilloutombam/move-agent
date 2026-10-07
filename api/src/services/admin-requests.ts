import { prisma } from "../db/prisma.js";
import { DomainError } from "../domain/errors.js";
import type { Prisma, RequestStatus } from "../generated/prisma/client.js";
import { RequestWorkflowService } from "./request-workflow.js";

type AdminAction = "START_REVIEW" | "REQUEST_INFO" | "APPROVE" | "REJECT";

const actionStatus: Record<AdminAction, RequestStatus> = {
  START_REVIEW: "UNDER_REVIEW",
  REQUEST_INFO: "INFO_REQUESTED",
  APPROVE: "APPROVED",
  REJECT: "REJECTED",
};

const adminVisibleStatuses: RequestStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "INFO_REQUESTED",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
];

export class AdminRequestService {
  static async list({
    communityId,
    status,
    page,
    limit,
  }: {
    communityId: string;
    status?: RequestStatus;
    page: number;
    limit: number;
  }) {
    const where: Prisma.MoveRequestWhereInput = {
      communityId,
      status: status ?? { in: adminVisibleStatuses },
    };
    const [items, total] = await prisma.$transaction([
      prisma.moveRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          resident: { select: { id: true, name: true, email: true } },
          unit: { select: { number: true, tower: true } },
          assessments: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      }),
      prisma.moveRequest.count({ where }),
    ]);
    return { items, page, limit, total };
  }

  static async get({ requestId, communityId }: { requestId: string; communityId: string }) {
    const request = await prisma.moveRequest.findFirst({
      where: {
        id: requestId,
        communityId,
        status: { in: adminVisibleStatuses },
      },
      include: {
        resident: { select: { id: true, name: true, email: true } },
        unit: { select: { number: true, tower: true } },
        assessments: { orderBy: { createdAt: "desc" } },
        events: { orderBy: { createdAt: "asc" } },
        adminDecisions: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!request) throw new DomainError("REQUEST_NOT_FOUND");
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
    return RequestWorkflowService.transition({
      requestId,
      communityId,
      actorId: adminId,
      actorRole: "ADMIN",
      expectedVersion,
      to: actionStatus[action],
      eventType: `ADMIN_${action}`,
      reason,
      ...(action === "START_REVIEW" ? {} : { decision: action }),
    });
  }
}
