import { describe, it, expect, beforeEach, vi } from "vitest";
import { eventUrl } from "./eventUrl";

describe("eventUrl", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      location: { origin: "https://kuppelcup.example", pathname: "/app/" },
    });
  });

  it("builds a shareable link from the current origin + pathname plus ?event=<id>", () => {
    expect(eventUrl("evt-123")).toBe("https://kuppelcup.example/app/?event=evt-123");
  });

  it("percent-encodes characters that aren't safe in a query string", () => {
    expect(eventUrl("evt with space & stuff")).toBe(
      "https://kuppelcup.example/app/?event=evt%20with%20space%20%26%20stuff",
    );
  });
});
