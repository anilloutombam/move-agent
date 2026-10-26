import assert from "node:assert/strict";
import test from "node:test";

import {
  assertActorTransition,
  canTransition,
  residentSubmissionEventType,
  residentSubmissionTarget,
  statusAfterResidentUpdate,
} from "../src/domain/request-state.js";

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

test("resident information edits stay pending until explicit resubmission", () => {
  assert.equal(statusAfterResidentUpdate("INFO_REQUESTED", "PASS"), "INFO_REQUESTED");
  assert.equal(statusAfterResidentUpdate("INFO_REQUESTED", "INCOMPLETE"), "INFO_REQUESTED");
});

test("resident can return requested information directly to admin review", () => {
  assert.equal(residentSubmissionTarget("INFO_REQUESTED"), "UNDER_REVIEW");
  assert.equal(
    residentSubmissionEventType("INFO_REQUESTED"),
    "RESIDENT_INFORMATION_RESUBMITTED",
  );
  assert.doesNotThrow(() =>
    assertActorTransition("RESIDENT", "INFO_REQUESTED", "UNDER_REVIEW"),
  );
});

test("initial submission keeps its existing status-change audit event", () => {
  assert.equal(residentSubmissionEventType("READY_TO_SUBMIT"), undefined);
});

test("resident resubmission does not grant admin decision transitions", () => {
  assert.throws(
    () => assertActorTransition("RESIDENT", "INFO_REQUESTED", "APPROVED"),
    /INVALID_REQUEST_TRANSITION/,
  );
  assert.throws(
    () => residentSubmissionTarget("COLLECTING_INFORMATION"),
    /REQUEST_NOT_SUBMITTABLE/,
  );
});
