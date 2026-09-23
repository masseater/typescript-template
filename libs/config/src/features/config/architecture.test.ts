import { describe, expect, test } from "vite-plus/test";

import { applications } from "./applications.ts";
import {
  architectureKindOf,
  architectureKinds,
  fsdPackages,
  modularBudgets,
  modularLayers,
} from "./architecture.ts";

describe("fsdPackages", () => {
  const it = test.extend("packages", () => fsdPackages);

  it("keeps FSD packages aligned with applications", ({ packages }) => {
    expect(packages).toStrictEqual(applications);
  });
});

describe("architectureKindOf", () => {
  describe.for([
    ["apps/service-member", "fsd"],
    ["apps/service-admin", "fsd"],
    ["apps/internal-dashboard", "fsd"],
    ["apps/core", "modular"],
    ["libs/auth", "modular"],
    ["tools/dont-review-it", "modular"],
    ["infra/cloudflare", "modular"],
  ] as const)("%s", ([workspacePath, expectedArchitecture]) => {
    const it = test.extend("classifiedArchitecture", () => architectureKindOf(workspacePath));

    it(`classifies as ${expectedArchitecture}`, ({ classifiedArchitecture }) => {
      expect(classifiedArchitecture).toBe(expectedArchitecture);
    });
  });
});

describe("modular presets", () => {
  const it = test
    .extend("architectureVocabulary", () => architectureKinds)
    .extend("layers", () => modularLayers)
    .extend("budgets", () => modularBudgets);

  it("exposes the architecture kinds", ({ architectureVocabulary }) => {
    expect(architectureVocabulary).toStrictEqual(["fsd", "modular"]);
  });

  it("exposes the modular layers", ({ layers }) => {
    expect(layers).toStrictEqual(["app", "features", "shared"]);
  });

  it("exposes the modular budgets", ({ budgets }) => {
    expect(budgets).toStrictEqual({ app: 400, shared: 800 });
  });
});
