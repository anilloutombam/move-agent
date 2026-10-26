import type { RequestStatus } from "../generated/prisma/client.js";
import { DomainError } from "./errors.js";

const transitions: Record<RequestStatus, readonly RequestStatus[]> = {
  DRAFT: ["COLLECTING_INFORMATION", "READY_TO_SUBMIT", "CANCELLED"],

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
    "COLLECTING_INFORMATION",
    "READY_TO_SUBMIT",
    "UNDER_REVIEW",
    "CANCELLED",
  ],

  APPROVED: [],
  REJECTED: [],
  CANCELLED: [],
};

export type WorkflowActor = "RESIDENT" | "ADMIN";

const actorTransitions: Record<WorkflowActor, readonly string[]> = {
  RESIDENT: [
    "DRAFT:CANCELLED",
    "COLLECTING_INFORMATION:CANCELLED",
    "READY_TO_SUBMIT:SUBMITTED",
    "READY_TO_SUBMIT:CANCELLED",
    "INFO_REQUESTED:UNDER_REVIEW",
    "INFO_REQUESTED:CANCELLED",
  ],
  ADMIN: [
    "SUBMITTED:UNDER_REVIEW",
    "UNDER_REVIEW:INFO_REQUESTED",
    "UNDER_REVIEW:APPROVED",
    "UNDER_REVIEW:REJECTED",
  ],
};

export function canTransition(
  from: RequestStatus,
  to: RequestStatus,
): boolean {
  return transitions[from].includes(to);
}

export function residentSubmissionTarget(
  from: RequestStatus,
): Extract<RequestStatus, "SUBMITTED" | "UNDER_REVIEW"> {
  if (from === "READY_TO_SUBMIT") return "SUBMITTED";
  if (from === "INFO_REQUESTED") return "UNDER_REVIEW";
  throw new DomainError("REQUEST_NOT_SUBMITTABLE");
}

export function residentSubmissionEventType(
  from: RequestStatus,
): "RESIDENT_INFORMATION_RESUBMITTED" | undefined {
  return from === "INFO_REQUESTED"
    ? "RESIDENT_INFORMATION_RESUBMITTED"
    : undefined;
}

export function statusAfterResidentUpdate(
  from: RequestStatus,
  policyResult: "INCOMPLETE" | "PASS" | "WARNING" | "FAIL",
): RequestStatus {
  // Keep an administrator's information request open while the resident edits.
  // Confirmation, not an individual field update, returns it to review.
  if (from === "INFO_REQUESTED") return "INFO_REQUESTED";

  return policyResult === "PASS" || policyResult === "WARNING"
    ? "READY_TO_SUBMIT"
    : "COLLECTING_INFORMATION";
}

export function assertTransition(
  from: RequestStatus,
  to: RequestStatus,
): void {
  if (!canTransition(from, to)) {
    throw new DomainError("INVALID_REQUEST_TRANSITION", { from, to });
  }
}

export function assertActorTransition(
  actor: WorkflowActor,
  from: RequestStatus,
  to: RequestStatus,
): void {
  assertTransition(from, to);

  if (!actorTransitions[actor].includes(`${from}:${to}`)) {
    throw new DomainError("FORBIDDEN_REQUEST_TRANSITION", { actor, from, to });
  }
}
