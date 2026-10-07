import { prisma } from "../db/prisma.js";
import { DomainError } from "../domain/errors.js";
import {
  moveRequestDataSchema,
  type MoveRequestData,
} from "../domain/request-data.js";
import type { MoveType } from "../generated/prisma/client.js";
import { evaluatePolicy } from "../policy/engine.js";
import { parseCommunityPolicy } from "../policy/config.js";
import { RequestWorkflowService } from "./request-workflow.js";

type CreateRequestInput = {
  residentId: string;
  communityId: string;
  type: MoveType;
};

type UpdateDraftInput = {
  requestId: string;
  residentId: string;
  communityId: string;
  expectedVersion: number;
  requestData: MoveRequestData;
};

export class RequestService {
  static async create({
    residentId,
    communityId,
    type,
  }: CreateRequestInput) {
    const resident = await prisma.user.findFirst({
      where: {
        id: residentId,
        communityId,
        role: "RESIDENT",
      },
    });

    if (!resident?.unitId) {
      throw new DomainError("RESIDENT_UNIT_NOT_FOUND");
    }

    const policy = await prisma.communityPolicy.findFirst({
      where: {
        communityId,
        active: true,
      },
      orderBy: {
        version: "desc",
      },
    });

    if (!policy) {
      throw new DomainError("ACTIVE_POLICY_NOT_FOUND");
    }

    return prisma.$transaction(async (tx) => {
      const request = await tx.moveRequest.create({
        data: {
          communityId,
          unitId: resident.unitId!,
          residentId,
          type,
          status: "DRAFT",
          requestData: {},
          configVersion: policy.version,
        },
      });

      await tx.requestEvent.create({
        data: {
          requestId: request.id,
          type: "REQUEST_CREATED",
          actorId: residentId,
          data: {
            moveType: type,
          },
        },
      });

      return request;
    });
  }

  static async listForResident({
    residentId,
    communityId,
  }: {
    residentId: string;
    communityId: string;
  }) {
    return prisma.moveRequest.findMany({
      where: {
        residentId,
        communityId,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        unit: {
          select: {
            number: true,
            tower: true,
          },
        },
      },
    });
  }

  static async getForResident({
    requestId,
    residentId,
    communityId,
  }: {
    requestId: string;
    residentId: string;
    communityId: string;
  }) {
    const moveRequest = await prisma.moveRequest.findFirst({
      where: {
        id: requestId,
        residentId,
        communityId,
      },
      include: {
        unit: {
          select: {
            number: true,
            tower: true,
          },
        },
        assessments: {
          orderBy: {
            createdAt: "desc",
          },
        },
        events: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!moveRequest) {
      throw new DomainError("REQUEST_NOT_FOUND");
    }

    return moveRequest;
  }

  static async submit({
    requestId,
    residentId,
    communityId,
    expectedVersion,
  }: {
    requestId: string;
    residentId: string;
    communityId: string;
    expectedVersion: number;
  }) {
    const request = await prisma.moveRequest.findFirst({
      where: { id: requestId, residentId, communityId },
      include: {
        assessments: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    if (!request) throw new DomainError("REQUEST_NOT_FOUND");

    const latestAssessment = request.assessments[0];
    if (
      request.status !== "READY_TO_SUBMIT" ||
      !latestAssessment ||
      !["PASS", "WARNING"].includes(latestAssessment.result)
    ) {
      throw new DomainError("REQUEST_NOT_SUBMITTABLE");
    }

    const policyRecord = await prisma.communityPolicy.findUnique({
      where: {
        communityId_version: { communityId, version: request.configVersion },
      },
    });
    if (!policyRecord) throw new DomainError("POLICY_NOT_FOUND");
    const policy = parseCommunityPolicy(policyRecord.config);
    const requestData = request.requestData as MoveRequestData;

    if (requestData.moveDate && requestData.preferredTime) {
      const occupied = await prisma.moveRequest.count({
        where: {
          communityId,
          id: { not: requestId },
          status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED"] },
          requestData: {
            path: ["moveDate"],
            equals: requestData.moveDate,
          },
          AND: {
            requestData: {
              path: ["preferredTime"],
              equals: requestData.preferredTime,
            },
          },
        },
      });
      if (occupied >= policy.maxMovesPerSlot) {
        throw new DomainError("MOVE_SLOT_FULL", {
          moveDate: requestData.moveDate,
          preferredTime: requestData.preferredTime,
        });
      }
    }

    return RequestWorkflowService.transition({
      requestId,
      actorId: residentId,
      actorRole: "RESIDENT",
      communityId,
      to: "SUBMITTED",
      expectedVersion,
    });
  }

  static async cancel({
    requestId,
    residentId,
    communityId,
    expectedVersion,
  }: {
    requestId: string;
    residentId: string;
    communityId: string;
    expectedVersion: number;
  }) {
    return RequestWorkflowService.transition({
      requestId,
      actorId: residentId,
      actorRole: "RESIDENT",
      communityId,
      to: "CANCELLED",
      expectedVersion,
    });
  }

  static async updateDraft({
    requestId,
    residentId,
    communityId,
    expectedVersion,
    requestData,
  }: UpdateDraftInput) {
    return prisma.$transaction(async (tx) => {
      const moveRequest = await tx.moveRequest.findFirst({
        where: {
          id: requestId,
          residentId,
          communityId,
        },
      });

    if (!moveRequest) {
      throw new DomainError("REQUEST_NOT_FOUND");
    }

    if (
      moveRequest.status !== "DRAFT" &&
      moveRequest.status !== "COLLECTING_INFORMATION" &&
      moveRequest.status !== "INFO_REQUESTED"
    ) {
      throw new DomainError("REQUEST_NOT_EDITABLE");
    }

    if (moveRequest.version !== expectedVersion) {
      throw new DomainError("REQUEST_VERSION_CONFLICT");
    }

    const policyRecord = await tx.communityPolicy.findUnique({
      where: {
        communityId_version: {
          communityId,
          version: moveRequest.configVersion,
        },
      },
    });

    if (!policyRecord) {
      throw new DomainError("POLICY_NOT_FOUND");
    }

    const policy = parseCommunityPolicy(policyRecord.config);

    const existingData = moveRequest.requestData as UpdateDraftInput["requestData"];
    const mergedRequestData = moveRequestDataSchema.parse({
      ...existingData,
      ...requestData,
    });

    const assessment = evaluatePolicy({
      type: moveRequest.type,
      requestData: mergedRequestData,
      policy,
    });

    const nextStatus =
      assessment.result === "PASS" || assessment.result === "WARNING"
        ? "READY_TO_SUBMIT"
        : "COLLECTING_INFORMATION";

    const updated = await tx.moveRequest.updateMany({
      where: {
        id: moveRequest.id,
        version: expectedVersion,
      },
      data: {
        requestData: mergedRequestData,
        status: nextStatus,
        version: {
          increment: 1,
        },
      },
    });

    if (updated.count !== 1) {
      throw new DomainError("REQUEST_VERSION_CONFLICT");
    }

    await tx.policyAssessment.create({
      data: {
        requestId: moveRequest.id,
        result: assessment.result,
        checks: assessment.checks,
        summary:
          assessment.result === "PASS"
            ? "Request satisfies current community policy"
            : assessment.result === "INCOMPLETE"
              ? "More information is required"
              : "Request requires attention before submission",
      },
    });

    await tx.requestEvent.create({
      data: {
        requestId: moveRequest.id,
        type: "DRAFT_UPDATED",
        actorId: residentId,
        data: {
          policyResult: assessment.result,
          status: nextStatus,
        },
      },
    });

      return tx.moveRequest.findUniqueOrThrow({
        where: {
          id: moveRequest.id,
        },
        include: {
          assessments: {
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
        },
      });
    });
  }
}
