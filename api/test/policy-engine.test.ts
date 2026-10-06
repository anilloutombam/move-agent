import assert from "node:assert/strict";
import test from "node:test";

import { evaluatePolicy } from "../src/policy/engine.js";

const policy = {
  noticeHours: 48,
  movingHours: { start: "09:00", end: "18:00" },
  elevatorBookingRequired: true,
  requiredDocuments: { MOVE_IN: ["IDENTITY_PROOF"], MOVE_OUT: ["MOVE_OUT_CLEARANCE"] },
  maxMovesPerSlot: 2,
  adminApprovalRequired: true,
};

test("complete compliant request passes", () => {
  const assessment = evaluatePolicy({
    type: "MOVE_IN",
    requestData: {
      moveDate: "2026-10-10",
      preferredTime: "10:00",
      documents: ["IDENTITY_PROOF"],
      elevatorBookingRequested: true,
    },
    policy,
    now: new Date("2026-10-06T00:00:00Z"),
  });
  assert.equal(assessment.result, "PASS");
});

test("insufficient notice fails", () => {
  const assessment = evaluatePolicy({
    type: "MOVE_IN",
    requestData: {
      moveDate: "2026-10-07",
      preferredTime: "10:00",
      documents: ["IDENTITY_PROOF"],
      elevatorBookingRequested: true,
    },
    policy,
    now: new Date("2026-10-06T00:00:00Z"),
  });
  assert.equal(assessment.result, "FAIL");
});

test("invalid date fails rather than passing notice check", () => {
  const assessment = evaluatePolicy({
    type: "MOVE_IN",
    requestData: {
      moveDate: "not-a-date",
      preferredTime: "10:00",
      documents: ["IDENTITY_PROOF"],
      elevatorBookingRequested: true,
    },
    policy,
    now: new Date("2026-10-06T00:00:00Z"),
  });
  assert.equal(assessment.result, "FAIL");
});

test("required elevator booking remains incomplete until requested", () => {
  const assessment = evaluatePolicy({
    type: "MOVE_IN",
    requestData: {
      moveDate: "2026-10-10",
      preferredTime: "10:00",
      documents: ["IDENTITY_PROOF"],
    },
    policy,
    now: new Date("2026-10-06T00:00:00Z"),
  });
  assert.equal(assessment.result, "INCOMPLETE");
  assert.equal(
    assessment.checks.find((check) => check.name === "ELEVATOR_BOOKING")?.result,
    "INCOMPLETE",
  );
});
