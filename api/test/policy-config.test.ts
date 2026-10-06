import assert from "node:assert/strict";
import test from "node:test";

import { DomainError } from "../src/domain/errors.js";
import { parseCommunityPolicy } from "../src/policy/config.js";

test("valid community policy is parsed", () => {
  const policy = parseCommunityPolicy({
    noticeHours: 24,
    movingHours: { start: "09:00", end: "18:00" },
    elevatorBookingRequired: false,
    requiredDocuments: { MOVE_IN: [], MOVE_OUT: [] },
    maxMovesPerSlot: 2,
    adminApprovalRequired: true,
  });
  assert.equal(policy.maxMovesPerSlot, 2);
});

test("invalid policy configuration raises a typed domain error", () => {
  assert.throws(
    () => parseCommunityPolicy({ noticeHours: -1 }),
    (error) => error instanceof DomainError && error.code === "INVALID_POLICY_CONFIG",
  );
});
