import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path, Schema } from "effect";
import { describe, expect } from "vite-plus/test";

import { guidelineIndexProblems } from "./reconcile-guideline-index.ts";

const WORKSPACE_DEFINITION = "packages:\n  - packages/*\n";

const DECLARING_MANIFEST = JSON.stringify({ name: "example", lintRules: ["src/rules"] });

const DECLARING_ROOT_MANIFEST = JSON.stringify({
  name: "probe",
  normativeDocuments: { fileName: "AGENTS.md", directories: ["docs/guidelines"] },
});

const RULE_PATH = "packages/example/src/rules/no-thing--allow-it.ts";

const INDEX_PATH = "docs/lint-rules-by-guideline.md";

const RULE_STANDING_ON_NOTHING = `export const rule = {
  name: "no-thing--allow-it",
  meta: {
    docs: { description: "Disallow the thing", relatedGuidelines: [] },
    messages: { report: "No." },
  },
  create: () => ({}),
};
`;

const RULE_STANDING_ON_A_NORM = `export const rule = {
  name: "no-thing--allow-it",
  meta: {
    docs: { description: "Disallow the thing", relatedGuidelines: ["docs/guidelines/writing.md"] },
    messages: { report: "No." },
  },
  create: () => ({}),
};
`;

const MISSING = `A repository whose rules name their grounds must not go without \`${INDEX_PATH}\`. Generate it with \`dont-review-it check --write\`.`;

const STRANDED = `\`${INDEX_PATH}\` must not stand while nothing keeps it fresh. This repository declares no place for its normative documents, so nothing regenerates the table. Declare \`normativeDocuments\` in the root manifest, or delete the table.`;

const STALE = `\`${INDEX_PATH}\` must not fall behind the grounds its rules declare. Regenerate it with \`dont-review-it check --write\`.`;

layer(NodeServices.layer)("guidelineIndexProblems", (it) => {
  describe("a repository that declares no place for its norms", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "guideline-index-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/example/src/rules"), {
        recursive: true,
      });
      yield* filesystem.makeDirectory(paths.join(root, "docs/guidelines"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_DEFINITION,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "package.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({ name: "probe" }),
      );
      yield* filesystem.writeFileString(
        paths.join(root, "docs/guidelines/writing.md"),
        "# writing\n",
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/package.json"),
        DECLARING_MANIFEST,
      );
      yield* filesystem.writeFileString(paths.join(root, RULE_PATH), RULE_STANDING_ON_NOTHING);
      return yield* guidelineIndexProblems({ repositoryRoot: root, write: false });
    });

    it.effect("has no table to keep", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({ problems: [], scanned: 0 });
      }),
    );
  });

  describe("a table that is missing while the check only reads", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "guideline-index-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/example/src/rules"), {
        recursive: true,
      });
      yield* filesystem.makeDirectory(paths.join(root, "docs/guidelines"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_DEFINITION,
      );
      yield* filesystem.writeFileString(paths.join(root, "package.json"), DECLARING_ROOT_MANIFEST);
      yield* filesystem.writeFileString(
        paths.join(root, "docs/guidelines/writing.md"),
        "# writing\n",
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/package.json"),
        DECLARING_MANIFEST,
      );
      yield* filesystem.writeFileString(paths.join(root, RULE_PATH), RULE_STANDING_ON_A_NORM);
      return yield* guidelineIndexProblems({ repositoryRoot: root, write: false });
    });

    it.effect("is reported against the path it should have been written to", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [{ file: INDEX_PATH, message: MISSING }],
          scanned: 1,
        });
      }),
    );
  });

  describe("a table that is missing while the check may write", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "guideline-index-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/example/src/rules"), {
        recursive: true,
      });
      yield* filesystem.makeDirectory(paths.join(root, "docs/guidelines"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_DEFINITION,
      );
      yield* filesystem.writeFileString(paths.join(root, "package.json"), DECLARING_ROOT_MANIFEST);
      yield* filesystem.writeFileString(
        paths.join(root, "docs/guidelines/writing.md"),
        "# writing\n",
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/package.json"),
        DECLARING_MANIFEST,
      );
      yield* filesystem.writeFileString(paths.join(root, RULE_PATH), RULE_STANDING_ON_A_NORM);
      return yield* guidelineIndexProblems({ repositoryRoot: root, write: true });
    });

    it.effect("leaves nothing to report", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({ problems: [], scanned: 1 });
      }),
    );
  });

  describe("the file a generating run leaves behind", () => {
    const tableTextFixture = Effect.gen(function* tableText() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "guideline-index-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/example/src/rules"), {
        recursive: true,
      });
      yield* filesystem.makeDirectory(paths.join(root, "docs/guidelines"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_DEFINITION,
      );
      yield* filesystem.writeFileString(paths.join(root, "package.json"), DECLARING_ROOT_MANIFEST);
      yield* filesystem.writeFileString(
        paths.join(root, "docs/guidelines/writing.md"),
        "# writing\n",
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/package.json"),
        DECLARING_MANIFEST,
      );
      yield* filesystem.writeFileString(paths.join(root, RULE_PATH), RULE_STANDING_ON_A_NORM);
      yield* guidelineIndexProblems({ repositoryRoot: root, write: true });
      return yield* filesystem.readFileString(paths.join(root, INDEX_PATH));
    });

    it.effect("carries the norm as a heading and the rule beneath it", () =>
      Effect.gen(function* program() {
        const tableText = yield* tableTextFixture;
        expect(tableText).toMatchInlineSnapshot(`
        "# Rules by normative document

        Which lint rules of this repository declare each normative document as their grounds. Collected from those declarations alone, so what the off-the-shelf rules and the other checks cover is not in it. Generated; refresh it with \`dont-review-it check --write\` rather than editing it.

        <!-- BEGIN GENERATED rules-by-guideline -->

        ## [docs/guidelines/writing.md](../docs/guidelines/writing.md)

        | Rule | Description |
        | --- | --- |
        | [no-thing--allow-it](../packages/example/docs/lint/no-thing--allow-it.md) | Disallow the thing |

        <!-- END GENERATED rules-by-guideline -->
        "
      `);
      }),
    );
  });

  describe("a table that fell behind what the rules declare", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "guideline-index-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/example/src/rules"), {
        recursive: true,
      });
      yield* filesystem.makeDirectory(paths.join(root, "docs/guidelines"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_DEFINITION,
      );
      yield* filesystem.writeFileString(paths.join(root, "package.json"), DECLARING_ROOT_MANIFEST);
      yield* filesystem.writeFileString(
        paths.join(root, "docs/guidelines/writing.md"),
        "# writing\n",
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/package.json"),
        DECLARING_MANIFEST,
      );
      yield* filesystem.writeFileString(paths.join(root, RULE_PATH), RULE_STANDING_ON_A_NORM);
      yield* guidelineIndexProblems({ repositoryRoot: root, write: true });
      yield* filesystem.writeFileString(
        paths.join(root, INDEX_PATH),
        (yield* filesystem.readFileString(paths.join(root, INDEX_PATH))).replace(
          "no-thing--allow-it",
          "no-other--allow-it",
        ),
      );
      return yield* guidelineIndexProblems({ repositoryRoot: root, write: false });
    });

    it.effect("is reported as standing behind the grounds", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [{ file: INDEX_PATH, message: STALE }],
          scanned: 1,
        });
      }),
    );
  });

  describe("a repository whose declared place is not there", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "guideline-index-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/example/src/rules"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_DEFINITION,
      );
      yield* filesystem.writeFileString(paths.join(root, "package.json"), DECLARING_ROOT_MANIFEST);
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/package.json"),
        DECLARING_MANIFEST,
      );
      yield* filesystem.writeFileString(paths.join(root, RULE_PATH), RULE_STANDING_ON_A_NORM);
      return yield* guidelineIndexProblems({ repositoryRoot: root, write: false });
    });

    it.effect("has no table to keep", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({ problems: [], scanned: 0 });
      }),
    );
  });

  describe("a declared place holding something that is not a document", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "guideline-index-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/example/src/rules"), {
        recursive: true,
      });
      yield* filesystem.makeDirectory(paths.join(root, "docs/guidelines/rationales"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_DEFINITION,
      );
      yield* filesystem.writeFileString(paths.join(root, "package.json"), DECLARING_ROOT_MANIFEST);
      yield* filesystem.writeFileString(paths.join(root, "docs/guidelines/notes.txt"), "plain\n");
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/package.json"),
        DECLARING_MANIFEST,
      );
      yield* filesystem.writeFileString(paths.join(root, RULE_PATH), RULE_STANDING_ON_A_NORM);
      return yield* guidelineIndexProblems({ repositoryRoot: root, write: false });
    });

    it.effect("counts neither the nested place nor the file that is not a document", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({ problems: [], scanned: 0 });
      }),
    );
  });

  describe("a table that stands while the repository declares no place", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "guideline-index-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/example/src/rules"), {
        recursive: true,
      });
      yield* filesystem.makeDirectory(paths.join(root, "docs"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_DEFINITION,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "package.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({ name: "probe" }),
      );
      yield* filesystem.writeFileString(paths.join(root, INDEX_PATH), "# a table left behind\n");
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/package.json"),
        DECLARING_MANIFEST,
      );
      yield* filesystem.writeFileString(paths.join(root, RULE_PATH), RULE_STANDING_ON_A_NORM);
      return yield* guidelineIndexProblems({ repositoryRoot: root, write: false });
    });

    it.effect("is reported as standing while nothing keeps it fresh", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [{ file: INDEX_PATH, message: STRANDED }],
          scanned: 0,
        });
      }),
    );
  });
});
