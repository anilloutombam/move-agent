export type DomainErrorCode =
  | "ACTIVE_POLICY_NOT_FOUND"
  | "ADMIN_NOT_FOUND"
  | "CONVERSATION_NOT_FOUND"
  | "FORBIDDEN_REQUEST_TRANSITION"
  | "INVALID_POLICY_CONFIG"
  | "INVALID_REQUEST_TRANSITION"
  | "MOVE_SLOT_FULL"
  | "POLICY_NOT_FOUND"
  | "REQUEST_NOT_EDITABLE"
  | "REQUEST_NOT_FOUND"
  | "REQUEST_NOT_SUBMITTABLE"
  | "REQUEST_VERSION_CONFLICT"
  | "RESIDENT_UNIT_NOT_FOUND";

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    public readonly details?: Record<string, unknown>,
  ) {
    super(code);
    this.name = "DomainError";
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
