import assert from "node:assert/strict";
import test from "node:test";

import { DomainError } from "../src/domain/errors.js";
import { executeTool, getToolDefinitions } from "../src/agent/tools.js";

test("resident and administrator receive separate tool sets", () => {
  const residentTools = getToolDefinitions("RESIDENT").map((tool) => tool.name);
  const adminTools = getToolDefinitions("ADMIN").map((tool) => tool.name);

  assert.ok(residentTools.includes("update_request_draft"));
  assert.ok(!residentTools.includes("approve_request"));
  assert.ok(adminTools.includes("approve_request"));
  assert.ok(!adminTools.includes("update_request_draft"));
});

test("a resident cannot invoke an administrator tool", async () => {
  await assert.rejects(
    executeTool(
      { id: "call-1", name: "approve_request", arguments: { expectedVersion: 1 } },
      {
        actor: { userId: "resident-1", communityId: "community-1", role: "RESIDENT" },
        conversationId: "conversation-1",
        requestId: "request-1",
        confirmedAction: "APPROVE",
      },
    ),
    (error) => error instanceof DomainError && error.code === "AGENT_TOOL_NOT_ALLOWED",
  );
});

test("submission is blocked without current-turn confirmation", async () => {
  await assert.rejects(
    executeTool(
      { id: "call-1", name: "submit_request", arguments: { expectedVersion: 1 } },
      {
        actor: { userId: "resident-1", communityId: "community-1", role: "RESIDENT" },
        conversationId: "conversation-1",
        requestId: "request-1",
        confirmedAction: null,
      },
    ),
    (error) => error instanceof DomainError &&
      error.code === "AGENT_ACTION_CONFIRMATION_REQUIRED",
  );
});

test("request-scoped tools require a linked request", async () => {
  await assert.rejects(
    executeTool(
      { id: "call-1", name: "get_move_request", arguments: {} },
      {
        actor: { userId: "resident-1", communityId: "community-1", role: "RESIDENT" },
        conversationId: "conversation-1",
        requestId: null,
        confirmedAction: null,
      },
    ),
    (error) => error instanceof DomainError && error.code === "AGENT_TOOL_NOT_ALLOWED",
  );
});
