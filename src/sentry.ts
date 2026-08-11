import * as Sentry from "@sentry/react";

// Opt-in error reporting: only active with a DSN configured (VITE_SENTRY_DSN,
// see .env.example) and in production builds, so local dev/CI/e2e never
// send anything and never need a DSN. Once initialized, Sentry's browser
// SDK auto-captures uncaught errors and unhandled promise rejections
// app-wide, on top of the explicit reportError() calls below.
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn || !import.meta.env.PROD) return;
  Sentry.init({ dsn });
}

// Report an error Sentry wouldn't catch on its own — e.g. one that's been
// caught and turned into a generic, user-safe message before it reaches the
// UI (see FirebaseBackend's `logged()`). No-ops safely if Sentry was never
// initialized (no DSN / non-prod build).
export function reportError(context: string, error: unknown): void {
  Sentry.captureException(error, { extra: { context } });
}
