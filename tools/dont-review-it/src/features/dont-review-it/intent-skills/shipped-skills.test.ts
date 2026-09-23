import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { defaultIntentSkillsConfig } from "./config.ts";
import { shippedSkillsProblems } from "./shipped-skills.ts";

layer(NodeServices.layer)("shippedSkillsProblems", (it) => {
  describe("a published package that carries a skill, packs it, and keywords it", () => {
    const scanFixture = Effect.gen(function* scan() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-intent-skills-",
      });

      const manifest = paths.join(repositoryRoot, "packages/shipped/package.json");
      const skill = paths.join(repositoryRoot, "packages/shipped/skills/core/SKILL.md");
      yield* filesystem.makeDirectory(paths.dirname(skill), { recursive: true });
      yield* filesystem.writeFileString(
        manifest,
        `{
  "name": "@example/shipped",
  "files": ["dist", "skills"],
  "keywords": ["tanstack-intent"]
}
`,
      );
      yield* filesystem.writeFileString(skill, "---\nname: core\n---\n");
      return yield* shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it.effect("is left alone", () =>
      Effect.gen(function* program() {
        const scan = yield* scanFixture;
        expect(scan).toStrictEqual({ problems: [], scanned: 1 });
      }),
    );
  });

  describe("a published package whose skill file sits below the first level", () => {
    const scanFixture = Effect.gen(function* scan() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-intent-skills-",
      });

      const manifest = paths.join(repositoryRoot, "packages/shipped/package.json");
      const skill = paths.join(repositoryRoot, "packages/shipped/skills/group/topic/SKILL.md");
      yield* filesystem.makeDirectory(paths.dirname(skill), { recursive: true });
      yield* filesystem.writeFileString(
        manifest,
        `{
  "name": "@example/shipped",
  "files": ["dist", "skills"],
  "keywords": ["tanstack-intent"]
}
`,
      );
      yield* filesystem.writeFileString(skill, "---\nname: topic\n---\n");
      return yield* shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it.effect("is left alone, because the nested file still counts as a shipped skill", () =>
      Effect.gen(function* program() {
        const scan = yield* scanFixture;
        expect(scan).toStrictEqual({ problems: [], scanned: 1 });
      }),
    );
  });

  describe("a private package without any skill wiring", () => {
    const scanFixture = Effect.gen(function* scan() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-intent-skills-",
      });

      const manifest = paths.join(repositoryRoot, "apps/site/package.json");
      yield* filesystem.makeDirectory(paths.dirname(manifest), { recursive: true });
      yield* filesystem.writeFileString(
        manifest,
        `{
  "name": "@example/site",
  "private": true
}
`,
      );
      return yield* shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it.effect("is left alone", () =>
      Effect.gen(function* program() {
        const scan = yield* scanFixture;
        expect(scan).toStrictEqual({ problems: [], scanned: 1 });
      }),
    );
  });

  describe("a private package carrying a skill file", () => {
    const scanFixture = Effect.gen(function* scan() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-intent-skills-",
      });

      const manifest = paths.join(repositoryRoot, "packages/internal/package.json");
      const skill = paths.join(repositoryRoot, "packages/internal/skills/core/SKILL.md");
      yield* filesystem.makeDirectory(paths.dirname(skill), { recursive: true });
      yield* filesystem.writeFileString(
        manifest,
        `{
  "name": "@example/internal",
  "private": true
}
`,
      );
      yield* filesystem.writeFileString(skill, "---\nname: core\n---\n");
      return yield* shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it.effect("is told at the private flag to delete the skills it can never ship", () =>
      Effect.gen(function* program() {
        const scan = yield* scanFixture;
        expect(scan).toMatchInlineSnapshot(`
        {
          "problems": [
            {
              "file": "packages/internal/package.json",
              "line": 3,
              "message": "A workspace-internal package must not carry TanStack Intent skills, because a skill that never ships trains agents on a surface nobody can install. Delete the skills directory, or let the package publish by removing "private": true.",
            },
          ],
          "scanned": 1,
        }
      `);
      }),
    );
  });

  describe("a private package naming skills in its files allowlist", () => {
    const scanFixture = Effect.gen(function* scan() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-intent-skills-",
      });

      const manifest = paths.join(repositoryRoot, "packages/internal/package.json");
      yield* filesystem.makeDirectory(paths.dirname(manifest), { recursive: true });
      yield* filesystem.writeFileString(
        manifest,
        `{
  "name": "@example/internal",
  "private": true,
  "files": ["dist", "skills"]
}
`,
      );
      return yield* shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it.effect("is told at the files allowlist to remove the entry", () =>
      Effect.gen(function* program() {
        const scan = yield* scanFixture;
        expect(scan).toMatchInlineSnapshot(`
        {
          "problems": [
            {
              "file": "packages/internal/package.json",
              "line": 4,
              "message": "The files allowlist of a workspace-internal package must not name the skills directory, because nothing is ever packed from a package that npm cannot publish. Remove "skills" from files.",
            },
          ],
          "scanned": 1,
        }
      `);
      }),
    );
  });

  describe("a private package carrying the discovery keyword", () => {
    const scanFixture = Effect.gen(function* scan() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-intent-skills-",
      });

      const manifest = paths.join(repositoryRoot, "packages/internal/package.json");
      yield* filesystem.makeDirectory(paths.dirname(manifest), { recursive: true });
      yield* filesystem.writeFileString(
        manifest,
        `{
  "name": "@example/internal",
  "private": true,
  "keywords": ["tanstack-intent"]
}
`,
      );
      return yield* shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it.effect("is told to remove the keyword that announces skills it never ships", () =>
      Effect.gen(function* program() {
        const scan = yield* scanFixture;
        expect(scan).toMatchInlineSnapshot(`
        {
          "problems": [
            {
              "file": "packages/internal/package.json",
              "line": 4,
              "message": "A workspace-internal package must not carry the tanstack-intent keyword, because discovery would announce skills the package never ships. Remove "tanstack-intent" from keywords.",
            },
          ],
          "scanned": 1,
        }
      `);
      }),
    );
  });

  describe("a private package carrying the skill file, the files entry, and the keyword", () => {
    const scanFixture = Effect.gen(function* scan() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-intent-skills-",
      });

      const manifest = paths.join(repositoryRoot, "packages/internal/package.json");
      const skill = paths.join(repositoryRoot, "packages/internal/skills/core/SKILL.md");
      yield* filesystem.makeDirectory(paths.dirname(skill), { recursive: true });
      yield* filesystem.writeFileString(
        manifest,
        `{
  "name": "@example/internal",
  "private": true,
  "files": ["skills"],
  "keywords": ["tanstack-intent"]
}
`,
      );
      yield* filesystem.writeFileString(skill, "---\nname: core\n---\n");
      return yield* shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it.effect("has every unnecessary piece reported separately", () =>
      Effect.gen(function* program() {
        const scan = yield* scanFixture;
        expect(scan).toMatchInlineSnapshot(`
        {
          "problems": [
            {
              "file": "packages/internal/package.json",
              "line": 3,
              "message": "A workspace-internal package must not carry TanStack Intent skills, because a skill that never ships trains agents on a surface nobody can install. Delete the skills directory, or let the package publish by removing "private": true.",
            },
            {
              "file": "packages/internal/package.json",
              "line": 4,
              "message": "The files allowlist of a workspace-internal package must not name the skills directory, because nothing is ever packed from a package that npm cannot publish. Remove "skills" from files.",
            },
            {
              "file": "packages/internal/package.json",
              "line": 5,
              "message": "A workspace-internal package must not carry the tanstack-intent keyword, because discovery would announce skills the package never ships. Remove "tanstack-intent" from keywords.",
            },
          ],
          "scanned": 1,
        }
      `);
      }),
    );
  });

  describe("an empty manifest", () => {
    const scanFixture = Effect.gen(function* scan() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-intent-skills-",
      });

      const manifest = paths.join(repositoryRoot, "fixtures/empty/package.json");
      yield* filesystem.makeDirectory(paths.dirname(manifest), { recursive: true });
      yield* filesystem.writeFileString(manifest, "");
      return yield* shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it.effect("is left alone", () =>
      Effect.gen(function* program() {
        const scan = yield* scanFixture;
        expect(scan).toStrictEqual({ problems: [], scanned: 1 });
      }),
    );
  });

  describe("a manifest without a name", () => {
    const scanFixture = Effect.gen(function* scan() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-intent-skills-",
      });

      const manifest = paths.join(repositoryRoot, "fixtures/fragment/package.json");
      yield* filesystem.makeDirectory(paths.dirname(manifest), { recursive: true });
      yield* filesystem.writeFileString(
        manifest,
        `{ "sideEffects": false }
`,
      );
      return yield* shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it.effect("is left alone", () =>
      Effect.gen(function* program() {
        const scan = yield* scanFixture;
        expect(scan).toStrictEqual({ problems: [], scanned: 1 });
      }),
    );
  });

  describe("a published package without any skill file", () => {
    const scanFixture = Effect.gen(function* scan() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-intent-skills-",
      });

      const manifest = paths.join(repositoryRoot, "packages/bare/package.json");
      yield* filesystem.makeDirectory(paths.dirname(manifest), { recursive: true });
      yield* filesystem.writeFileString(
        manifest,
        `{
  "name": "@example/bare",
  "files": ["dist", "skills"],
  "keywords": ["tanstack-intent"]
}
`,
      );
      return yield* shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it.effect("is told at its name to scaffold the skill it publishes nothing to load", () =>
      Effect.gen(function* program() {
        const scan = yield* scanFixture;
        expect(scan).toMatchInlineSnapshot(`
        {
          "problems": [
            {
              "file": "packages/bare/package.json",
              "line": 2,
              "message": "A package that npm can publish must not ship without a TanStack Intent skill, because an agent that installs it finds nothing to load. Create skills/<topic>/SKILL.md with npx @tanstack/intent scaffold, or mark the package "private": true.",
            },
          ],
          "scanned": 1,
        }
      `);
      }),
    );
  });

  describe("a files allowlist that drops the skills directory", () => {
    const scanFixture = Effect.gen(function* scan() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-intent-skills-",
      });

      const manifest = paths.join(repositoryRoot, "packages/dropped/package.json");
      const skill = paths.join(repositoryRoot, "packages/dropped/skills/core/SKILL.md");
      yield* filesystem.makeDirectory(paths.dirname(skill), { recursive: true });
      yield* filesystem.writeFileString(
        manifest,
        `{
  "name": "@example/dropped",
  "files": ["dist"],
  "keywords": ["tanstack-intent"]
}
`,
      );
      yield* filesystem.writeFileString(skill, "---\nname: core\n---\n");
      return yield* shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it.effect("is told at the files allowlist to add the entry back", () =>
      Effect.gen(function* program() {
        const scan = yield* scanFixture;
        expect(scan).toMatchInlineSnapshot(`
        {
          "problems": [
            {
              "file": "packages/dropped/package.json",
              "line": 3,
              "message": "The files allowlist must not leave out the skills directory, because npm packs only what files names and the published archive would drop every SKILL.md. Add "skills" to files.",
            },
          ],
          "scanned": 1,
        }
      `);
      }),
    );
  });

  describe("a published package without a files allowlist", () => {
    const scanFixture = Effect.gen(function* scan() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-intent-skills-",
      });

      const manifest = paths.join(repositoryRoot, "packages/open/package.json");
      const skill = paths.join(repositoryRoot, "packages/open/skills/core/SKILL.md");
      yield* filesystem.makeDirectory(paths.dirname(skill), { recursive: true });
      yield* filesystem.writeFileString(
        manifest,
        `{
  "name": "@example/open",
  "keywords": ["tanstack-intent"]
}
`,
      );
      yield* filesystem.writeFileString(skill, "---\nname: core\n---\n");
      return yield* shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it.effect("is left alone, because a manifest without the allowlist ships everything", () =>
      Effect.gen(function* program() {
        const scan = yield* scanFixture;
        expect(scan).toStrictEqual({ problems: [], scanned: 1 });
      }),
    );
  });

  describe("a published package without the discovery keyword", () => {
    const scanFixture = Effect.gen(function* scan() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-intent-skills-",
      });

      const manifest = paths.join(repositoryRoot, "packages/unlisted/package.json");
      const skill = paths.join(repositoryRoot, "packages/unlisted/skills/core/SKILL.md");
      yield* filesystem.makeDirectory(paths.dirname(skill), { recursive: true });
      yield* filesystem.writeFileString(
        manifest,
        `{
  "name": "@example/unlisted",
  "files": ["dist", "skills"]
}
`,
      );
      yield* filesystem.writeFileString(skill, "---\nname: core\n---\n");
      return yield* shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it.effect("is told to add the keyword discovery detects it by", () =>
      Effect.gen(function* program() {
        const scan = yield* scanFixture;
        expect(scan).toMatchInlineSnapshot(`
        {
          "problems": [
            {
              "file": "packages/unlisted/package.json",
              "line": 1,
              "message": "The manifest must not omit the tanstack-intent keyword, because TanStack Intent detects skill-shipping packages by it. Add "tanstack-intent" to keywords.",
            },
          ],
          "scanned": 1,
        }
      `);
      }),
    );
  });

  describe("a published package missing the skill file, the files entry, and the keyword", () => {
    const scanFixture = Effect.gen(function* scan() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-intent-skills-",
      });

      const manifest = paths.join(repositoryRoot, "packages/missing/package.json");
      yield* filesystem.makeDirectory(paths.dirname(manifest), { recursive: true });
      yield* filesystem.writeFileString(
        manifest,
        `{
  "name": "@example/missing",
  "files": ["dist"]
}
`,
      );
      return yield* shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it.effect("has every missing piece reported separately", () =>
      Effect.gen(function* program() {
        const scan = yield* scanFixture;
        expect(scan).toMatchInlineSnapshot(`
        {
          "problems": [
            {
              "file": "packages/missing/package.json",
              "line": 2,
              "message": "A package that npm can publish must not ship without a TanStack Intent skill, because an agent that installs it finds nothing to load. Create skills/<topic>/SKILL.md with npx @tanstack/intent scaffold, or mark the package "private": true.",
            },
            {
              "file": "packages/missing/package.json",
              "line": 3,
              "message": "The files allowlist must not leave out the skills directory, because npm packs only what files names and the published archive would drop every SKILL.md. Add "skills" to files.",
            },
            {
              "file": "packages/missing/package.json",
              "line": 1,
              "message": "The manifest must not omit the tanstack-intent keyword, because TanStack Intent detects skill-shipping packages by it. Add "tanstack-intent" to keywords.",
            },
          ],
          "scanned": 1,
        }
      `);
      }),
    );
  });
});
