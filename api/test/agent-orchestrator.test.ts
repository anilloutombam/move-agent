import assert from "node:assert/strict";
import test from "node:test";

import { isInformationResponseSaved } from "../src/agent/orchestrator.js";

const updateCall = {
  id: "call-1",
  name: "update_request_draft",
  arguments: {
    expectedVersion: 6,
    requestData: { additionalInformation: "4 people" },
  },
};

test("detects a saved response that still requires resident confirmation", () => {
  assert.equal(
    isInformationResponseSaved(updateCall, {
      status: "INFO_REQUESTED",
      requestData: { additionalInformation: "4 people" },
    }),
    true,
  );
});

test("does not request resubmission confirmation for ordinary draft updates", () => {
  assert.equal(
    isInformationResponseSaved(updateCall, {
      status: "READY_TO_SUBMIT",
      requestData: { additionalInformation: "4 people" },
    }),
    false,
  );
});
