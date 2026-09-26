import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { defaultIntentSkillsConfig } from "./config.ts";
import { shippedSkillsProblems } from "./shipped-skills.ts";

const PUBLISHED_MANIFEST = `{
  "name": "@example/shipped",
  "version": "1.2.3",
  "keywords": ["tanstack-intent"],
  "files": ["skills"]
}
`;

const UNVERSIONED_MANIFEST = `{
  "name": "@example/shipped",
  "keywords": ["tanstack-intent"],
  "files": ["skills"]
}
`;

const PRIVATE_MANIFEST = `{
  "name": "@example/kept",
  "private": true
}
`;

const SKILL_AT_THE_DECLARED_VERSION = "---\nname: core\nmetadata:\n  library_version: 1.2.3\n---\n";

const SKILL_AT_AN_OLDER_VERSION = "---\nname: core\nmetadata:\n  library_version: 1.0.0\n---\n";

layer(NodeServices.layer)("shippedSkillsProblems", (it) => {
  describe("a published package shipping skills with no changelog beside them", () => {
    const scanFixture = Effect.gen(function* scan() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "shipped-versions-",
      });

      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "skills/core"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        PUBLISHED_MANIFEST,
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "skills/core/SKILL.md"),
        SKILL_AT_THE_DECLARED_VERSION,
      );
      return yield* shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it.effect("asks for the changelog", () =>
      Effect.gen(function* program() {
        const scan = yield* scanFixture;
        expect(scan).toStrictEqual({
          scanned: 1,
          problems: [
            {
              file: "package.json",
              line: 2,
              message:
                'A package that npm can publish must not ship its skills without a changelog beside them, because the agent that loads a skill cannot tell what the version it installed changed. Create skills/CHANGELOG.md with a "## <version>" heading for every published version.',
            },
          ],
        });
      }),
    );
  });

  describe("a changelog that never names the published version", () => {
    const scanFixture = Effect.gen(function* scan() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "shipped-versions-",
      });

      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "skills/core"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        PUBLISHED_MANIFEST,
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "skills/CHANGELOG.md"),
        "# Changelog\n",
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "skills/core/SKILL.md"),
        SKILL_AT_THE_DECLARED_VERSION,
      );
      return yield* shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it.effect("asks for the heading that names it", () =>
      Effect.gen(function* program() {
        const scan = yield* scanFixture;
        expect(scan).toStrictEqual({
          scanned: 1,
          problems: [
            {
              file: "skills/CHANGELOG.md",
              line: null,
              message:
                'The changelog must not leave a published version undescribed, because the archive would carry a version nobody wrote down. Add a "## 1.2.3" heading stating what this version changes for the packages that install it.',
            },
          ],
        });
      }),
    );
  });

  describe("a skill naming a version the manifest no longer declares", () => {
    const scanFixture = Effect.gen(function* scan() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "shipped-versions-",
      });

      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "skills/core"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        PUBLISHED_MANIFEST,
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "skills/CHANGELOG.md"),
        "## 1.2.3\n",
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "skills/core/SKILL.md"),
        SKILL_AT_AN_OLDER_VERSION,
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "skills/core/NOTES.md"),
        "# notes\n",
      );
      return yield* shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it.effect("asks for the version the manifest declares", () =>
      Effect.gen(function* program() {
        const scan = yield* scanFixture;
        expect(scan).toStrictEqual({
          scanned: 1,
          problems: [
            {
              file: "skills/core/SKILL.md",
              line: 4,
              message:
                'A shipped skill must not name a version its manifest no longer declares, because an agent reads library_version to decide whether the skill describes the package it installed. Set metadata.library_version to "1.2.3", or run dont-review-it regenerate.',
            },
          ],
        });
      }),
    );
  });

  describe("a published package whose skills and changelog agree with its version", () => {
    const scanFixture = Effect.gen(function* scan() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "shipped-versions-",
      });

      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "skills/core"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        PUBLISHED_MANIFEST,
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "skills/CHANGELOG.md"),
        "## 1.2.3\n",
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "skills/core/SKILL.md"),
        SKILL_AT_THE_DECLARED_VERSION,
      );
      return yield* shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it.effect("says nothing about it", () =>
      Effect.gen(function* program() {
        const scan = yield* scanFixture;
        expect(scan).toStrictEqual({ scanned: 1, problems: [] });
      }),
    );
  });

  describe("a published package declaring no version", () => {
    const scanFixture = Effect.gen(function* scan() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "shipped-versions-",
      });

      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "skills/core"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        UNVERSIONED_MANIFEST,
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "skills/core/SKILL.md"),
        SKILL_AT_THE_DECLARED_VERSION,
      );
      return yield* shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it.effect("asks nothing about the versions it ships", () =>
      Effect.gen(function* program() {
        const scan = yield* scanFixture;
        expect(scan).toStrictEqual({ scanned: 1, problems: [] });
      }),
    );
  });

  describe("a package npm cannot publish, carrying a changelog beside its skills", () => {
    const scanFixture = Effect.gen(function* scan() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "shipped-versions-",
      });

      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "skills"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        PRIVATE_MANIFEST,
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "skills/CHANGELOG.md"),
        "## 1.2.3\n",
      );
      return yield* shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it.effect("asks for the changelog to go", () =>
      Effect.gen(function* program() {
        const scan = yield* scanFixture;
        expect(scan).toStrictEqual({
          scanned: 1,
          problems: [
            {
              file: "package.json",
              line: 3,
              message:
                'A workspace-internal package must not carry a changelog beside its skills, because nothing is ever packed from a package npm cannot publish. Delete skills/CHANGELOG.md, or let the package publish by removing "private": true.',
            },
          ],
        });
      }),
    );
  });

  describe("a package npm cannot publish, carrying nothing beside its skills", () => {
    const scanFixture = Effect.gen(function* scan() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "shipped-versions-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        PRIVATE_MANIFEST,
      );
      return yield* shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it.effect("says nothing about it", () =>
      Effect.gen(function* program() {
        const scan = yield* scanFixture;
        expect(scan).toStrictEqual({ scanned: 1, problems: [] });
      }),
    );
  });
});
