import { applicationDependencyViolations, readWorkspaceManifests } from "./dependencies.ts";
import { describe, expect, it } from "vite-plus/test";

const root = new URL("../../", import.meta.url).href;

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

  it("repository workspaces share code through libs instead of application packages", async () => {
    expect.hasAssertions();
    const workspaces = await readWorkspaceManifests(root);
    expect(workspaces.filter(({ area }) => area === "apps").map(({ file }) => file)).toStrictEqual(
      expect.arrayContaining(["apps/user/package.json", "apps/admin/package.json"]),
    );
    expect(applicationDependencyViolations(workspaces)).toStrictEqual([]);
  });
});
