import { describe, expect, it } from "vite-plus/test";

import {
  applicationDependencyViolations,
  commandReferences,
  developmentOnlyDependencyViolations,
  libraryMixedSurfaceViolations,
  publishableSurfaceViolations,
  retiredDependencyViolations,
  rootOnlyDependencyViolations,
  rootOnlyPackages,
  workspaceManifests,
} from "./dependencies.ts";
import { repositoryRoot } from "./repository-root.ts";

describe("application package boundaries", () => {
  it.for(["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"])(
    "rejects a workspace that declares an application package in %s",
    (key) => {
      expect.hasAssertions();
      const violations = applicationDependencyViolations([
        {
          area: "apps",
          file: "apps/service-member/package.json",
          manifest: { name: "@repo/service-member" },
        },
        {
          area: "apps",
          file: "apps/batch/package.json",
          manifest: { [key]: { "@repo/service-member": "workspace:*" }, name: "@repo/batch" },
        },
        {
          area: "libs",
          file: "libs/domain/package.json",
          manifest: { [key]: { "@repo/db": "workspace:*" }, name: "@repo/domain" },
        },
      ]);
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatch(
        /^apps\/batch\/package\.json: @repo\/service-member はデプロイ単位のアプリです。/u,
      );
    },
  );

  it("repository workspaces share code through libs instead of application packages", () => {
    expect.hasAssertions();
    expect(
      workspaceManifests.filter(({ area }) => area === "apps").map(({ file }) => file),
    ).toStrictEqual(
      expect.arrayContaining([
        "apps/service-member/package.json",
        "apps/service-admin/package.json",
      ]),
    );
    expect(applicationDependencyViolations(workspaceManifests)).toStrictEqual([]);
  });
});

describe("replaced packages", () => {
  it.for([
    { kind: "exact", dependency: "styled-components" },
    { kind: "exact", dependency: "i18next" },
    { kind: "exact", dependency: "react-intl" },
    { kind: "prefix", dependency: "@pulumi/cloudflare" },
    { kind: "prefix", dependency: "@lingui/core" },
  ])("rejects a workspace that declares $dependency ($kind)", ({ dependency }) => {
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

describe("development-only packages", () => {
  it("rejects miniflare in a shipped library dependencies", () => {
    expect.hasAssertions();
    const violations = developmentOnlyDependencyViolations([
      {
        area: "libs",
        file: "libs/db/package.json",
        manifest: { dependencies: { miniflare: "5.0.0" }, name: "@repo/db" },
      },
    ]);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("miniflare");
  });

  it("repository shipped packages leave them out of dependencies", () => {
    expect.hasAssertions();
    expect(developmentOnlyDependencyViolations(workspaceManifests)).toStrictEqual([]);
  });
});

describe("library package surfaces", () => {
  it("rejects a library that declares both bin and exports", () => {
    expect.hasAssertions();
    const violations = libraryMixedSurfaceViolations([
      {
        area: "libs",
        file: "libs/config/package.json",
        manifest: {
          bin: { "dev-start": "./src/dev-start.ts" },
          exports: { ".": "./src/index.ts" },
          name: "@repo/config",
        },
      },
    ]);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("exports");
  });

  it("repository libraries keep a single surface", () => {
    expect.hasAssertions();
    expect(libraryMixedSurfaceViolations(workspaceManifests)).toStrictEqual([]);
  });
});

describe("publishable surfaces", () => {
  it("rejects a command package that does not publish every bin", () => {
    expect.hasAssertions();
    const violations = publishableSurfaceViolations(
      [
        {
          area: "tools",
          file: "tools/example/package.json",
          manifest: {
            bin: { example: "./src/cli.ts", "example-extra": "./src/extra.ts" },
            exports: { "./package.json": "./package.json" },
            name: "@repo/example",
            publishConfig: { access: "public", bin: { example: "./dist/cli.mjs" } },
          },
        },
      ],
      [],
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("example-extra");
  });

  it("rejects an unpublished command that nothing starts", () => {
    expect.hasAssertions();
    const violations = publishableSurfaceViolations(
      [
        {
          area: "tools",
          file: "tools/example/package.json",
          manifest: {
            bin: { example: "./src/cli.ts", "example-extra": "./src/extra.ts" },
            exports: { ".": "./src/index.ts" },
            name: "@repo/example",
            publishConfig: {
              access: "public",
              bin: { example: "./dist/cli.mjs" },
              exports: { ".": "./dist/index.mjs" },
            },
          },
        },
      ],
      [{ file: "vite.config.ts", text: "command: example" }],
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("example-extra");
  });

  it("repository publishable tools keep a command surface or a published pair", () => {
    expect.hasAssertions();
    expect(
      publishableSurfaceViolations(workspaceManifests, commandReferences(repositoryRoot)),
    ).toStrictEqual([]);
  });
});
