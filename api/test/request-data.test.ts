import assert from "node:assert/strict";
import test from "node:test";

import {
  moveRequestDataSchema,
  normalizeDocumentType,
} from "../src/domain/request-data.js";

test("resident-friendly identity document names are canonicalized", () => {
  assert.equal(normalizeDocumentType("driving licence"), "IDENTITY_PROOF");
  assert.equal(
    normalizeDocumentType("driving licence (identity proof)"),
    "IDENTITY_PROOF",
  );
  assert.equal(normalizeDocumentType("passport"), "IDENTITY_PROOF");
});

test("request documents are canonicalized and deduplicated", () => {
  const result = moveRequestDataSchema.parse({
    documents: ["driving licence", "IDENTITY_PROOF"],
  });

  assert.deepEqual(result.documents, ["IDENTITY_PROOF"]);
});
