import { globSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { applications } from "./applications.ts";
import { repositoryRoot } from "./repository-root.ts";

describe("applications", () => {
  const it = test.extend("applicationNames", () => applications);

  it("uses the service and dashboard vocabulary", ({ applicationNames }) => {
    expect(applicationNames).toStrictEqual([
      "service-member",
      "service-admin",
      "internal-dashboard",
    ]);
  });
});

describe("retired application and role spellings", () => {
  const it = test.extend("retiredSpellingHits", () => {
    const skippedDirectories = new Set([
      ".git",
      "node_modules",
      "migrations",
      "dist",
      ".artifacts",
      ".local",
      ".local-agents",
    ]);
    const authoredExtensions = "{ts,tsx,js,jsx,mjs,cjs,json,md,mdx,yml,yaml,css,html,toml}";
    const retiredSpellings = [
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
    ];
    const authoredFiles = new Set(
      globSync(
        [
          `**/*.${authoredExtensions}`,
          `**/.*/**/*.${authoredExtensions}`,
          `**/.*.${authoredExtensions}`,
        ],
        {
          cwd: repositoryRoot,
          exclude: (candidate) => skippedDirectories.has(path.basename(candidate)),
        },
      ),
    );
    return [...authoredFiles]
      .filter((authoredFile) => authoredFile !== "libs/config/src/applications.test.ts")
      .flatMap((authoredFile) => {
        const authoredText = readFileSync(path.join(repositoryRoot, authoredFile), "utf-8");
        return retiredSpellings
          .filter((retiredSpelling) => authoredText.includes(retiredSpelling))
          .map((retiredSpelling) => `${authoredFile}: ${retiredSpelling}`);
      });
  });

  it("do not remain in authored sources", ({ retiredSpellingHits }) => {
    expect(retiredSpellingHits).toStrictEqual([]);
  });
});
