import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { expect } from "vite-plus/test";

import { defaultIntentSkillsConfig } from "../src/features/dont-review-it/intent-skills/config.ts";
import { writeSkillVersions } from "../src/features/dont-review-it/intent-skills/write-skill-versions.ts";
import { runChecks } from "../src/features/dont-review-it/run-checks.ts";

const MANIFEST_PATH = "packages/versioned/package.json";

const CHANGELOG_PATH = "packages/versioned/skills/CHANGELOG.md";

const SKILL_PATH = "packages/versioned/skills/core/SKILL.md";

const PUBLISHED_MANIFEST = `{
  "name": "@example/versioned",
  "version": "0.1.0",
  "files": ["dist", "skills"],
  "keywords": ["tanstack-intent"]
}
`;

const skillDeclaring = (version: string): string =>
  `---\nname: core\nmetadata:\n  library_version: "${version}"\n---\n`;

const repositoryWith = (files: Readonly<Record<string, string>>) =>
  Effect.gen(function* repositoryWith() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
      prefix: "dont-review-it-skill-versions-",
    });
    yield* Effect.forEach(
      Object.entries(files),
      ([fileName, source]) =>
        Effect.gen(function* writeFixture() {
          const absolutePath = paths.join(repositoryRoot, fileName);
          yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
          yield* filesystem.writeFileString(absolutePath, source);
        }),
      { discard: true },
    );
    return repositoryRoot;
  });

const reportedFor = (files: Readonly<Record<string, string>>) =>
  Effect.gen(function* reportedFor() {
    const { problems } = yield* runChecks(yield* repositoryWith(files));
    return problems.join("\n");
  });

layer(NodeServices.layer)("出荷する skill と宣言した版の突き合わせ", (it) => {
  it.effect("npm へ公開できるパッケージが skill の隣に changelog を持たなければ報告する", () =>
    Effect.gen(function* program() {
      const reported = yield* reportedFor({
        [MANIFEST_PATH]: PUBLISHED_MANIFEST,
        [SKILL_PATH]: skillDeclaring("0.1.0"),
      });

      expect(reported).toContain(`${MANIFEST_PATH}:`);
      expect(reported).toContain("without a changelog beside them");
    }),
  );

  it.effect("changelog が宣言された版を書いていなければ、その changelog を指して報告する", () =>
    Effect.gen(function* program() {
      const reported = yield* reportedFor({
        [MANIFEST_PATH]: PUBLISHED_MANIFEST,
        [CHANGELOG_PATH]: "## 0.0.9\n\n- 前の版の変更\n",
        [SKILL_PATH]: skillDeclaring("0.1.0"),
      });

      expect(reported).toContain(CHANGELOG_PATH);
      expect(reported).toContain('Add a "## 0.1.0" heading');
    }),
  );

  it.effect("同梱する skill が別の版を名乗っていれば、その skill を指して報告する", () =>
    Effect.gen(function* program() {
      const reported = yield* reportedFor({
        [MANIFEST_PATH]: PUBLISHED_MANIFEST,
        [CHANGELOG_PATH]: "## 0.1.0\n\n- この版の変更\n",
        [SKILL_PATH]: skillDeclaring("0.0.9"),
      });

      expect(reported).toContain(`${SKILL_PATH}:`);
      expect(reported).toContain('Set metadata.library_version to "0.1.0"');
    }),
  );

  it.effect("changelog が版を書き、skill が同じ版を名乗っていれば何も報告しない", () =>
    Effect.gen(function* program() {
      const reported = yield* reportedFor({
        [MANIFEST_PATH]: PUBLISHED_MANIFEST,
        [CHANGELOG_PATH]: "## 0.1.0\n\n- この版の変更\n",
        [SKILL_PATH]: skillDeclaring("0.1.0"),
      });

      expect(reported).toBe("");
    }),
  );

  it.effect("公開しないパッケージが skill の隣に changelog を持てば報告する", () =>
    Effect.gen(function* program() {
      const reported = yield* reportedFor({
        "packages/internal/package.json": `{
  "name": "@example/internal",
  "version": "0.1.0",
  "private": true
}
`,
        "packages/internal/skills/CHANGELOG.md": "## 0.1.0\n\n- この版の変更\n",
      });

      expect(reported).toContain("must not carry a changelog beside its skills");
    }),
  );

  it.effect("自動修正は skill の版を宣言へ揃え、changelog には触れない", () =>
    Effect.gen(function* program() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const changelog = "## 0.0.9\n\n- 前の版の変更\n";
      const repositoryRoot = yield* repositoryWith({
        [MANIFEST_PATH]: PUBLISHED_MANIFEST,
        [CHANGELOG_PATH]: changelog,
        [SKILL_PATH]: skillDeclaring("0.0.9"),
      });

      const { failures } = yield* writeSkillVersions({
        repositoryRoot,
        config: defaultIntentSkillsConfig,
      });

      expect(failures).toStrictEqual([]);
      expect(yield* filesystem.readFileString(paths.join(repositoryRoot, SKILL_PATH))).toContain(
        'library_version: "0.1.0"',
      );
      expect(yield* filesystem.readFileString(paths.join(repositoryRoot, CHANGELOG_PATH))).toBe(
        changelog,
      );
    }),
  );
});
