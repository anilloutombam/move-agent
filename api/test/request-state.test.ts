import assert from "node:assert/strict";
import test from "node:test";

import { assertActorTransition, canTransition } from "../src/domain/request-state.js";

test("resident can submit a ready request", () => {
  assert.doesNotThrow(() => assertActorTransition("RESIDENT", "READY_TO_SUBMIT", "SUBMITTED"));
});

test("resident cannot approve a request", () => {
  assert.throws(
    () => assertActorTransition("RESIDENT", "UNDER_REVIEW", "APPROVED"),
    /FORBIDDEN_REQUEST_TRANSITION/,
  );
});

test("admin can make review decisions but cannot submit for a resident", () => {
  assert.doesNotThrow(() => assertActorTransition("ADMIN", "UNDER_REVIEW", "APPROVED"));
  assert.throws(
    () => assertActorTransition("ADMIN", "READY_TO_SUBMIT", "SUBMITTED"),
    /FORBIDDEN_REQUEST_TRANSITION/,
  );
});

test("information requested can return to information collection", () => {
  assert.equal(canTransition("INFO_REQUESTED", "COLLECTING_INFORMATION"), true);
});
