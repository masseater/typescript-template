import { NodeServices } from "@effect/platform-node";
import { assert, it } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";

import { applications } from "./applications.ts";
import { roles } from "./identity.ts";

const skipDirectories = new Set([
  ".git",
  "node_modules",
  "migrations",
  "dist",
  ".artifacts",
  ".local",
  ".local-agents",
]);

const textExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".mdx",
  ".yml",
  ".yaml",
  ".css",
  ".html",
  ".toml",
]);

const forbidden = [
  "apps/user",
  "apps/admin/",
  "apps/admin`",
  "apps/admin)",
  "apps/admin ",
  "apps/wiki",
  "@repo/user",
  "@repo/wiki",
  '"@repo/admin"',
  "TEMPLATE_USER_ORIGIN",
  "TEMPLATE_WIKI_ORIGIN",
  "TEMPLATE_ADMIN_ORIGIN",
  'stackName("user")',
  'stackName("wiki")',
  'stackName("admin")',
  'applicationProgram("user")',
  'applicationProgram("wiki")',
  'applicationProgram("admin")',
  'roles = ["user"',
  'default("user")',
  "IN ('user', 'admin')",
] as const;

const walk = (
  directory: string,
): Effect.Effect<readonly string[], never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* walkDirectory() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const files: string[] = [];
    const entries = yield* filesystem.readDirectory(directory);
    for (const name of entries) {
      if (skipDirectories.has(name)) {
        continue;
      }
      const full = paths.join(directory, name);
      const info = yield* filesystem.stat(full);
      if (info.type === "SymbolicLink") {
        continue;
      }
      if (info.type === "Directory") {
        files.push(...(yield* walk(full)));
        continue;
      }
      if (info.type === "File" && textExtensions.has(paths.extname(name))) {
        files.push(full);
      }
    }
    return files;
  }).pipe(Effect.orDie);

it.effect("application and role names use the service and member vocabulary", () =>
  Effect.sync(() => {
    assert.deepStrictEqual(
      [...applications],
      ["service-member", "service-admin", "internal-dashboard"],
    );
    assert.deepStrictEqual([...roles], ["member", "admin"]);
  }),
);

it.effect("retired application and role spellings do not remain in authored sources", () =>
  Effect.gen(function* program() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const repositoryRoot = paths.resolve(
      yield* paths.fromFileUrl(new URL(import.meta.url)),
      "../../..",
    );
    const hits: string[] = [];
    for (const file of yield* walk(repositoryRoot).pipe(Effect.orDie)) {
      const relative = paths.relative(repositoryRoot, file);
      if (relative === "libs/config/src/naming.test.ts") {
        continue;
      }
      const text = yield* filesystem.readFileString(file);
      for (const needle of forbidden) {
        if (text.includes(needle)) {
          hits.push(`${relative}: ${needle}`);
        }
      }
    }
    assert.deepStrictEqual(hits, []);
  }).pipe(Effect.provide(NodeServices.layer)),
);
