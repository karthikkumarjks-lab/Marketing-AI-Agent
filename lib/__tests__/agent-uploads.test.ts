import { describe, expect, it } from "vitest";
import { AGENT_CATALOG } from "../agent-catalog";
import { EXCEL_UPLOAD_AGENTS, SCREENSHOT_UPLOAD_AGENTS, getUploadType } from "../agent-uploads";

describe("agent upload registry", () => {
  it("every agent listed for upload actually exists in the catalog", () => {
    const catalogKeys = new Set(AGENT_CATALOG.map((a) => a.key));
    const missing = [...EXCEL_UPLOAD_AGENTS, ...SCREENSHOT_UPLOAD_AGENTS].filter((k) => !catalogKeys.has(k));
    expect(missing).toEqual([]);
  });

  it("no agent is registered for both upload types at once", () => {
    const overlap = [...EXCEL_UPLOAD_AGENTS].filter((k) => SCREENSHOT_UPLOAD_AGENTS.has(k));
    expect(overlap).toEqual([]);
  });

  it("getUploadType resolves the correct type and null for an agent with no upload", () => {
    expect(getUploadType("marketing-analytics")).toBe("excel");
    expect(getUploadType("cro")).toBe("screenshot");
    expect(getUploadType("marketing-strategy")).toBeNull();
  });
});
