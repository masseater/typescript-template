import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { type WorkspaceManifest } from "./dependencies-test-fixture.ts";
import {
  repositoryPackageEntryFindings,
  testOnlyEntryFindings,
  undeclaredImportFindings,
} from "./package-entries-test-fixture.ts";
import { type SourceText } from "./single-consumer-test-fixture.ts";

const workspace = (file: string, manifest: unknown): WorkspaceManifest => ({
  area: file.split("/")[0] ?? ".",
  file,
  manifest,
});

const source = (file: string, text: string): SourceText => ({ file, text });

const databaseLocal = workspace("libs/db-local/package.json", {
  dependencies: { "@repo/db": "workspace:*" },
  exports: { ".": "./src/features/db-local/testing-node.ts" },
  name: "@repo/db-local",
});

const database = workspace("libs/db/package.json", {
  exports: {
    ".": "./src/features/db/index.ts",
    "./node-testing": "./src/features/db/node-database-test-fixture.ts",
  },
  name: "@repo/db",
});

const cloudflare = workspace("infra/cloudflare/package.json", {
  devDependencies: { "@repo/db": "workspace:*", "@repo/db-local": "workspace:*" },
  name: "@repo/infra-cloudflare",
});

describe("undeclared workspace imports", () => {
  it.for([
    "libs/db/src/features/db/schema.test.ts",
    "libs/db/src/features/db/remote-operations.test.ts",
    "libs/db/src/features/db/local-platform.test.ts",
  ])("rejects %s importing @repo/db-local without declaring it", (file) => {
    expect.hasAssertions();
    const findings = undeclaredImportFindings(
      [database, databaseLocal],
      [source(file, 'import { runStatement } from "@repo/db-local";\n')],
    );
    expect(findings.map((finding) => finding.id)).toStrictEqual([
      `undeclared:${file}:@repo/db-local`,
    ]);
    expect(findings[0]?.message).toContain("libs/db/package.json");
  });

  it("accepts declared dependencies and the package's own name", () => {
    expect.hasAssertions();
    expect(
      undeclaredImportFindings(
        [database, databaseLocal, cloudflare],
        [
          source("infra/cloudflare/src/remote.test.ts", 'import "@repo/db-local";\n'),
          source("infra/cloudflare/src/query.ts", 'import { query } from "@repo/db";\n'),
          source("libs/db/src/features/db/self.ts", 'import "@repo/db/node-testing";\n'),
        ],
      ),
    ).toStrictEqual([]);
  });

  it("leaves configuration files outside src to the root manifest", () => {
    expect.hasAssertions();
    expect(
      undeclaredImportFindings(
        [database],
        [
          source("libs/db/vite.config.ts", 'import "@repo/vite-config";\n'),
          source(
            "libs/db/tsconfig.json",
            '{ "extends": "@repo/dont-review-it/tsconfig/library.json" }\n',
          ),
        ],
      ),
    ).toStrictEqual([]);
  });
});

describe("test-only package entries", () => {
  it("rejects an entry only tests import when its file is not a -test-fixture", () => {
    expect.hasAssertions();
    const findings = testOnlyEntryFindings(
      [databaseLocal],
      [
        source("libs/db/src/features/db/schema.test.ts", 'import "@repo/db-local";\n'),
        source("infra/cloudflare/src/remote-http.isolated.test.ts", 'import "@repo/db-local";\n'),
      ],
    );
    expect(findings.map((finding) => finding.id)).toStrictEqual(["test-only:@repo/db-local"]);
    expect(findings[0]?.message).toContain("libs/db-local/src/features/db-local/testing-node.ts");
  });

  it("accepts a -test-fixture entry only tests import", () => {
    expect.hasAssertions();
    expect(
      testOnlyEntryFindings(
        [database],
        [
          source(
            "infra/cloudflare/src/remote-http.isolated.test.ts",
            'import "@repo/db/node-testing";\n',
          ),
          source(
            "libs/db/src/features/db/schema.test.ts",
            'import "./node-database-test-fixture.ts";\n',
          ),
          source("libs/db/src/features/db/query.ts", 'import "@repo/db";\n'),
        ],
      ),
    ).toStrictEqual([]);
  });

  it("counts an import from the owner's own code as a production importer", () => {
    expect.hasAssertions();
    expect(
      testOnlyEntryFindings(
        [database],
        [
          source("libs/other/src/index.test.ts", 'import "@repo/db";\n'),
          source("libs/db/src/features/db/extra.ts", 'import "./index.ts";\n'),
        ],
      ),
    ).toStrictEqual([]);
  });
});

describe("repository package entries", () => {
  it("declares every workspace import and names every test-only entry -test-fixture", () =>
    Effect.runPromise(
      Effect.gen(function* repositoryEntries() {
        expect.hasAssertions();
        const findings = yield* repositoryPackageEntryFindings;
        expect(findings.map((finding) => finding.message)).toStrictEqual([]);
      }).pipe(Effect.provide(NodeServices.layer)),
    ));
});
