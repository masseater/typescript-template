import { describe, expect, it } from "vite-plus/test";

import {
  architectureKindOf,
  architectureKinds,
  fsdPackages,
  modularBudgets,
  modularLayers,
} from "./architecture.ts";
import { buildTargets } from "./wiki.ts";

describe("architecture kinds", () => {
  it("keeps FSD packages aligned with the built frontends", () => {
    expect.hasAssertions();
    expect([...fsdPackages]).toStrictEqual([...buildTargets]);
  });

  it.for([
    ["apps/service-member", "fsd"],
    ["apps/service-admin", "fsd"],
    ["apps/internal-dashboard", "fsd"],
    ["apps/internal-wiki", "fsd"],
    ["apps/core", "modular"],
    ["libs/auth", "modular"],
    ["tools/dont-review-it", "modular"],
    ["infra/cloudflare", "modular"],
  ] as const)("classifies %s as %s", ([workspacePath, kind]) => {
    expect.hasAssertions();
    expect(architectureKindOf(workspacePath)).toBe(kind);
  });

  it("exposes the modular layer and budget presets", () => {
    expect.hasAssertions();
    expect([...architectureKinds]).toStrictEqual(["fsd", "modular"]);
    expect([...modularLayers]).toStrictEqual(["app", "features", "shared"]);
    expect(modularBudgets).toStrictEqual({ app: 400, shared: 800 });
  });
});
