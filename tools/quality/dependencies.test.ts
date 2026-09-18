import {
  applicationDependencyViolations,
  retiredDependencyViolations,
  rootOnlyDependencyViolations,
  rootOnlyPackages,
  workspaceManifests,
} from "./dependencies.ts";
import { describe, expect, it } from "vite-plus/test";
import { retiredPackages } from "./retired-packages.ts";

describe("application package boundaries", () => {
  it.for(["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"])(
    "rejects a workspace that declares an application package in %s",
    (key) => {
      expect.hasAssertions();
      const violations = applicationDependencyViolations([
        { area: "apps", file: "apps/user/package.json", manifest: { name: "@repo/user" } },
        {
          area: "apps",
          file: "apps/batch/package.json",
          manifest: { [key]: { "@repo/user": "workspace:*" }, name: "@repo/batch" },
        },
        {
          area: "libs",
          file: "libs/domain/package.json",
          manifest: { [key]: { "@repo/db": "workspace:*" }, name: "@repo/domain" },
        },
      ]);
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatch(
        /^apps\/batch\/package\.json: @repo\/user はデプロイ単位のアプリです。/u,
      );
    },
  );

  it("repository workspaces share code through libs instead of application packages", () => {
    expect.hasAssertions();
    expect(
      workspaceManifests.filter(({ area }) => area === "apps").map(({ file }) => file),
    ).toStrictEqual(expect.arrayContaining(["apps/user/package.json", "apps/admin/package.json"]));
    expect(applicationDependencyViolations(workspaceManifests)).toStrictEqual([]);
  });
});

describe("replaced packages", () => {
  const retired = Object.keys(retiredPackages).map((name) =>
    name.endsWith("/") ? `${name}cloudflare` : name,
  );

  it.for(retired)("rejects a workspace that declares %s", (dependency) => {
    expect.hasAssertions();
    const violations = retiredDependencyViolations([
      {
        area: "libs",
        file: "libs/ui/package.json",
        manifest: { dependencies: { [dependency]: "1.0.0" }, name: "@repo/ui" },
      },
    ]);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain(dependency);
  });

  it("repository workspaces no longer declare them", () => {
    expect.hasAssertions();
    expect(retiredDependencyViolations(workspaceManifests)).toStrictEqual([]);
  });
});

describe("root-only packages", () => {
  it.for(Object.keys(rootOnlyPackages))("rejects a workspace that declares %s", (dependency) => {
    expect.hasAssertions();
    const violations = rootOnlyDependencyViolations([
      {
        area: "libs",
        file: "libs/ui/package.json",
        manifest: { devDependencies: { [dependency]: "1.0.0" }, name: "@repo/ui" },
      },
    ]);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain(dependency);
  });

  it("repository workspaces leave them to the root", () => {
    expect.hasAssertions();
    expect(rootOnlyDependencyViolations(workspaceManifests)).toStrictEqual([]);
  });
});
