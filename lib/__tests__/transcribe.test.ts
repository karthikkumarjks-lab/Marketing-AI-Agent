import { describe, expect, it } from "vitest";
import { guessMimeFromUrl } from "../transcribe";

describe("guessMimeFromUrl", () => {
  it("detects common audio extensions", () => {
    expect(guessMimeFromUrl("https://example.com/call.mp3")).toBe("audio/mpeg");
    expect(guessMimeFromUrl("https://example.com/call.wav")).toBe("audio/wav");
    expect(guessMimeFromUrl("https://example.com/call.m4a")).toBe("audio/mp4");
    expect(guessMimeFromUrl("https://example.com/call.ogg")).toBe("audio/ogg");
  });

  it("strips a query string before checking the extension", () => {
    expect(guessMimeFromUrl("https://cdn.example.com/recordings/call.mp3?sig=abc123&exp=999")).toBe("audio/mpeg");
  });

  it("is case-insensitive", () => {
    expect(guessMimeFromUrl("https://example.com/call.MP3")).toBe("audio/mpeg");
  });

  it("returns null for an unrecognized or missing extension", () => {
    expect(guessMimeFromUrl("https://example.com/call")).toBeNull();
    expect(guessMimeFromUrl("https://example.com/page.html")).toBeNull();
  });
});
