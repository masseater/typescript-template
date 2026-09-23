import { describe, expect, it } from "vite-plus/test";

import { applications } from "./applications.ts";
import {
  architectureKindOf,
  architectureKinds,
  fsdPackages,
  modularBudgets,
  modularLayers,
} from "./architecture.ts";

describe("architecture kinds", () => {
  it("keeps FSD packages aligned with applications", () => {
    expect.hasAssertions();
    expect([...fsdPackages]).toStrictEqual([...applications]);
  });

  it.for([
    ["apps/service-member", "fsd"],
    ["apps/service-admin", "fsd"],
    ["apps/internal-dashboard", "fsd"],
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
