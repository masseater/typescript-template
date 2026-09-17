import { assertEntries, assertPublicSafety, assertSeparation } from "./artifact-policy.ts";
import { describe, expect, it } from "vite-plus/test";
import { loadArtifacts } from "./artifacts.ts";

describe("built artifacts", () => {
  it("built Workers have separate executable entries and gated, client-only assets roots", async () => {
    expect.hasAssertions();
    const pair = await loadArtifacts();
    expect(() => {
      assertEntries(pair);
    }).not.toThrow();
  });

  it("actual user bundles contain no dedicated admin UI, route, gate or database module", async () => {
    expect.hasAssertions();
    const pair = await loadArtifacts();
    expect(() => {
      assertSeparation(pair);
    }).not.toThrow();
  });

  it("actual public assets contain no source maps, private configuration or local secret values", async () => {
    expect.hasAssertions();
    const pair = await loadArtifacts();
    expect(() => {
      assertPublicSafety(pair);
    }).not.toThrow();
  });
});
