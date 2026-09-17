import { expect, test } from "vitest";
import { loadArtifacts, assertEntries, assertSeparation, assertPublicSafety } from "./artifacts.ts";

test("built Workers have separate executable entries and gated, client-only assets roots", async () => {
  const pair = await loadArtifacts();
  expect(() => assertEntries(pair)).not.toThrow();
});

test("actual user bundles contain no dedicated admin UI, route, gate or database module", async () => {
  const pair = await loadArtifacts();
  expect(() => assertSeparation(pair)).not.toThrow();
});

test("actual public assets contain no source maps, private configuration or local secret values", async () => {
  const pair = await loadArtifacts();
  expect(() => assertPublicSafety(pair)).not.toThrow();
});
