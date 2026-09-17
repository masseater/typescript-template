import { expect, test } from "vite-plus/test";
import {
  applicationDependencyViolations,
  retiredDependencyViolations,
  retiredUiPackages,
  workspaceManifests,
} from "./dependencies.ts";

test.for(["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"])(
  "rejects a workspace that declares an application package in %s",
  (key) => {
    const violations = applicationDependencyViolations([
      { area: "apps", file: "apps/user/package.json", manifest: { name: "@template/user" } },
      {
        area: "apps",
        file: "apps/batch/package.json",
        manifest: { name: "@template/batch", [key]: { "@template/user": "workspace:*" } },
      },
      {
        area: "libs",
        file: "libs/domain/package.json",
        manifest: { name: "@template/domain", [key]: { "@template/db": "workspace:*" } },
      },
    ]);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(
      /^apps\/batch\/package\.json: @template\/user はデプロイ単位のアプリです。/,
    );
  },
);

test("repository workspaces share code through libs instead of application packages", () => {
  expect(workspaceManifests.filter(({ area }) => area === "apps").map(({ file }) => file)).toEqual(
    expect.arrayContaining(["apps/user/package.json", "apps/admin/package.json"]),
  );
  expect(applicationDependencyViolations(workspaceManifests)).toEqual([]);
});

test.for(Object.keys(retiredUiPackages))("rejects a workspace that declares %s", (dependency) => {
  const violations = retiredDependencyViolations([
    {
      area: "libs",
      file: "libs/ui/package.json",
      manifest: { name: "@template/ui", dependencies: { [dependency]: "1.0.0" } },
    },
  ]);
  expect(violations).toHaveLength(1);
  expect(violations[0]).toContain(dependency);
});

test("repository workspaces no longer declare the replaced UI packages", () => {
  expect(retiredDependencyViolations(workspaceManifests)).toEqual([]);
});
