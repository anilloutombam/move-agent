import assert from "node:assert/strict";
import test from "node:test";

import { canLinkRequest } from "../src/domain/conversation-access.js";

const request = { communityId: "community-a", residentId: "resident-a" };

test("resident can link a conversation to their own request", () => {
  assert.equal(canLinkRequest("RESIDENT", "resident-a", "community-a", request), true);
});

test("resident cannot link another resident's request", () => {
  assert.equal(canLinkRequest("RESIDENT", "resident-b", "community-a", request), false);
});

test("admin can link a request in their community", () => {
  assert.equal(canLinkRequest("ADMIN", "admin-a", "community-a", request), true);
});

test("admin cannot link a request from another community", () => {
  assert.equal(canLinkRequest("ADMIN", "admin-b", "community-b", request), false);
});
