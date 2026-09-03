import { describe, expect, it } from "vitest";
import { guessMimeFromUrl, parseResponse } from "../transcribe";

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

describe("parseResponse", () => {
  it("splits transcript and comments when both markers are present", () => {
    const raw = "===TRANSCRIPT===\nSpeaker 1: Hello, I'm interested.\n===COMMENTS===\nQualified — expressed interest.";
    const { transcript, comments } = parseResponse(raw, true);
    expect(transcript).toBe("Speaker 1: Hello, I'm interested.");
    expect(comments).toBe("Qualified — expressed interest.");
  });

  it("returns only the transcript when no context was given (no Comments expected)", () => {
    const raw = "===TRANSCRIPT===\nSpeaker 1: Hello.";
    const { transcript, comments } = parseResponse(raw, false);
    expect(transcript).toBe("Speaker 1: Hello.");
    expect(comments).toBeNull();
  });

  it("falls back to treating the whole response as the transcript when the model didn't use the markers", () => {
    const raw = "Speaker 1: Hello there, no markers here.";
    const { transcript, comments } = parseResponse(raw, true);
    expect(transcript).toBe(raw);
    expect(comments).toBeNull();
  });

  it("does not lose content if a real transcript happens to mention the word 'comments'", () => {
    const raw = "===TRANSCRIPT===\nHe said please leave your comments after the beep.\n===COMMENTS===\nNot enough signal to qualify.";
    const { transcript, comments } = parseResponse(raw, true);
    expect(transcript).toBe("He said please leave your comments after the beep.");
    expect(comments).toBe("Not enough signal to qualify.");
  });
});
