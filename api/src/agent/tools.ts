import { z } from "zod";

import { DomainError } from "../domain/errors.js";
import { moveRequestDataSchema } from "../domain/request-data.js";
import type { UserRole } from "../generated/prisma/client.js";
import type { JsonValue, LlmToolCall, LlmToolDefinition } from "../llm/types.js";
import { AdminRequestService } from "../services/admin-requests.js";
import { ConversationService } from "../services/conversations.js";
import { RequestService } from "../services/requests.js";
import type { ConfirmedAction } from "./confirmation.js";

type Actor = { userId: string; communityId: string; role: UserRole };
type ToolContext = {
  actor: Actor;
  conversationId: string;
  requestId: string | null;
  confirmedAction: ConfirmedAction;
};

type ToolSpec = {
  roles: UserRole[];
  definition: LlmToolDefinition;
  schema: z.ZodType;
  execute: (input: any, context: ToolContext) => Promise<unknown>;
  confirmation?: Exclude<ConfirmedAction, null>;
  requiresLinkedRequest?: boolean;
};

const requestStatuses = [
  "DRAFT", "COLLECTING_INFORMATION", "READY_TO_SUBMIT", "SUBMITTED",
  "UNDER_REVIEW", "INFO_REQUESTED", "APPROVED", "REJECTED", "CANCELLED",
] as const;

const specs: Record<string, ToolSpec> = {
  create_move_request: {
    roles: ["RESIDENT"],
    definition: {
      name: "create_move_request",
      description: "Create and link a new move-in or move-out request when this conversation has no request.",
      inputSchema: {
        type: "object",
        properties: { type: { type: "string", enum: ["MOVE_IN", "MOVE_OUT"] } },
        required: ["type"],
      },
    },
    schema: z.object({ type: z.enum(["MOVE_IN", "MOVE_OUT"]) }),
    execute: async ({ type }, context) => {
      if (context.requestId) throw new DomainError("AGENT_TOOL_NOT_ALLOWED");
      const request = await RequestService.create({
        residentId: context.actor.userId,
        communityId: context.actor.communityId,
        type,
      });
      await ConversationService.linkRequest(context.actor, context.conversationId, request.id);
      return request;
    },
  },
  get_move_request: {
    roles: ["RESIDENT"],
    definition: {
      name: "get_move_request",
      description: "Get the resident's request, policy assessments, and audit events linked to this conversation.",
      inputSchema: { type: "object", properties: {} },
    },
    schema: z.object({}),
    requiresLinkedRequest: true,
    execute: (_input, context) => RequestService.getForResident({
      requestId: context.requestId!,
      residentId: context.actor.userId,
      communityId: context.actor.communityId,
    }),
  },
  update_request_draft: {
    roles: ["RESIDENT"],
    definition: {
      name: "update_request_draft",
      description: "Update provided fields in the request draft. Use only information explicitly supplied by the resident.",
      inputSchema: {
        type: "object",
        properties: {
          expectedVersion: { type: "integer", minimum: 1 },
          requestData: {
            type: "object",
            properties: {
              moveDate: { type: "string", format: "date" },
              preferredTime: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
              vehicleNumber: { type: "string" },
              documents: { type: "array", items: { type: "string" } },
              elevatorBookingRequested: { type: "boolean" },
            },
          },
        },
        required: ["expectedVersion", "requestData"],
      },
    },
    schema: z.object({
      expectedVersion: z.number().int().positive(),
      requestData: moveRequestDataSchema,
    }),
    requiresLinkedRequest: true,
    execute: ({ expectedVersion, requestData }, context) => RequestService.updateDraft({
      requestId: context.requestId!,
      residentId: context.actor.userId,
      communityId: context.actor.communityId,
      expectedVersion,
      requestData,
    }),
  },
  submit_request: residentAction("SUBMIT", "Submit the linked request after explicit resident confirmation.",
    (context, expectedVersion) => RequestService.submit({
      requestId: context.requestId!, residentId: context.actor.userId,
      communityId: context.actor.communityId, expectedVersion,
    })),
  cancel_request: residentAction("CANCEL", "Cancel the linked request after explicit resident confirmation.",
    (context, expectedVersion) => RequestService.cancel({
      requestId: context.requestId!, residentId: context.actor.userId,
      communityId: context.actor.communityId, expectedVersion,
    })),
  list_review_requests: {
    roles: ["ADMIN"],
    definition: {
      name: "list_review_requests",
      description: "List move requests in the administrator's community.",
      inputSchema: {
        type: "object",
        properties: {
          status: { type: "string", enum: [...requestStatuses] },
          page: { type: "integer", minimum: 1 },
          limit: { type: "integer", minimum: 1, maximum: 20 },
        },
      },
    },
    schema: z.object({
      status: z.enum(requestStatuses).optional(),
      page: z.number().int().positive().default(1),
      limit: z.number().int().min(1).max(20).default(10),
    }),
    execute: ({ status, page, limit }, context) => AdminRequestService.list({
      communityId: context.actor.communityId, status, page, limit,
    }),
  },
  get_review_context: {
    roles: ["ADMIN"],
    definition: {
      name: "get_review_context",
      description: "Get complete review context for the request linked to this conversation.",
      inputSchema: { type: "object", properties: {} },
    },
    schema: z.object({}),
    requiresLinkedRequest: true,
    execute: (_input, context) => AdminRequestService.get({
      requestId: context.requestId!, communityId: context.actor.communityId,
    }),
  },
  start_request_review: adminAction("START_REVIEW", "Start reviewing the linked submitted request."),
  request_more_information: adminAction(
    "REQUEST_INFO",
    "Request specific additional information from the resident.",
    true,
  ),
  approve_request: adminAction("APPROVE", "Approve the linked request after explicit administrator confirmation."),
  reject_request: adminAction(
    "REJECT",
    "Reject the linked request with a reason after explicit administrator confirmation.",
    true,
  ),
};

function residentAction(
  action: "SUBMIT" | "CANCEL",
  description: string,
  execute: (context: ToolContext, expectedVersion: number) => Promise<unknown>,
): ToolSpec {
  return {
    roles: ["RESIDENT"],
    definition: {
      name: `${action.toLowerCase()}_request`,
      description,
      inputSchema: {
        type: "object",
        properties: { expectedVersion: { type: "integer", minimum: 1 } },
        required: ["expectedVersion"],
      },
    },
    schema: z.object({ expectedVersion: z.number().int().positive() }),
    requiresLinkedRequest: true,
    confirmation: action,
    execute: ({ expectedVersion }, context) => execute(context, expectedVersion),
  };
}

function adminAction(
  action: "START_REVIEW" | "REQUEST_INFO" | "APPROVE" | "REJECT",
  description: string,
  reasonRequired = false,
): ToolSpec {
  const names = {
    START_REVIEW: "start_request_review",
    REQUEST_INFO: "request_more_information",
    APPROVE: "approve_request",
    REJECT: "reject_request",
  } as const;
  return {
    roles: ["ADMIN"],
    definition: {
      name: names[action],
      description,
      inputSchema: {
        type: "object",
        properties: {
          expectedVersion: { type: "integer", minimum: 1 },
          reason: { type: "string", minLength: 1, maxLength: 1000 },
        },
        required: reasonRequired ? ["expectedVersion", "reason"] : ["expectedVersion"],
      },
    },
    schema: z.object({
      expectedVersion: z.number().int().positive(),
      reason: reasonRequired
        ? z.string().trim().min(1).max(1000)
        : z.string().trim().min(1).max(1000).optional(),
    }),
    requiresLinkedRequest: true,
    confirmation: action === "APPROVE" || action === "REJECT" ? action : undefined,
    execute: ({ expectedVersion, reason }, context) => AdminRequestService.act({
      requestId: context.requestId!, communityId: context.actor.communityId,
      adminId: context.actor.userId, expectedVersion, action, reason,
    }),
  };
}

export function getToolDefinitions(role: UserRole): LlmToolDefinition[] {
  return Object.values(specs).filter((spec) => spec.roles.includes(role)).map((spec) => spec.definition);
}

export async function executeTool(call: LlmToolCall, context: ToolContext): Promise<JsonValue> {
  const spec = specs[call.name];
  if (!spec || !spec.roles.includes(context.actor.role)) {
    throw new DomainError("AGENT_TOOL_NOT_ALLOWED", { tool: call.name });
  }
  if (spec.requiresLinkedRequest && !context.requestId) {
    throw new DomainError("AGENT_TOOL_NOT_ALLOWED", { tool: call.name, reason: "NO_LINKED_REQUEST" });
  }
  if (spec.confirmation && context.confirmedAction !== spec.confirmation) {
    throw new DomainError("AGENT_ACTION_CONFIRMATION_REQUIRED", { action: spec.confirmation });
  }

  const parsed = spec.schema.safeParse(call.arguments);
  if (!parsed.success) {
    throw new DomainError("AGENT_TOOL_INVALID", {
      tool: call.name,
      issues: parsed.error.issues,
    });
  }

  const result = await spec.execute(parsed.data, context);
  return JSON.parse(JSON.stringify(result)) as JsonValue;
}
