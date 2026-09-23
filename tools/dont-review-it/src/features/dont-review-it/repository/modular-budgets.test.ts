import { modularBudgets } from "@repo/config";
import { describe, expect, it } from "vite-plus/test";

import { featureFindings, isModularWorkspace, layerBudgetFindings } from "./modular-budgets.ts";

describe("modular budgets", () => {
  it.for([
    ["/repo/tools/dont-review-it", true],
    ["/repo/tools/dont-review-it/src", true],
    ["/home/apps/repo/libs/ui", true],
    ["/repo/apps/internal-dashboard", false],
    ["/repo", false],
  ] as const)("classifies %s as modular: %s", ([cwd, modular]) => {
    expect.hasAssertions();
    expect(isModularWorkspace(cwd)).toBe(modular);
  });

  it("accepts layers within budget", () => {
    expect.hasAssertions();
    expect(
      layerBudgetFindings({ app: modularBudgets.app, shared: modularBudgets.shared }),
    ).toStrictEqual([]);
  });

  it("reports each layer over budget", () => {
    expect.hasAssertions();
    expect(
      layerBudgetFindings({ app: modularBudgets.app + 1, shared: modularBudgets.shared + 1 }),
    ).toStrictEqual([expect.stringMatching(/^app: /u), expect.stringMatching(/^shared: /u)]);
  });

  it("reports loose files and slices without a public API", () => {
    expect.hasAssertions();
    expect(
      featureFindings([
        { directory: true, name: "billing", publicApi: true },
        { directory: false, name: "loose.ts", publicApi: false },
        { directory: true, name: "search", publicApi: false },
      ]),
    ).toStrictEqual([
      "features/loose.ts: place slice code in a directory, not a loose file.",
      "features/search: missing public API index (features/search/index.ts).",
    ]);
  });
});
