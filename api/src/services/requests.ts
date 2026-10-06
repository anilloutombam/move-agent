import { prisma } from "../db/prisma.js";
import { assertTransition } from "../domain/request-state.js";
import type {
  MoveType,
  RequestStatus,
} from "../generated/prisma/client.js";
import { evaluatePolicy } from "../policy/engine.js";

type CreateRequestInput = {
  residentId: string;
  communityId: string;
  type: MoveType;
};

type TransitionRequestInput = {
  requestId: string;
  residentId: string;
  communityId: string;
  to: RequestStatus;
  expectedVersion: number;
};

type UpdateDraftInput = {
  requestId: string;
  residentId: string;
  communityId: string;
  expectedVersion: number;
  requestData: {
    moveDate?: string;
    preferredTime?: string;
    vehicleNumber?: string;
    documents?: string[];
  };
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
      throw new Error("RESIDENT_UNIT_NOT_FOUND");
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
      throw new Error("ACTIVE_POLICY_NOT_FOUND");
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
      throw new Error("REQUEST_NOT_FOUND");
    }

    return moveRequest;
  }

  static async transition({
    requestId,
    residentId,
    communityId,
    to,
    expectedVersion,
  }: TransitionRequestInput) {
    return prisma.$transaction(async (tx) => {
      const request = await tx.moveRequest.findFirst({
        where: {
          id: requestId,
          residentId,
          communityId,
        },
      });

      if (!request) {
        throw new Error("REQUEST_NOT_FOUND");
      }

      assertTransition(request.status, to);

      const result = await tx.moveRequest.updateMany({
        where: {
          id: request.id,
          version: expectedVersion,
        },
        data: {
          status: to,
          version: {
            increment: 1,
          },
          ...(to === "SUBMITTED"
            ? {
                submittedAt: new Date(),
              }
            : {}),
        },
      });

      if (result.count !== 1) {
        throw new Error("REQUEST_VERSION_CONFLICT");
      }

      await tx.requestEvent.create({
        data: {
          requestId: request.id,
          type: `STATUS_CHANGED_TO_${to}`,
          actorId: residentId,
          data: {
            from: request.status,
            to,
          },
        },
      });

      return tx.moveRequest.findUniqueOrThrow({
        where: {
          id: request.id,
        },
      });
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
      throw new Error("REQUEST_NOT_FOUND");
    }

    if (
      moveRequest.status !== "DRAFT" &&
      moveRequest.status !== "COLLECTING_INFORMATION"
    ) {
      throw new Error("REQUEST_NOT_EDITABLE");
    }

    if (moveRequest.version !== expectedVersion) {
      throw new Error("REQUEST_VERSION_CONFLICT");
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
      throw new Error("POLICY_NOT_FOUND");
    }

    const policy = policyRecord.config as {
      noticeHours: number;
      movingHours: {
        start: string;
        end: string;
      };
      elevatorBookingRequired: boolean;
      requiredDocuments: {
        MOVE_IN: string[];
        MOVE_OUT: string[];
      };
      maxMovesPerSlot: number;
      adminApprovalRequired: boolean;
    };

    const assessment = evaluatePolicy({
      type: moveRequest.type,
      requestData,
      policy,
    });

    const nextStatus =
      assessment.result === "INCOMPLETE"
        ? "COLLECTING_INFORMATION"
        : "READY_TO_SUBMIT";

    const updated = await tx.moveRequest.updateMany({
      where: {
        id: moveRequest.id,
        version: expectedVersion,
      },
      data: {
        requestData,
        status: nextStatus,
        version: {
          increment: 1,
        },
      },
    });

    if (updated.count !== 1) {
      throw new Error("REQUEST_VERSION_CONFLICT");
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