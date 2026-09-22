import { describe, expect, it } from "vite-plus/test";

import {
  moduleSpecifiers,
  repositorySingleConsumerFindings,
  singleConsumerAllowlist,
  singleConsumerFindings,
  type SourceText,
  type WorkspaceManifest,
} from "./single-consumer.ts";

const workspace = (
  file: string,
  manifest: unknown,
  area = file.split("/")[0] ?? ".",
): WorkspaceManifest => ({
  area,
  file,
  manifest,
});

const source = (file: string, text: string): SourceText => ({ file, text });

describe("module specifiers", () => {
  it("reads import and export specifiers, including across lines", () => {
    expect.hasAssertions();
    expect(
      moduleSpecifiers(
        "libs/shared/src/index.ts",
        'import type { A } from "@repo/shared";\nexport { b } from "@repo/shared/sub";\nimport {\n  c,\n} from "@repo/other";\nimport "@repo/ui/styles.css";\n',
      ),
    ).toStrictEqual(["@repo/shared", "@repo/shared/sub", "@repo/other", "@repo/ui/styles.css"]);
  });

  it("reads loaders and config specifiers", () => {
    expect.hasAssertions();
    expect(
      moduleSpecifiers(
        "tools/load/vite.config.ts",
        [
          'const path = import.meta.resolve("@repo/ai-native/vitest-sdk");',
          'const plugin = { specifier: "@repo/quality/plugin" };',
          'const loaded = await import("@repo/runtime/http");',
          'const required = require("@repo/db/remote");',
          'const resolved = require.resolve("@repo/vite-config");',
        ].join("\n"),
      ),
    ).toStrictEqual([
      "@repo/ai-native/vitest-sdk",
      "@repo/quality/plugin",
      "@repo/runtime/http",
      "@repo/db/remote",
      "@repo/vite-config",
    ]);
  });

  it("ignores fixtures, comments, and specifiers outside @repo", () => {
    expect.hasAssertions();
    expect(
      moduleSpecifiers(
        "tools/quality/example.test.ts",
        [
          `const fixture = ${JSON.stringify('export * from "@repo/dev";')};`,
          `const quoted = ${JSON.stringify('import "@repo/dev"')};`,
          'const template = `export * from "@repo/dev"`;',
          '// import "@repo/dev";',
          '/* from "@repo/dev" */',
          'import { real } from "effect";',
          'const label = "not a specifier";',
        ].join("\n"),
      ),
    ).toStrictEqual([]);
  });

  it("reads css imports and tsconfig extends", () => {
    expect.hasAssertions();
    expect(
      moduleSpecifiers(
        "apps/service-member/src/app/styles.css",
        '@import "@repo/ui/styles.css";\n',
      ),
    ).toStrictEqual(["@repo/ui/styles.css"]);
    expect(
      moduleSpecifiers(
        "libs/ui/tsconfig.json",
        '{ "extends": "@repo/dont-review-it/tsconfig/app.json" }\n',
      ),
    ).toStrictEqual(["@repo/dont-review-it/tsconfig/app.json"]);
    expect(
      moduleSpecifiers(
        "tsconfig.json",
        '{ "extends": ["./local.json", "@repo/dont-review-it/tsconfig/library.json"] }\n',
      ),
    ).toStrictEqual(["@repo/dont-review-it/tsconfig/library.json"]);
    expect(moduleSpecifiers("libs/ui/components.json", '{ "style": "new-york" }\n')).toStrictEqual(
      [],
    );
    expect(moduleSpecifiers("README.md", 'import "@repo/ui";\n')).toStrictEqual([]);
  });
});

describe("single consumer findings", () => {
  const shared = workspace("libs/shared/package.json", {
    exports: { ".": "./src/index.ts", "./mcp": "./src/mcp.ts", "./package.json": "./package.json" },
    name: "@repo/shared",
  });

  it("accepts a libs package and subpath used by two workspaces", () => {
    expect.hasAssertions();
    const findings = singleConsumerFindings(
      [
        shared,
        workspace(
          "apps/one/package.json",
          {
            dependencies: { "@repo/shared": "workspace:*" },
            name: "@repo/one",
          },
          "apps",
        ),
        workspace(
          "apps/two/package.json",
          {
            peerDependencies: { "@repo/shared": "workspace:*" },
            name: "@repo/two",
          },
          "apps",
        ),
      ],
      [
        source("apps/one/src/index.ts", 'import "@repo/shared/mcp";\n'),
        source("libs/other/src/index.ts", 'import "@repo/shared/mcp";\n'),
        source("libs/shared/src/mcp.ts", 'import "@repo/shared/mcp";\n'),
      ],
    );
    expect(findings).toStrictEqual([]);
  });

  it("reports a libs package and subpath with one consumer", () => {
    expect.hasAssertions();
    const findings = singleConsumerFindings(
      [
        shared,
        workspace(
          "apps/one/package.json",
          {
            devDependencies: { "@repo/shared": "workspace:*" },
            name: "@repo/one",
          },
          "apps",
        ),
      ],
      [source("apps/one/src/index.ts", 'export { x } from "@repo/shared/mcp";\n')],
    );
    expect(findings.map((finding) => finding.id)).toStrictEqual([
      "package:@repo/shared",
      "subpath:@repo/shared/mcp",
    ]);
    expect(findings[0]?.message).toContain("apps/one");
    expect(findings[1]?.message).toContain("apps/one");
  });

  it("skips deploy units, command-only tools, and package.json exports", () => {
    expect.hasAssertions();
    const findings = singleConsumerFindings(
      [
        workspace(
          "apps/one/package.json",
          {
            exports: { "./only": "./src/only.ts" },
            name: "@repo/one",
          },
          "apps",
        ),
        workspace(
          "infra/local/package.json",
          {
            exports: { "./only": "./src/only.ts" },
            name: "@repo/local",
          },
          "infra",
        ),
        workspace("tools/load/package.json", { name: "@repo/load" }, "tools"),
        workspace(
          "tools/quality/package.json",
          {
            exports: { "./plugin": "./plugin.ts", "./tsconfig/*": "./tsconfig/*" },
            name: "@repo/quality",
          },
          "tools",
        ),
        workspace("package.json", { dependencies: { "@repo/quality": "workspace:*" } }, "."),
        workspace(
          "tools/e2e/package.json",
          {
            dependencies: { "@repo/quality": "workspace:*" },
            name: "@repo/e2e",
          },
          "tools",
        ),
      ],
      [
        source("apps/one/src/index.ts", 'import "@repo/quality/plugin";\n'),
        source("tools/e2e/src/index.ts", 'import "@repo/quality/plugin";\n'),
        source("libs/ui/tsconfig.json", '{ "extends": "@repo/quality/tsconfig/library.json" }\n'),
        source("tools/dev/tsconfig.json", '{ "extends": "@repo/quality/tsconfig/app.json" }\n'),
      ],
    );
    expect(findings).toStrictEqual([]);
  });

  it("does not treat a tool with one source importer as command-only", () => {
    expect.hasAssertions();
    const findings = singleConsumerFindings(
      [workspace("tools/dev/package.json", { name: "@repo/dev" }, "tools")],
      [source("tools/quality/example.ts", 'import "@repo/dev";\n')],
    );
    expect(findings.map((finding) => finding.id)).toStrictEqual(["package:@repo/dev"]);
  });

  it("reports a wildcard subpath with one importer", () => {
    expect.hasAssertions();
    const findings = singleConsumerFindings(
      [
        workspace("libs/preset/package.json", {
          dependencies: { "@repo/preset": "workspace:*" },
          exports: { "./tsconfig/*": "./tsconfig/*" },
          name: "@repo/preset",
        }),
        workspace(
          "apps/one/package.json",
          {
            dependencies: { "@repo/preset": "workspace:*" },
            name: "@repo/one",
          },
          "apps",
        ),
        workspace(
          "apps/two/package.json",
          {
            optionalDependencies: { "@repo/preset": "workspace:*" },
            name: "@repo/two",
          },
          "apps",
        ),
      ],
      [source("apps/one/tsconfig.json", '{ "extends": "@repo/preset/tsconfig/app.json" }\n')],
    );
    expect(findings.map((finding) => finding.id)).toStrictEqual(["subpath:@repo/preset/tsconfig"]);
  });
});

describe("repository single consumers", () => {
  it("reports no single-consumer packages or subpaths", () => {
    expect.hasAssertions();
    const ids = repositorySingleConsumerFindings().map((finding) => finding.id);
    expect(singleConsumerAllowlist).toStrictEqual([
      "subpath:@repo/auth/testing",
      "subpath:@repo/runtime/contracts",
    ]);
    expect(ids).toStrictEqual([
      "subpath:@repo/auth/testing",
      "subpath:@repo/runtime/contracts",
    ]);
  });
});
