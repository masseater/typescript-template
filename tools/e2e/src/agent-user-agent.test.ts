import { describe, expect, it } from "vite-plus/test";

import { agentUserAgent } from "./agent-user-agent.ts";
import { browserHeaders } from "./client-address.ts";

describe("AI エージェント User-Agent", () => {
  it("dashboard の client-kind 分類と互換なトークンを送る", () => {
    expect(agentUserAgent).toContain("AI-Agent/playwright");
    expect(agentUserAgent.toLowerCase()).toContain("cursor");
    expect(browserHeaders()["user-agent"]).toBe(agentUserAgent);
  });
});
