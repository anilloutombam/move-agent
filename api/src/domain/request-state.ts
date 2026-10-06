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
