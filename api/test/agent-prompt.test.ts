import assert from "node:assert/strict";
import test from "node:test";

import { buildAgentPrompt } from "../src/agent/prompt.js";

test("resident prompt reflects the prototype document workflow", () => {
  const prompt = buildAgentPrompt("RESIDENT", {
    actor: {},
    request: {},
    policy: {},
  });

  assert.match(prompt, /does not upload or store document files/i);
  assert.match(prompt, /driving licence/i);
  assert.match(prompt, /canonical IDENTITY_PROOF value/i);
});

test("resident prompt requires requested information to be saved and resubmitted", () => {
  const prompt = buildAgentPrompt("RESIDENT", {
    actor: {},
    request: { status: "INFO_REQUESTED" },
    policy: {},
  });

  assert.match(prompt, /Save the resident's answer in additionalInformation/);
  assert.match(prompt, /confirm submit/);
  assert.match(prompt, /until submit_request succeeds/);
});
