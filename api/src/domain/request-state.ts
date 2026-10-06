import type { RequestStatus } from "../generated/prisma/client.js";

const transitions: Record<RequestStatus, readonly RequestStatus[]> = {
  DRAFT: ["COLLECTING_INFORMATION", "CANCELLED"],

  COLLECTING_INFORMATION: [
    "READY_TO_SUBMIT",
    "CANCELLED",
  ],

  READY_TO_SUBMIT: [
    "COLLECTING_INFORMATION",
    "SUBMITTED",
    "CANCELLED",
  ],

  SUBMITTED: ["UNDER_REVIEW"],

  UNDER_REVIEW: [
    "INFO_REQUESTED",
    "APPROVED",
    "REJECTED",
  ],

  INFO_REQUESTED: [
    "UNDER_REVIEW",
    "CANCELLED",
  ],

  APPROVED: [],
  REJECTED: [],
  CANCELLED: [],
};

export function canTransition(
  from: RequestStatus,
  to: RequestStatus,
): boolean {
  return transitions[from].includes(to);
}

export function assertTransition(
  from: RequestStatus,
  to: RequestStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `INVALID_REQUEST_TRANSITION:${from}:${to}`,
    );
  }
}