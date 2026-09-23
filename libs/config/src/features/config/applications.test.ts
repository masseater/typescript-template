import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Path } from "effect";
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
    const authoredPatterns = [
      `**/*.${authoredExtensions}`,
      `**/.*/**/*.${authoredExtensions}`,
      `**/.*.${authoredExtensions}`,
    ];
    return Effect.runPromise(
      Effect.gen(function* retiredSpellingHits() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const matchedFiles = yield* Effect.forEach(authoredPatterns, (authoredPattern) =>
          filesystem.glob(authoredPattern, {
            root: repositoryRoot,
            exclude: [...skippedDirectories].map((skippedDirectory) => `**/${skippedDirectory}`),
          }),
        );
        const authoredFiles = [...new Set(matchedFiles.flat())].filter(
          (authoredFile) => authoredFile !== "libs/config/src/features/config/applications.test.ts",
        );
        const hitsPerFile = yield* Effect.forEach(authoredFiles, (authoredFile) =>
          filesystem
            .readFileString(paths.join(repositoryRoot, authoredFile))
            .pipe(
              Effect.map((authoredText) =>
                retiredSpellings
                  .filter((retiredSpelling) => authoredText.includes(retiredSpelling))
                  .map((retiredSpelling) => `${authoredFile}: ${retiredSpelling}`),
              ),
            ),
        );
        return hitsPerFile.flat();
      }).pipe(Effect.provide(NodeServices.layer)),
    );
  });

  it("do not remain in authored sources", ({ retiredSpellingHits }) => {
    expect(retiredSpellingHits).toStrictEqual([]);
  });
});
