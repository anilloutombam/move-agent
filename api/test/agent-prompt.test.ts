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
