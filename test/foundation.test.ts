import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("repository foundation", () => {
  it("runs the TypeScript test environment", () => {
    assert.equal(Number.isFinite(0), true);
  });
});
