import type { FastifyReply } from "fastify";

import { isDomainError } from "../domain/errors.js";

const responses = {
  ACTIVE_POLICY_NOT_FOUND: [409, "No active community policy"],
  ADMIN_NOT_FOUND: [403, "Admin access required"],
  CONVERSATION_NOT_FOUND: [404, "Conversation not found"],
  FORBIDDEN_REQUEST_TRANSITION: [409, "Request action is not allowed in its current state"],
  INVALID_POLICY_CONFIG: [500, "Community policy is invalid"],
  INVALID_REQUEST_TRANSITION: [409, "Request action is not allowed in its current state"],
  MOVE_SLOT_FULL: [409, "The selected move slot is full"],
  POLICY_NOT_FOUND: [409, "Request policy is no longer available"],
  REQUEST_NOT_EDITABLE: [409, "Request can no longer be edited"],
  REQUEST_NOT_FOUND: [404, "Request not found"],
  REQUEST_NOT_SUBMITTABLE: [409, "Request does not currently satisfy submission requirements"],
  REQUEST_VERSION_CONFLICT: [409, "Request was modified. Refresh and try again."],
  RESIDENT_UNIT_NOT_FOUND: [400, "Resident does not have an assigned unit"],
} as const;

export function sendDomainError(error: unknown, reply: FastifyReply) {
  if (!isDomainError(error)) throw error;
  const [status, message] = responses[error.code];
  return reply.code(status).send({ error: message, code: error.code, details: error.details });
}
