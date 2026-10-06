import assert from "node:assert/strict";
import test from "node:test";

import { getConfirmedAction } from "../src/agent/confirmation.js";

test("explicit resident confirmations are recognized", () => {
  assert.equal(getConfirmedAction("confirm submit"), "SUBMIT");
  assert.equal(getConfirmedAction("Yes, confirm cancel this request."), "CANCEL");
});

test("explicit administrator confirmations are recognized", () => {
  assert.equal(getConfirmedAction("confirm approve"), "APPROVE");
  assert.equal(getConfirmedAction("confirm reject"), "REJECT");
});

test("ambiguous intent is not treated as confirmation", () => {
  assert.equal(getConfirmedAction("I think this should be approved"), null);
  assert.equal(getConfirmedAction("Can you submit it?"), null);
  assert.equal(getConfirmedAction("submit"), null);
  assert.equal(getConfirmedAction("approve"), null);
  assert.equal(getConfirmedAction("Do not cancel this request"), null);
});
