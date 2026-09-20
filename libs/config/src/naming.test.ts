import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import { applications, roles } from "./applications.ts";

const repositoryRoot = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));

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

function walk(directory: string, files: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (skipDirectories.has(entry.name) || entry.isSymbolicLink()) {
      continue;
    }
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
      continue;
    }
    if (entry.isFile() && textExtensions.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

it.effect("application and role names use the service and member vocabulary", () =>
  Effect.sync(() => {
    assert.deepStrictEqual(
      [...applications],
      ["service-member", "service-admin", "internal-dashboard"],
    );
    assert.deepStrictEqual([...roles], ["member", "admin", "staff"]);
  }),
);

it.effect("retired application and role spellings do not remain in authored sources", () =>
  Effect.sync(() => {
    const hits: string[] = [];
    for (const file of walk(repositoryRoot)) {
      const relative = path.relative(repositoryRoot, file);
      if (relative === "libs/config/src/naming.test.ts") {
        continue;
      }
      const text = readFileSync(file, "utf8");
      for (const needle of forbidden) {
        if (text.includes(needle)) {
          hits.push(`${relative}: ${needle}`);
        }
      }
    }
    assert.deepStrictEqual(hits, []);
  }),
);
