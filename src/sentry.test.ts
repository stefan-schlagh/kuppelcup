import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@sentry/react", () => ({
  init: vi.fn(),
  captureException: vi.fn(),
}));

const Sentry = await import("@sentry/react");
const { initSentry, reportError } = await import("./sentry");

describe("initSentry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does nothing without a DSN, even in production", () => {
    vi.stubEnv("PROD", true);
    vi.stubEnv("VITE_SENTRY_DSN", "");
    initSentry();
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it("does nothing outside production, even with a DSN configured", () => {
    vi.stubEnv("PROD", false);
    vi.stubEnv("VITE_SENTRY_DSN", "https://key@o0.ingest.sentry.io/0");
    initSentry();
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it("initializes Sentry when a DSN is set in a production build", () => {
    vi.stubEnv("PROD", true);
    vi.stubEnv("VITE_SENTRY_DSN", "https://key@o0.ingest.sentry.io/0");
    initSentry();
    expect(Sentry.init).toHaveBeenCalledWith({ dsn: "https://key@o0.ingest.sentry.io/0" });
  });
});

describe("reportError", () => {
  it("forwards to Sentry.captureException with the context as extra data", () => {
    vi.clearAllMocks();
    const err = new Error("boom");
    reportError("FirebaseBackend.saveEvent", err);
    expect(Sentry.captureException).toHaveBeenCalledWith(err, { extra: { context: "FirebaseBackend.saveEvent" } });
  });
});
