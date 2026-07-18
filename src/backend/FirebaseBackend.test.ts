import { describe, it, expect } from "vitest";
import { FirebaseBackend } from "./FirebaseBackend";

// The stub must fail loudly (rather than silently no-op) until it is wired
// up, so a misconfigured BACKEND switch is obvious.
describe("FirebaseBackend (stub)", () => {
  const be = new FirebaseBackend();

  it("has no current account until sign-in is wired up", () => {
    expect(be.auth.currentAccount()).toBeNull();
  });

  it("throws a clear not-configured error for data calls", async () => {
    await expect(be.listEvents("owner-1")).rejects.toThrow(/not configured/i);
    await expect(be.createEvent("Cup", "owner-1")).rejects.toThrow(/not configured/i);
    await expect(be.getEvent("x")).rejects.toThrow(/not configured/i);
  });
});
