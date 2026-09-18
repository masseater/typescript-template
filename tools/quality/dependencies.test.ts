import { describe, expect, it } from "vite-plus/test";

import {
  applicationDependencyViolations,
  retiredDependencyViolations,
  workspaceManifests,
} from "./dependencies.ts";
import { retiredPackages } from "./retired-packages.ts";

describe("application package boundaries", () => {
  it.for(["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"])(
    "rejects a workspace that declares an application package in %s",
    (key) => {
      expect.hasAssertions();
      const violations = applicationDependencyViolations([
        { area: "apps", file: "apps/user/package.json", manifest: { name: "@template/user" } },
        {
          area: "apps",
          file: "apps/batch/package.json",
          manifest: { [key]: { "@template/user": "workspace:*" }, name: "@template/batch" },
        },
        {
          area: "libs",
          file: "libs/domain/package.json",
          manifest: { [key]: { "@template/db": "workspace:*" }, name: "@template/domain" },
        },
      ]);
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatch(
        /^apps\/batch\/package\.json: @template\/user はデプロイ単位のアプリです。/u,
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
        manifest: { dependencies: { [dependency]: "1.0.0" }, name: "@template/ui" },
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
