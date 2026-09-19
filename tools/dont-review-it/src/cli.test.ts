import { spawnSync, type SpawnSyncOptionsWithStringEncoding } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vite-plus/test";

const NO_LOCAL_RULE = "dont-review-it/no-local-finite-value-set--use-or-register-canonical-values";

const NO_LOCAL_CODE = "dont-review-it(no-local-finite-value-set--use-or-register-canonical-values)";

const PLUGIN_PATH = fileURLToPath(new URL("./plugin.ts", import.meta.url));

const PROCESS_TIMEOUT = 180_000;

const SPAWN_SETTINGS: SpawnSyncOptionsWithStringEncoding = {
  encoding: "utf8",
  env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
  timeout: PROCESS_TIMEOUT,
};

const LINT_TAIL = ["--format", "json", "--threads", "1"];

const WORKSPACE_MANIFEST = JSON.stringify({
  name: "canonical-values-e2e",
  private: true,
  scripts: { guard: "throttle --timeout 1800 -- spool -- vp check" },
  type: "module",
  workspaces: ["packages/*"],
});

const LINT_CONFIG_SOURCE = `export default ${JSON.stringify({
  lint: {
    categories: { correctness: "off" },
    plugins: [],
    jsPlugins: [{ name: "dont-review-it", specifier: PLUGIN_PATH }],
    rules: { [NO_LOCAL_RULE]: "error" },
  },
})};\n`;

const PACKAGE_ROUTE_FILES = {
  "package.json": WORKSPACE_MANIFEST,
  "vite.config.ts": LINT_CONFIG_SOURCE,
  "packages/vocabulary/package.json": JSON.stringify({
    name: "@fixture/vocabulary",
    private: true,
    exports: { ".": "./src/index.ts", "./alias": "./src/alias.ts", "./shadow": "./src/shadow.ts" },
  }),
  "packages/vocabulary/src/alias.ts":
    'export { ORDER_STATUSES as PUBLIC_STATUSES } from "./owner.ts";\n',
  "packages/vocabulary/src/index.ts": 'export { ORDER_STATUSES } from "./owner.ts";\n',
  "packages/vocabulary/src/owner.ts":
    '/** @canonical-values order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n',
  "packages/vocabulary/src/shadow.ts":
    'export const ORDER_STATUSES = ["draft", "published"] as const;\n',
  "src/alias-consumer.ts":
    'import { PUBLIC_STATUSES } from "@fixture/vocabulary/alias";\nexport const schema = z.enum(PUBLIC_STATUSES);\n',
  "src/shadow-consumer.ts":
    'import { ORDER_STATUSES } from "@fixture/vocabulary/shadow";\nexport const schema = z.enum(ORDER_STATUSES);\n',
  "tsconfig.json": JSON.stringify({
    compilerOptions: {
      baseUrl: ".",
      paths: {
        "@fixture/vocabulary": ["packages/vocabulary/src/index.ts"],
        "@fixture/vocabulary/*": ["packages/vocabulary/src/*"],
      },
    },
  }),
};

describe("canonical values oxlint plugin wiring", { timeout: PROCESS_TIMEOUT * 4 }, () => {
  describe("a vocabulary package exposing a shadow subpath beside an alias subpath", () => {
    describe("the consumer importing through the shadow subpath", () => {
      const it = test.extend("shadowConsumerLint", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(PACKAGE_ROUTE_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const linted = spawnSync("vp", ["lint", "src/shadow-consumer.ts", ...LINT_TAIL], {
          ...SPAWN_SETTINGS,
          cwd: root,
        });
        const messagesIn = (jsonNode: unknown): readonly string[] => {
          if (Array.isArray(jsonNode)) return jsonNode.flatMap(messagesIn);
          if (jsonNode === null || typeof jsonNode !== "object") return [];
          return Object.entries(jsonNode).flatMap(([fieldName, nested]) =>
            fieldName === "message" && typeof nested === "string" ? [nested] : messagesIn(nested),
          );
        };
        return Promise.all([
          Promise.resolve(typeof linted.status === "number" ? linted.status : -1),
          Promise.resolve(linted.stdout.includes(NO_LOCAL_CODE)),
          Promise.resolve(
            messagesIn(JSON.parse(linted.stdout))
              .join("\n")
              .includes("neither a registered public export path"),
          ),
        ]);
      });

      it("fails the lint naming the local-value-set rule on an unregistered route", ({
        shadowConsumerLint,
      }) => {
        expect(shadowConsumerLint).toStrictEqual([1, true, true]);
      });
    });

    describe("the consumer importing through the alias subpath", () => {
      const it = test.extend("aliasConsumerLint", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-e2e-"));
        onCleanup(rmSync.bind(null, root, { recursive: true, force: true }));
        for (const [relativePath, fileText] of Object.entries(PACKAGE_ROUTE_FILES)) {
          mkdirSync(dirname(join(root, relativePath)), { recursive: true });
          writeFileSync(join(root, relativePath), fileText, "utf8");
        }
        const linted = spawnSync("vp", ["lint", "src/alias-consumer.ts", ...LINT_TAIL], {
          ...SPAWN_SETTINGS,
          cwd: root,
        });
        return typeof linted.status === "number" ? linted.status : -1;
      });

      it("passes the lint", ({ aliasConsumerLint }) => {
        expect(aliasConsumerLint).toStrictEqual(0);
      });
    });
  });
});
