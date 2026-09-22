import { applications, architectureKindOf } from "@repo/config";
import { describe, expect, it } from "vite-plus/test";

import { reported } from "./lint-harness.ts";
import { commands, workspaceDirectories } from "./tasks.ts";

const source = "export const value = 1;\n";

const packagesWithSrc = workspaceDirectories.filter((directory) =>
  /^(?:apps|libs|tools|infra)\/[^/]+$/u.test(directory),
);

describe("architecture coverage", () => {
  it("assigns every workspace package to FSD or Modular", () => {
    expect.hasAssertions();
    const kinds = packagesWithSrc.map((directory) => ({
      directory,
      kind: architectureKindOf(directory),
    }));
    expect(kinds.every((entry) => entry.kind === "fsd" || entry.kind === "modular")).toBe(true);
    expect(kinds.filter((entry) => entry.kind === "fsd").map((entry) => entry.directory)).toStrictEqual(
      applications.map((app) => `apps/${app}`).toSorted(),
    );
  });
});

describe("steiger coverage", () => {
  it("runs the layer check in every FSD application", () => {
    expect.hasAssertions();
    const checks = applications
      .map((app) => `apps/${app}: ${commands(`apps/${app}`, "check").join(" ")}`)
      .toSorted();
    expect(checks).toStrictEqual(
      applications
        .map(
          (app) => `apps/${app}: steiger src --fail-on-warnings && quality-check-thin-app-routes`,
        )
        .toSorted(),
    );
  });
});

describe("modular coverage", () => {
  it("runs modular budgets on modular packages", () => {
    expect.hasAssertions();
    const modularPackages = packagesWithSrc
      .filter((directory) => architectureKindOf(directory) === "modular")
      .toSorted();
    const checks = modularPackages.map(
      (directory) => `${directory}: ${commands(directory, "check:modular").join(" ")}`,
    );
    expect(checks.every((line) => line.endsWith(": quality-check-modular"))).toBe(true);
    expect(modularPackages.length).toBeGreaterThan(0);
  });
});

describe("feature-sliced layers", () => {
  it.for([
    "apps/service-member/src/components/legacy.ts",
    "apps/service-member/src/loose.ts",
    "apps/service-admin/src/components/users-page.tsx",
    "apps/service-admin/src/users-search.ts",
    "apps/internal-dashboard/src/lib/source.ts",
    "apps/internal-dashboard/src/start.ts",
  ])("rejects %s outside the layers", (name) => {
    expect.hasAssertions();
    expect(reported("layers", { code: source, filename: name })).toBe(true);
  });

  it.for([
    "apps/service-member/src/app/server.ts",
    "apps/service-member/src/pages/profile/index.ts",
    "apps/service-member/vite.config.ts",
    "apps/service-admin/src/pages/users/ui/users-page.tsx",
    "apps/internal-dashboard/src/shared/content/source.ts",
  ])("allows %s", (name) => {
    expect.hasAssertions();
    expect(reported("layers", { code: source, filename: name })).toBe(false);
  });
});

describe("modular layers", () => {
  it.for([
    "libs/auth/src/loose.ts",
    "libs/auth/src/components/legacy.ts",
    "apps/core/src/worker.ts",
    "tools/dont-review-it/src/cli.ts",
    "infra/cloudflare/src/cli.ts",
  ])("rejects %s outside modular layers", (name) => {
    expect.hasAssertions();
    expect(reported("modular-layers", { code: source, filename: name })).toBe(true);
  });

  it.for([
    "libs/auth/src/features/auth/index.ts",
    "apps/core/src/features/core/worker.ts",
    "tools/dont-review-it/src/features/dont-review-it/cli.ts",
    "infra/cloudflare/src/features/cloudflare/cli.ts",
    "libs/auth/vite.config.ts",
  ])("allows %s", (name) => {
    expect.hasAssertions();
    expect(reported("modular-layers", { code: source, filename: name })).toBe(false);
  });
});

describe("modular imports", () => {
  it("rejects shared importing features", () => {
    expect.hasAssertions();
    expect(
      reported("modular-imports", {
        code: 'import { value } from "../features/auth/index.ts";\n',
        filename: "libs/auth/src/shared/helper.ts",
      }),
    ).toBe(true);
  });

  it("rejects shared importing app", () => {
    expect.hasAssertions();
    expect(
      reported("modular-imports", {
        code: 'import { boot } from "../app/boot.ts";\n',
        filename: "libs/auth/src/shared/helper.ts",
      }),
    ).toBe(true);
  });

  it("allows features importing shared", () => {
    expect.hasAssertions();
    expect(
      reported("modular-imports", {
        code: 'import { helper } from "../../shared/helper.ts";\n',
        filename: "libs/auth/src/features/auth/index.ts",
      }),
    ).toBe(false);
  });
});
