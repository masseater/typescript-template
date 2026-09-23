import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { defaultIntentSkillsConfig } from "./config.ts";
import { writeSkillVersions } from "./write-skill-versions.ts";

const SKILL_PATH = "packages/versioned/skills/core/SKILL.md";

const PUBLISHED_MANIFEST = `{
  "name": "@example/versioned",
  "version": "0.2.0"
}
`;

const SKILL_NAMING_AN_OLDER_VERSION = `---
name: core
metadata:
  library_version: "0.0.9"
---
`;

const SKILL_NAMING_THE_PACKAGE_VERSION = `---
name: core
metadata:
  library_version: "0.2.0"
---
`;

layer(NodeServices.layer)("writeSkillVersions", (it) => {
  describe("a skill naming a version other than the one its package declares", () => {
    const staleSkillRootFixture = Effect.gen(function* staleSkillRoot() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-skill-versions-",
      });

      yield* filesystem.makeDirectory(paths.join(root, "packages/versioned/skills/core"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "packages/versioned/package.json"),
        PUBLISHED_MANIFEST,
      );
      yield* filesystem.writeFileString(
        paths.join(root, SKILL_PATH),
        SKILL_NAMING_AN_OLDER_VERSION,
      );
      return root;
    });

    describe("the report handed back", () => {
      const writeReportFixture = Effect.gen(function* writeReport() {
        const staleSkillRoot = yield* staleSkillRootFixture;
        return yield* writeSkillVersions({
          repositoryRoot: staleSkillRoot,
          config: defaultIntentSkillsConfig,
        });
      });

      it.effect("names no failure", () =>
        Effect.gen(function* program() {
          const writeReport = yield* writeReportFixture;
          expect(writeReport).toStrictEqual({ failures: [] });
        }),
      );
    });

    describe("the skill file left behind", () => {
      const skillSourceFixture = Effect.gen(function* skillSource() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const staleSkillRoot = yield* staleSkillRootFixture;
        yield* writeSkillVersions({
          repositoryRoot: staleSkillRoot,
          config: defaultIntentSkillsConfig,
        });
        return yield* filesystem.readFileString(paths.join(staleSkillRoot, SKILL_PATH));
      });

      it.effect("names the version its package declares", () =>
        Effect.gen(function* program() {
          const skillSource = yield* skillSourceFixture;
          expect(skillSource).toBe(SKILL_NAMING_THE_PACKAGE_VERSION);
        }),
      );
    });
  });

  describe("a skill already naming the version its package declares", () => {
    const currentSkillRootFixture = Effect.gen(function* currentSkillRoot() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-skill-versions-",
      });

      yield* filesystem.makeDirectory(paths.join(root, "packages/versioned/skills/core"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "packages/versioned/package.json"),
        PUBLISHED_MANIFEST,
      );
      yield* filesystem.writeFileString(
        paths.join(root, SKILL_PATH),
        SKILL_NAMING_THE_PACKAGE_VERSION,
      );
      return root;
    });

    describe("the report handed back", () => {
      const writeReportFixture = Effect.gen(function* writeReport() {
        const currentSkillRoot = yield* currentSkillRootFixture;
        return yield* writeSkillVersions({
          repositoryRoot: currentSkillRoot,
          config: defaultIntentSkillsConfig,
        });
      });

      it.effect("names no failure", () =>
        Effect.gen(function* program() {
          const writeReport = yield* writeReportFixture;
          expect(writeReport).toStrictEqual({ failures: [] });
        }),
      );
    });

    describe("the skill file left behind", () => {
      const skillSourceFixture = Effect.gen(function* skillSource() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const currentSkillRoot = yield* currentSkillRootFixture;
        yield* writeSkillVersions({
          repositoryRoot: currentSkillRoot,
          config: defaultIntentSkillsConfig,
        });
        return yield* filesystem.readFileString(paths.join(currentSkillRoot, SKILL_PATH));
      });

      it.effect("reads exactly as it did before", () =>
        Effect.gen(function* program() {
          const skillSource = yield* skillSourceFixture;
          expect(skillSource).toBe(SKILL_NAMING_THE_PACKAGE_VERSION);
        }),
      );
    });
  });

  describe("a skill shipped by a package marked private", () => {
    const privateSkillRootFixture = Effect.gen(function* privateSkillRoot() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-skill-versions-",
      });

      yield* filesystem.makeDirectory(paths.join(root, "packages/internal/skills/core"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "packages/internal/package.json"),
        `{
  "name": "@example/internal",
  "version": "0.2.0",
  "private": true
}
`,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/internal/skills/core/SKILL.md"),
        SKILL_NAMING_AN_OLDER_VERSION,
      );
      return root;
    });

    describe("the report handed back", () => {
      const writeReportFixture = Effect.gen(function* writeReport() {
        const privateSkillRoot = yield* privateSkillRootFixture;
        return yield* writeSkillVersions({
          repositoryRoot: privateSkillRoot,
          config: defaultIntentSkillsConfig,
        });
      });

      it.effect("names no failure", () =>
        Effect.gen(function* program() {
          const writeReport = yield* writeReportFixture;
          expect(writeReport).toStrictEqual({ failures: [] });
        }),
      );
    });

    describe("the skill file left behind", () => {
      const skillSourceFixture = Effect.gen(function* skillSource() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const privateSkillRoot = yield* privateSkillRootFixture;
        yield* writeSkillVersions({
          repositoryRoot: privateSkillRoot,
          config: defaultIntentSkillsConfig,
        });
        return yield* filesystem.readFileString(
          paths.join(privateSkillRoot, "packages/internal/skills/core/SKILL.md"),
        );
      });

      it.effect("still names the older version", () =>
        Effect.gen(function* program() {
          const skillSource = yield* skillSourceFixture;
          expect(skillSource).toBe(SKILL_NAMING_AN_OLDER_VERSION);
        }),
      );
    });
  });

  describe("a skill shipped beside a manifest that declares no package name", () => {
    const namelessManifestRootFixture = Effect.gen(function* namelessManifestRoot() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-skill-versions-",
      });

      yield* filesystem.makeDirectory(paths.join(root, "fixtures/fragment/skills/core"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "fixtures/fragment/package.json"),
        `{ "version": "0.2.0" }
`,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "fixtures/fragment/skills/core/SKILL.md"),
        SKILL_NAMING_AN_OLDER_VERSION,
      );
      return root;
    });

    describe("the report handed back", () => {
      const writeReportFixture = Effect.gen(function* writeReport() {
        const namelessManifestRoot = yield* namelessManifestRootFixture;
        return yield* writeSkillVersions({
          repositoryRoot: namelessManifestRoot,
          config: defaultIntentSkillsConfig,
        });
      });

      it.effect("names no failure", () =>
        Effect.gen(function* program() {
          const writeReport = yield* writeReportFixture;
          expect(writeReport).toStrictEqual({ failures: [] });
        }),
      );
    });

    describe("the skill file left behind", () => {
      const skillSourceFixture = Effect.gen(function* skillSource() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const namelessManifestRoot = yield* namelessManifestRootFixture;
        yield* writeSkillVersions({
          repositoryRoot: namelessManifestRoot,
          config: defaultIntentSkillsConfig,
        });
        return yield* filesystem.readFileString(
          paths.join(namelessManifestRoot, "fixtures/fragment/skills/core/SKILL.md"),
        );
      });

      it.effect("still names the older version", () =>
        Effect.gen(function* program() {
          const skillSource = yield* skillSourceFixture;
          expect(skillSource).toBe(SKILL_NAMING_AN_OLDER_VERSION);
        }),
      );
    });
  });

  describe("a skill shipped beside a manifest that declares no version", () => {
    const versionlessManifestRootFixture = Effect.gen(function* versionlessManifestRoot() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-skill-versions-",
      });

      yield* filesystem.makeDirectory(paths.join(root, "packages/open/skills/core"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "packages/open/package.json"),
        `{ "name": "@example/open" }
`,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/open/skills/core/SKILL.md"),
        SKILL_NAMING_AN_OLDER_VERSION,
      );
      return root;
    });

    describe("the report handed back", () => {
      const writeReportFixture = Effect.gen(function* writeReport() {
        const versionlessManifestRoot = yield* versionlessManifestRootFixture;
        return yield* writeSkillVersions({
          repositoryRoot: versionlessManifestRoot,
          config: defaultIntentSkillsConfig,
        });
      });

      it.effect("names no failure", () =>
        Effect.gen(function* program() {
          const writeReport = yield* writeReportFixture;
          expect(writeReport).toStrictEqual({ failures: [] });
        }),
      );
    });

    describe("the skill file left behind", () => {
      const skillSourceFixture = Effect.gen(function* skillSource() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const versionlessManifestRoot = yield* versionlessManifestRootFixture;
        yield* writeSkillVersions({
          repositoryRoot: versionlessManifestRoot,
          config: defaultIntentSkillsConfig,
        });
        return yield* filesystem.readFileString(
          paths.join(versionlessManifestRoot, "packages/open/skills/core/SKILL.md"),
        );
      });

      it.effect("still names the older version", () =>
        Effect.gen(function* program() {
          const skillSource = yield* skillSourceFixture;
          expect(skillSource).toBe(SKILL_NAMING_AN_OLDER_VERSION);
        }),
      );
    });
  });

  describe("a skill file the writer is not allowed to open for writing", () => {
    const sealedSkillRootFixture = Effect.gen(function* sealedSkillRoot() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-skill-versions-",
      });

      yield* filesystem.makeDirectory(paths.join(root, "packages/versioned/skills/core"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "packages/versioned/package.json"),
        PUBLISHED_MANIFEST,
      );
      yield* filesystem.writeFileString(
        paths.join(root, SKILL_PATH),
        SKILL_NAMING_AN_OLDER_VERSION,
      );
      yield* filesystem.chmod(paths.join(root, SKILL_PATH), 0o444);
      return root;
    });

    const writeReportFixture = Effect.gen(function* writeReport() {
      const sealedSkillRoot = yield* sealedSkillRootFixture;
      return {
        sealedSkillRoot,
        report: yield* writeSkillVersions({
          repositoryRoot: sealedSkillRoot,
          config: defaultIntentSkillsConfig,
        }),
      };
    });

    it.effect("names the skill file and why it stayed as it was", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { sealedSkillRoot, report } = yield* writeReportFixture;
        expect(report).toStrictEqual({
          failures: [
            `${SKILL_PATH} could not be rewritten: EACCES: permission denied, open '${paths.join(sealedSkillRoot, SKILL_PATH)}'`,
          ],
        });
      }),
    );
  });
});
