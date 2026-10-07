import assert from "node:assert/strict";
import test from "node:test";

import { compactConversationMessages } from "../src/services/conversation-context.js";

test("conversation context keeps only recent user-visible messages", () => {
  const messages = [
    { role: "USER" as const, content: "Old question", metadata: null },
    {
      role: "ASSISTANT" as const,
      content: "I will update the request.",
      metadata: { toolCalls: [{ name: "update_request" }] },
    },
    {
      role: "TOOL" as const,
      content: '{"status":"DRAFT"}',
      metadata: null,
    },
    { role: "ASSISTANT" as const, content: "", metadata: null },
    {
      role: "ASSISTANT" as const,
      content: "The draft was updated.",
      metadata: { provider: "groq" },
    },
    { role: "USER" as const, content: "Thanks", metadata: null },
    {
      role: "ASSISTANT" as const,
      content: "You are welcome.",
      metadata: null,
    },
  ];

  assert.deepEqual(
    compactConversationMessages(messages, 2).map(({ role, content }) => ({
      role,
      content,
    })),
    [
      { role: "USER", content: "Thanks" },
      { role: "ASSISTANT", content: "You are welcome." },
    ],
  );
});
