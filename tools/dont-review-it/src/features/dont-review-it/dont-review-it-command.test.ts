import { NodeServices } from "@effect/platform-node";
import { runCommand } from "citty";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { dontReviewItCommand } from "./dont-review-it-command.ts";
import { RETIRED_ANNOTATION_TAGS } from "./lint/oxlint/lib/canonical-values/annotation.ts";
import { standardIoTest } from "./vitest/standard-io-test.ts";

const CANONICAL_VALUES_TAG = "@canonical-values";

const settledExitCode = Effect.sync(() => {
  const settled = process.exitCode;
  process.exitCode = 0;
  return typeof settled === "number" ? settled : 0;
});

describe("dontReviewItCommand", () => {
  describe("a repository whose annotation names the concept it declares", () => {
    const checked = Effect.gen(function* checked() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;

      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-cli-",
      });
      yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(root, "src/order.ts"),
        `/** ${CANONICAL_VALUES_TAG} order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n`,
      );
      yield* Effect.promise(() =>
        runCommand(dontReviewItCommand, {
          rawArgs: ["check", "--repository-root", root],
        }),
      );
    }).pipe(Effect.andThen(settledExitCode), Effect.scoped, Effect.provide(NodeServices.layer));

    const it = standardIoTest
      .extend("theExitCodeOfANamedAnnotation", () => Effect.runPromise(checked))
      .extend("theStandardOutputOfANamedAnnotation", ({ stdout }) =>
        Effect.runPromise(checked.pipe(Effect.map(() => stdout.text()))),
      )
      .extend("theEntryCompositionCheckIsNamedOnStandardErrorForANamedAnnotation", ({ stderr }) =>
        Effect.runPromise(
          checked.pipe(Effect.map(() => stderr.text().includes("entry-composition"))),
        ),
      );

    it("exits zero", ({ theExitCodeOfANamedAnnotation }) => {
      expect(theExitCodeOfANamedAnnotation).toBe(0);
    });

    it("stays silent on standard output", ({ theStandardOutputOfANamedAnnotation }) => {
      expect(theStandardOutputOfANamedAnnotation).toBe("");
    });

    it("names the entry-composition check on standard error", ({
      theEntryCompositionCheckIsNamedOnStandardErrorForANamedAnnotation,
    }) => {
      expect(theEntryCompositionCheckIsNamedOnStandardErrorForANamedAnnotation).toBe(true);
    });
  });

  describe("a check given no repository root", () => {
    const checked = Effect.gen(function* checked() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;

      const workingDirectory = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-cli-",
      });
      const previousWorkingDirectory = process.cwd();
      yield* filesystem.writeFileString(paths.join(workingDirectory, "package.json"), "{}");
      yield* Effect.acquireRelease(
        Effect.sync(() => {
          process.chdir(workingDirectory);
        }),
        () =>
          Effect.sync(() => {
            process.chdir(previousWorkingDirectory);
          }),
      );
      yield* Effect.promise(() => runCommand(dontReviewItCommand, { rawArgs: ["check"] }));
    }).pipe(Effect.andThen(settledExitCode), Effect.scoped, Effect.provide(NodeServices.layer));

    const it = standardIoTest
      .extend("theExitCodeWithoutARepositoryRoot", () => Effect.runPromise(checked))
      .extend("theMissingGuardEntryIsNamedOnStandardOutput", ({ stdout }) =>
        Effect.runPromise(
          checked.pipe(
            Effect.map(() => stdout.text().includes('required "guard" entry must not be missing')),
          ),
        ),
      )
      .extend("theWorkspaceOfTheWorkingDirectoryIsScanned", ({ stderr }) =>
        Effect.runPromise(
          checked.pipe(Effect.map(() => stderr.text().includes("canonical-values"))),
        ),
      )
      .extend(
        "theEntryCompositionCheckIsNamedOnStandardErrorWithoutARepositoryRoot",
        ({ stderr }) =>
          Effect.runPromise(
            checked.pipe(Effect.map(() => stderr.text().includes("entry-composition"))),
          ),
      );

    it("exits one", ({ theExitCodeWithoutARepositoryRoot }) => {
      expect(theExitCodeWithoutARepositoryRoot).toBe(1);
    });

    it("names the guard entry the working directory is missing on standard output", ({
      theMissingGuardEntryIsNamedOnStandardOutput,
    }) => {
      expect(theMissingGuardEntryIsNamedOnStandardOutput).toBe(true);
    });

    it("scans the workspace the working directory holds", ({
      theWorkspaceOfTheWorkingDirectoryIsScanned,
    }) => {
      expect(theWorkspaceOfTheWorkingDirectoryIsScanned).toBe(true);
    });

    it("names the entry-composition check on standard error", ({
      theEntryCompositionCheckIsNamedOnStandardErrorWithoutARepositoryRoot,
    }) => {
      expect(theEntryCompositionCheckIsNamedOnStandardErrorWithoutARepositoryRoot).toBe(true);
    });
  });

  describe("an annotation that names no concept in the working directory", () => {
    const checked = Effect.gen(function* checked() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;

      const workingDirectory = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-cli-",
      });
      const previousWorkingDirectory = process.cwd();
      yield* filesystem.makeDirectory(paths.join(workingDirectory, "src"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(workingDirectory, "src/order.ts"),
        `/** ${CANONICAL_VALUES_TAG} */\nexport const ORDER_STATUSES = ["draft"] as const;\n`,
      );
      yield* Effect.acquireRelease(
        Effect.sync(() => {
          process.chdir(workingDirectory);
        }),
        () =>
          Effect.sync(() => {
            process.chdir(previousWorkingDirectory);
          }),
      );
      yield* Effect.promise(() => runCommand(dontReviewItCommand, { rawArgs: ["check"] }));
    }).pipe(Effect.andThen(settledExitCode), Effect.scoped, Effect.provide(NodeServices.layer));

    const it = standardIoTest
      .extend("theExitCodeOfAnAnnotationInTheWorkingDirectory", () => Effect.runPromise(checked))
      .extend("theDeclarationSiteInTheWorkingDirectoryIsNamedOnStandardOutput", ({ stdout }) =>
        Effect.runPromise(checked.pipe(Effect.map(() => stdout.text().includes("src/order.ts:1")))),
      )
      .extend(
        "theEntryCompositionCheckIsNamedOnStandardErrorForTheWorkingDirectory",
        ({ stderr }) =>
          Effect.runPromise(
            checked.pipe(Effect.map(() => stderr.text().includes("entry-composition"))),
          ),
      );

    it("fails the check", ({ theExitCodeOfAnAnnotationInTheWorkingDirectory }) => {
      expect(theExitCodeOfAnAnnotationInTheWorkingDirectory).toBe(1);
    });

    it("names the declaration site the working directory holds", ({
      theDeclarationSiteInTheWorkingDirectoryIsNamedOnStandardOutput,
    }) => {
      expect(theDeclarationSiteInTheWorkingDirectoryIsNamedOnStandardOutput).toBe(true);
    });

    it("names the entry-composition check on standard error", ({
      theEntryCompositionCheckIsNamedOnStandardErrorForTheWorkingDirectory,
    }) => {
      expect(theEntryCompositionCheckIsNamedOnStandardErrorForTheWorkingDirectory).toBe(true);
    });
  });

  describe("a repository root glued to the flag", () => {
    const checked = Effect.gen(function* checked() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;

      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-cli-",
      });
      yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(root, "src/order.ts"),
        `/** ${CANONICAL_VALUES_TAG} order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n`,
      );
      yield* Effect.promise(() =>
        runCommand(dontReviewItCommand, { rawArgs: ["check", `--repository-root=${root}`] }),
      );
    }).pipe(Effect.andThen(settledExitCode), Effect.scoped, Effect.provide(NodeServices.layer));

    const it = standardIoTest
      .extend("theExitCodeOfAGluedRepositoryRoot", () => Effect.runPromise(checked))
      .extend("theStandardOutputOfAGluedRepositoryRoot", ({ stdout }) =>
        Effect.runPromise(checked.pipe(Effect.map(() => stdout.text()))),
      )
      .extend(
        "theEntryCompositionCheckIsNamedOnStandardErrorForAGluedRepositoryRoot",
        ({ stderr }) =>
          Effect.runPromise(
            checked.pipe(Effect.map(() => stderr.text().includes("entry-composition"))),
          ),
      );

    it("exits zero", ({ theExitCodeOfAGluedRepositoryRoot }) => {
      expect(theExitCodeOfAGluedRepositoryRoot).toBe(0);
    });

    it("stays silent on standard output", ({ theStandardOutputOfAGluedRepositoryRoot }) => {
      expect(theStandardOutputOfAGluedRepositoryRoot).toBe("");
    });

    it("names the entry-composition check on standard error", ({
      theEntryCompositionCheckIsNamedOnStandardErrorForAGluedRepositoryRoot,
    }) => {
      expect(theEntryCompositionCheckIsNamedOnStandardErrorForAGluedRepositoryRoot).toBe(true);
    });
  });

  describe("a workspace whose packages disagree on a dependency version", () => {
    const checked = Effect.gen(function* checked() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;

      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-cli-",
      });
      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\n",
      );
      yield* filesystem.makeDirectory(paths.join(root, "packages/web"), { recursive: true });
      yield* filesystem.makeDirectory(paths.join(root, "packages/site"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(root, "packages/web/package.json"),
        `{"devDependencies": {"typescript": "^5.0.0"}}`,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/site/package.json"),
        `{"devDependencies": {"typescript": "^5.5.0"}}`,
      );
      yield* Effect.promise(() =>
        runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] }),
      );
    }).pipe(Effect.andThen(settledExitCode), Effect.scoped, Effect.provide(NodeServices.layer));

    const it = standardIoTest
      .extend("theExitCodeOfAVersionDisagreement", () => Effect.runPromise(checked))
      .extend("theWarningOfAVersionDisagreementIsNamedOnStandardOutput", ({ stdout }) =>
        Effect.runPromise(checked.pipe(Effect.map(() => stdout.text().includes("warning: ")))),
      )
      .extend(
        "theEntryCompositionCheckIsNamedOnStandardErrorForAVersionDisagreement",
        ({ stderr }) =>
          Effect.runPromise(
            checked.pipe(Effect.map(() => stderr.text().includes("entry-composition"))),
          ),
      );

    it("exits zero", ({ theExitCodeOfAVersionDisagreement }) => {
      expect(theExitCodeOfAVersionDisagreement).toBe(0);
    });

    it("prints the disagreement as a warning", ({
      theWarningOfAVersionDisagreementIsNamedOnStandardOutput,
    }) => {
      expect(theWarningOfAVersionDisagreementIsNamedOnStandardOutput).toBe(true);
    });

    it("names the entry-composition check on standard error", ({
      theEntryCompositionCheckIsNamedOnStandardErrorForAVersionDisagreement,
    }) => {
      expect(theEntryCompositionCheckIsNamedOnStandardErrorForAVersionDisagreement).toBe(true);
    });
  });

  describe("an annotation that names no concept", () => {
    const checked = Effect.gen(function* checked() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;

      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-cli-",
      });
      yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(root, "src/order.ts"),
        `/** ${CANONICAL_VALUES_TAG} */\nexport const ORDER_STATUSES = ["draft"] as const;\n`,
      );
      yield* Effect.promise(() =>
        runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] }),
      );
    }).pipe(Effect.andThen(settledExitCode), Effect.scoped, Effect.provide(NodeServices.layer));

    const it = standardIoTest
      .extend("theExitCodeOfAnUnnamedAnnotation", () => Effect.runPromise(checked))
      .extend("theStandardOutputOfAnUnnamedAnnotation", ({ stdout }) =>
        Effect.runPromise(checked.pipe(Effect.map(() => stdout.text()))),
      )
      .extend("theDeclarationSiteOfAnUnnamedAnnotationIsNamedOnStandardOutput", ({ stdout }) =>
        Effect.runPromise(checked.pipe(Effect.map(() => stdout.text().includes("src/order.ts:1")))),
      )
      .extend(
        "theEntryCompositionCheckIsNamedOnStandardErrorForAnUnnamedAnnotation",
        ({ stderr }) =>
          Effect.runPromise(
            checked.pipe(Effect.map(() => stderr.text().includes("entry-composition"))),
          ),
      );

    it("exits one", ({ theExitCodeOfAnUnnamedAnnotation }) => {
      expect(theExitCodeOfAnUnnamedAnnotation).toBe(1);
    });

    it("records the whole report on standard output", ({
      theStandardOutputOfAnUnnamedAnnotation,
    }) => {
      expect(theStandardOutputOfAnUnnamedAnnotation).toMatchInlineSnapshot(`
        "src/order.ts:1 A canonical values annotation must name the concept it declares. Write the tag followed by a concept id built from lowercase words joined by "-" or ".".
        "
      `);
    });

    it("names the declaration site on standard output", ({
      theDeclarationSiteOfAnUnnamedAnnotationIsNamedOnStandardOutput,
    }) => {
      expect(theDeclarationSiteOfAnUnnamedAnnotationIsNamedOnStandardOutput).toBe(true);
    });

    it("names the entry-composition check on standard error", ({
      theEntryCompositionCheckIsNamedOnStandardErrorForAnUnnamedAnnotation,
    }) => {
      expect(theEntryCompositionCheckIsNamedOnStandardErrorForAnUnnamedAnnotation).toBe(true);
    });
  });

  describe("a broken annotation that sits in a dot directory", () => {
    const it = standardIoTest.extend(
      "theDeclarationSiteInADotDirectoryIsNamedOnStandardOutput",
      ({ stdout }) =>
        Effect.runPromise(
          Effect.gen(function* theDeclarationSiteInADotDirectoryIsNamedOnStandardOutput() {
            const filesystem = yield* FileSystem.FileSystem;
            const paths = yield* Path.Path;

            const root = yield* filesystem.makeTempDirectoryScoped({
              prefix: "dont-review-it-cli-",
            });
            yield* filesystem.makeDirectory(paths.join(root, ".config"), { recursive: true });
            yield* filesystem.writeFileString(
              paths.join(root, ".config/broken.ts"),
              `/** ${CANONICAL_VALUES_TAG} NOT VALID ID */\nexport const BROKEN_STATUSES = ["draft"] as const;\n`,
            );
            yield* Effect.promise(() =>
              runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] }),
            );
            process.exitCode = 0;
            return stdout.text().includes(".config/broken.ts:1");
          }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
        ),
    );

    it("names the declaration site the scan reached", ({
      theDeclarationSiteInADotDirectoryIsNamedOnStandardOutput,
    }) => {
      expect(theDeclarationSiteInADotDirectoryIsNamedOnStandardOutput).toBe(true);
    });
  });

  describe("a retired annotation tag left in a JavaScript file", () => {
    const checked = Effect.gen(function* checked() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;

      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-cli-",
      });
      yield* filesystem.makeDirectory(paths.join(root, "scripts"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(root, "scripts/legacy.mjs"),
        `/** ${RETIRED_ANNOTATION_TAGS[0]} */\nexport const LEGACY_STATUSES = ["draft"];\n`,
      );
      yield* Effect.promise(() =>
        runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] }),
      );
    }).pipe(Effect.andThen(settledExitCode), Effect.scoped, Effect.provide(NodeServices.layer));

    const it = standardIoTest
      .extend("theExitCodeOfARetiredAnnotationTag", () => Effect.runPromise(checked))
      .extend("theDeclarationSiteOfARetiredAnnotationTagIsNamedOnStandardOutput", ({ stdout }) =>
        Effect.runPromise(
          checked.pipe(Effect.map(() => stdout.text().includes("scripts/legacy.mjs:1"))),
        ),
      )
      .extend("theRetiredTagIsNamedOnStandardOutput", ({ stdout }) =>
        Effect.runPromise(
          checked.pipe(Effect.map(() => stdout.text().includes(RETIRED_ANNOTATION_TAGS[0] ?? ""))),
        ),
      );

    it("exits one", ({ theExitCodeOfARetiredAnnotationTag }) => {
      expect(theExitCodeOfARetiredAnnotationTag).toBe(1);
    });

    it("names the declaration site on standard output", ({
      theDeclarationSiteOfARetiredAnnotationTagIsNamedOnStandardOutput,
    }) => {
      expect(theDeclarationSiteOfARetiredAnnotationTagIsNamedOnStandardOutput).toBe(true);
    });

    it("names the retired tag on standard output", ({ theRetiredTagIsNamedOnStandardOutput }) => {
      expect(theRetiredTagIsNamedOnStandardOutput).toBe(true);
    });
  });

  describe("a concept a test file repeats", () => {
    const checked = Effect.gen(function* checked() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;

      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-cli-",
      });
      yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(root, "src/order.test.ts"),
        'const FIXTURE_STATUSES = ["draft"] as const;\n',
      );
      yield* filesystem.writeFileString(
        paths.join(root, "src/order.ts"),
        `/** ${CANONICAL_VALUES_TAG} order.status */\nexport const ORDER_STATUSES = ["draft"] as const;\n`,
      );
      yield* Effect.promise(() =>
        runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] }),
      );
    }).pipe(Effect.andThen(settledExitCode), Effect.scoped, Effect.provide(NodeServices.layer));

    const it = standardIoTest
      .extend("theExitCodeOfAConceptATestFileRepeats", () => Effect.runPromise(checked))
      .extend("theStandardOutputOfAConceptATestFileRepeats", ({ stdout }) =>
        Effect.runPromise(checked.pipe(Effect.map(() => stdout.text()))),
      )
      .extend(
        "theEntryCompositionCheckIsNamedOnStandardErrorForAConceptATestFileRepeats",
        ({ stderr }) =>
          Effect.runPromise(
            checked.pipe(Effect.map(() => stderr.text().includes("entry-composition"))),
          ),
      );

    it("is never reported against the declaration that owns it", ({
      theExitCodeOfAConceptATestFileRepeats,
    }) => {
      expect(theExitCodeOfAConceptATestFileRepeats).toBe(0);
    });

    it("stays silent on standard output", ({ theStandardOutputOfAConceptATestFileRepeats }) => {
      expect(theStandardOutputOfAConceptATestFileRepeats).toBe("");
    });

    it("names the entry-composition check on standard error", ({
      theEntryCompositionCheckIsNamedOnStandardErrorForAConceptATestFileRepeats,
    }) => {
      expect(theEntryCompositionCheckIsNamedOnStandardErrorForAConceptATestFileRepeats).toBe(true);
    });
  });

  describe("a value set that more than one concept declares", () => {
    const checked = Effect.gen(function* checked() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;

      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-cli-",
      });
      yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(root, "src/article.ts"),
        `/** ${CANONICAL_VALUES_TAG} article.status */\nexport const ARTICLE_STATUSES = ["published", "draft"] as const;\n`,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "src/order.ts"),
        `/** ${CANONICAL_VALUES_TAG} order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n`,
      );
      yield* Effect.promise(() =>
        runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] }),
      );
    }).pipe(Effect.andThen(settledExitCode), Effect.scoped, Effect.provide(NodeServices.layer));

    const it = standardIoTest
      .extend("theExitCodeOfASharedValueSet", () => Effect.runPromise(checked))
      .extend("theArticleConceptIsNamedOnStandardOutput", ({ stdout }) =>
        Effect.runPromise(checked.pipe(Effect.map(() => stdout.text().includes("article.status")))),
      )
      .extend("theOrderConceptIsNamedOnStandardOutput", ({ stdout }) =>
        Effect.runPromise(checked.pipe(Effect.map(() => stdout.text().includes("order.status")))),
      );

    it("is warned about without failing the check", ({ theExitCodeOfASharedValueSet }) => {
      expect(theExitCodeOfASharedValueSet).toBe(0);
    });

    it("names the first concept that declares it", ({
      theArticleConceptIsNamedOnStandardOutput,
    }) => {
      expect(theArticleConceptIsNamedOnStandardOutput).toBe(true);
    });

    it("names the second concept that declares it", ({
      theOrderConceptIsNamedOnStandardOutput,
    }) => {
      expect(theOrderConceptIsNamedOnStandardOutput).toBe(true);
    });
  });

  describe("an unknown command", () => {
    const it = standardIoTest.extend("theRejectionOfAnUnknownCommand", () =>
      Effect.tryPromise({
        try: () => runCommand(dontReviewItCommand, { rawArgs: ["publish"] }),
        catch: (rejection) => (rejection instanceof Error ? rejection.message : String(rejection)),
      }).pipe(
        Effect.match({
          onFailure: (message) => message,
          onSuccess: () => "the unknown command was accepted",
        }),
        Effect.ensuring(
          Effect.sync(() => {
            process.exitCode = 0;
          }),
        ),
        Effect.runPromise,
      ),
    );

    it("is rejected by name", ({ theRejectionOfAnUnknownCommand }) => {
      expect(theRejectionOfAnUnknownCommand).toMatchInlineSnapshot(`"Unknown command publish"`);
    });
  });

  describe("no command at all", () => {
    const it = standardIoTest.extend("theRejectionOfNoCommand", () =>
      Effect.tryPromise({
        try: () => runCommand(dontReviewItCommand, { rawArgs: [] }),
        catch: (rejection) => (rejection instanceof Error ? rejection.message : String(rejection)),
      }).pipe(
        Effect.match({
          onFailure: (message) => message,
          onSuccess: () => "no command at all was accepted",
        }),
        Effect.ensuring(
          Effect.sync(() => {
            process.exitCode = 0;
          }),
        ),
        Effect.runPromise,
      ),
    );

    it("is rejected instead of running anything", ({ theRejectionOfNoCommand }) => {
      expect(theRejectionOfNoCommand).toMatchInlineSnapshot(`"No command specified."`);
    });
  });

  describe("a repository root that is not a directory", () => {
    const checked = Effect.gen(function* checked() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;

      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-cli-",
      });
      yield* Effect.promise(() =>
        runCommand(dontReviewItCommand, {
          rawArgs: ["check", "--repository-root", paths.join(root, "missing")],
        }),
      );
    }).pipe(Effect.andThen(settledExitCode), Effect.scoped, Effect.provide(NodeServices.layer));

    const it = standardIoTest
      .extend("theExitCodeOfAMissingRepositoryRoot", () => Effect.runPromise(checked))
      .extend("theStandardOutputOfAMissingRepositoryRoot", ({ stdout }) =>
        Effect.runPromise(checked.pipe(Effect.map(() => stdout.text()))),
      )
      .extend("theMissingRepositoryRootIsNamedOnStandardError", ({ stderr }) =>
        Effect.runPromise(checked.pipe(Effect.map(() => stderr.text().includes("missing")))),
      );

    it("exits two instead of scanning nothing", ({ theExitCodeOfAMissingRepositoryRoot }) => {
      expect(theExitCodeOfAMissingRepositoryRoot).toBe(2);
    });

    it("stays silent on standard output", ({ theStandardOutputOfAMissingRepositoryRoot }) => {
      expect(theStandardOutputOfAMissingRepositoryRoot).toBe("");
    });

    it("names the root it could not read on standard error", ({
      theMissingRepositoryRootIsNamedOnStandardError,
    }) => {
      expect(theMissingRepositoryRootIsNamedOnStandardError).toBe(true);
    });
  });

  describe("an unknown option", () => {
    const it = standardIoTest
      .extend("theExitCodeOfAnUnknownOption", () =>
        Effect.runPromise(
          Effect.gen(function* theExitCodeOfAnUnknownOption() {
            yield* Effect.promise(() =>
              runCommand(dontReviewItCommand, { rawArgs: ["check", "--repo-root", "."] }),
            );
            const settled = process.exitCode;
            process.exitCode = 0;
            return typeof settled === "number" ? settled : 0;
          }),
        ),
      )
      .extend("theStandardOutputOfAnUnknownOption", ({ stdout }) =>
        Effect.runPromise(
          Effect.gen(function* theStandardOutputOfAnUnknownOption() {
            yield* Effect.promise(() =>
              runCommand(dontReviewItCommand, { rawArgs: ["check", "--repo-root", "."] }),
            );
            process.exitCode = 0;
            return stdout.text();
          }),
        ),
      )
      .extend("theStandardErrorOfAnUnknownOption", ({ stderr }) =>
        Effect.runPromise(
          Effect.gen(function* theStandardErrorOfAnUnknownOption() {
            yield* Effect.promise(() =>
              runCommand(dontReviewItCommand, { rawArgs: ["check", "--repo-root", "."] }),
            );
            process.exitCode = 0;
            return stderr.text();
          }),
        ),
      );

    it("exits two instead of falling back to a default", ({ theExitCodeOfAnUnknownOption }) => {
      expect(theExitCodeOfAnUnknownOption).toBe(2);
    });

    it("stays silent on standard output", ({ theStandardOutputOfAnUnknownOption }) => {
      expect(theStandardOutputOfAnUnknownOption).toBe("");
    });

    it("records the whole reason on standard error", ({ theStandardErrorOfAnUnknownOption }) => {
      expect(theStandardErrorOfAnUnknownOption).toMatchInlineSnapshot(`
        "Unknown option --repo-root. Run --help for usage.
        "
      `);
    });
  });

  describe("a repository where no body is spelled twice", () => {
    const checked = Effect.gen(function* checked() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;

      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-cli-",
      });
      yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(root, "src/twice.ts"),
        "export const twice = (value: number): number => value * 2;\n",
      );
      yield* filesystem.writeFileString(
        paths.join(root, "src/thrice.ts"),
        "export const thrice = (value: number): number => value * 3;\n",
      );
      yield* Effect.promise(() =>
        runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] }),
      );
    }).pipe(Effect.andThen(settledExitCode), Effect.scoped, Effect.provide(NodeServices.layer));

    const it = standardIoTest
      .extend("theExitCodeOfDistinctBodies", () => Effect.runPromise(checked))
      .extend("theStandardOutputOfDistinctBodies", ({ stdout }) =>
        Effect.runPromise(checked.pipe(Effect.map(() => stdout.text()))),
      )
      .extend("theEntryCompositionCheckIsNamedOnStandardErrorForDistinctBodies", ({ stderr }) =>
        Effect.runPromise(
          checked.pipe(Effect.map(() => stderr.text().includes("entry-composition"))),
        ),
      );

    it("exits zero", ({ theExitCodeOfDistinctBodies }) => {
      expect(theExitCodeOfDistinctBodies).toBe(0);
    });

    it("stays silent on standard output", ({ theStandardOutputOfDistinctBodies }) => {
      expect(theStandardOutputOfDistinctBodies).toBe("");
    });

    it("names the entry-composition check on standard error", ({
      theEntryCompositionCheckIsNamedOnStandardErrorForDistinctBodies,
    }) => {
      expect(theEntryCompositionCheckIsNamedOnStandardErrorForDistinctBodies).toBe(true);
    });
  });

  describe("a body spelled twice", () => {
    const checked = Effect.gen(function* checked() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;

      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-cli-",
      });
      yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(root, "src/twice.ts"),
        "export const twice = (value: number): number => value * 2;\n",
      );
      yield* filesystem.writeFileString(
        paths.join(root, "src/doubled.ts"),
        "export const doubled = (value: number): number => value * 2;\n",
      );
      yield* Effect.promise(() =>
        runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] }),
      );
    }).pipe(Effect.andThen(settledExitCode), Effect.scoped, Effect.provide(NodeServices.layer));

    const it = standardIoTest
      .extend("theExitCodeOfABodySpelledTwice", () => Effect.runPromise(checked))
      .extend("theDoubledSiteIsNamedOnStandardOutput", ({ stdout }) =>
        Effect.runPromise(
          checked.pipe(Effect.map(() => stdout.text().includes("src/doubled.ts:1 (doubled)"))),
        ),
      )
      .extend("theTwiceSiteIsNamedOnStandardOutput", ({ stdout }) =>
        Effect.runPromise(
          checked.pipe(Effect.map(() => stdout.text().includes("src/twice.ts:1 (twice)"))),
        ),
      );

    it("fails the check", ({ theExitCodeOfABodySpelledTwice }) => {
      expect(theExitCodeOfABodySpelledTwice).toBe(1);
    });

    it("names the site that repeated the body", ({ theDoubledSiteIsNamedOnStandardOutput }) => {
      expect(theDoubledSiteIsNamedOnStandardOutput).toBe(true);
    });

    it("names the site that already held the body", ({ theTwiceSiteIsNamedOnStandardOutput }) => {
      expect(theTwiceSiteIsNamedOnStandardOutput).toBe(true);
    });
  });

  describe("a body a test file repeats", () => {
    const checked = Effect.gen(function* checked() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;

      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-cli-",
      });
      yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(root, "src/twice.ts"),
        "export const twice = (value: number): number => value * 2;\n",
      );
      yield* filesystem.writeFileString(
        paths.join(root, "src/twice.test.ts"),
        "export const doubled = (value: number): number => value * 2;\n",
      );
      yield* Effect.promise(() =>
        runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] }),
      );
    }).pipe(Effect.andThen(settledExitCode), Effect.scoped, Effect.provide(NodeServices.layer));

    const it = standardIoTest
      .extend("theExitCodeOfABodyATestFileRepeats", () => Effect.runPromise(checked))
      .extend("theStandardOutputOfABodyATestFileRepeats", ({ stdout }) =>
        Effect.runPromise(checked.pipe(Effect.map(() => stdout.text()))),
      );

    it("is left out of the body scan", ({ theExitCodeOfABodyATestFileRepeats }) => {
      expect(theExitCodeOfABodyATestFileRepeats).toBe(0);
    });

    it("stays silent on standard output", ({ theStandardOutputOfABodyATestFileRepeats }) => {
      expect(theStandardOutputOfABodyATestFileRepeats).toBe("");
    });
  });

  describe("check --write on entries it may repair", () => {
    const it = standardIoTest
      .extend("theExitCodeOfARepairedEntryComposition", () =>
        Effect.runPromise(
          Effect.gen(function* theExitCodeOfARepairedEntryComposition() {
            const filesystem = yield* FileSystem.FileSystem;
            const paths = yield* Path.Path;

            const root = yield* filesystem.makeTempDirectoryScoped({
              prefix: "dont-review-it-cli-",
            });
            yield* filesystem.writeFileString(
              paths.join(root, "package.json"),
              `{ "scripts": { "guard": "vp check" } }`,
            );
            yield* filesystem.writeFileString(
              paths.join(root, "pnpm-workspace.yaml"),
              "packages:\n  - packages/*\n",
            );
            yield* filesystem.makeDirectory(paths.join(root, "packages/web"), { recursive: true });
            yield* filesystem.writeFileString(
              paths.join(root, "packages/web/package.json"),
              `{ "scripts": { "test": "vp test" } }`,
            );
            yield* Effect.promise(() =>
              runCommand(dontReviewItCommand, {
                rawArgs: ["check", "--write", "--repository-root", root],
              }),
            );
            const settled = process.exitCode;
            process.exitCode = 0;
            return typeof settled === "number" ? settled : 0;
          }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
        ),
      )
      .extend("theStandardOutputOfARepairedEntryComposition", ({ stdout }) =>
        Effect.runPromise(
          Effect.gen(function* theStandardOutputOfARepairedEntryComposition() {
            const filesystem = yield* FileSystem.FileSystem;
            const paths = yield* Path.Path;

            const root = yield* filesystem.makeTempDirectoryScoped({
              prefix: "dont-review-it-cli-",
            });
            yield* filesystem.writeFileString(
              paths.join(root, "package.json"),
              `{ "scripts": { "guard": "vp check" } }`,
            );
            yield* filesystem.writeFileString(
              paths.join(root, "pnpm-workspace.yaml"),
              "packages:\n  - packages/*\n",
            );
            yield* filesystem.makeDirectory(paths.join(root, "packages/web"), { recursive: true });
            yield* filesystem.writeFileString(
              paths.join(root, "packages/web/package.json"),
              `{ "scripts": { "test": "vp test" } }`,
            );
            yield* Effect.promise(() =>
              runCommand(dontReviewItCommand, {
                rawArgs: ["check", "--write", "--repository-root", root],
              }),
            );
            process.exitCode = 0;
            return stdout.text();
          }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
        ),
      )
      .extend(
        "theEntryCompositionCheckIsNamedOnStandardErrorForARepairedEntryComposition",
        ({ stderr }) =>
          Effect.runPromise(
            Effect.gen(
              function* theEntryCompositionCheckIsNamedOnStandardErrorForARepairedEntryComposition() {
                const filesystem = yield* FileSystem.FileSystem;
                const paths = yield* Path.Path;

                const root = yield* filesystem.makeTempDirectoryScoped({
                  prefix: "dont-review-it-cli-",
                });
                yield* filesystem.writeFileString(
                  paths.join(root, "package.json"),
                  `{ "scripts": { "guard": "vp check" } }`,
                );
                yield* filesystem.writeFileString(
                  paths.join(root, "pnpm-workspace.yaml"),
                  "packages:\n  - packages/*\n",
                );
                yield* filesystem.makeDirectory(paths.join(root, "packages/web"), {
                  recursive: true,
                });
                yield* filesystem.writeFileString(
                  paths.join(root, "packages/web/package.json"),
                  `{ "scripts": { "test": "vp test" } }`,
                );
                yield* Effect.promise(() =>
                  runCommand(dontReviewItCommand, {
                    rawArgs: ["check", "--write", "--repository-root", root],
                  }),
                );
                process.exitCode = 0;
                return stderr.text().includes("entry-composition");
              },
            ).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
          ),
      )
      .extend("theRepairedGuardScript", () =>
        Effect.runPromise(
          Effect.gen(function* theRepairedGuardScript() {
            const filesystem = yield* FileSystem.FileSystem;
            const paths = yield* Path.Path;

            const root = yield* filesystem.makeTempDirectoryScoped({
              prefix: "dont-review-it-cli-",
            });
            yield* filesystem.writeFileString(
              paths.join(root, "package.json"),
              `{ "scripts": { "guard": "vp check" } }`,
            );
            yield* filesystem.writeFileString(
              paths.join(root, "pnpm-workspace.yaml"),
              "packages:\n  - packages/*\n",
            );
            yield* filesystem.makeDirectory(paths.join(root, "packages/web"), { recursive: true });
            yield* filesystem.writeFileString(
              paths.join(root, "packages/web/package.json"),
              `{ "scripts": { "test": "vp test" } }`,
            );
            yield* Effect.promise(() =>
              runCommand(dontReviewItCommand, {
                rawArgs: ["check", "--write", "--repository-root", root],
              }),
            );
            process.exitCode = 0;
            return (yield* filesystem.readFileString(paths.join(root, "package.json"))).includes(
              "throttle --timeout 1800 -- spool -- vp check",
            );
          }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
        ),
      );

    it("exits zero", ({ theExitCodeOfARepairedEntryComposition }) => {
      expect(theExitCodeOfARepairedEntryComposition).toBe(0);
    });

    it("stays silent on standard output", ({ theStandardOutputOfARepairedEntryComposition }) => {
      expect(theStandardOutputOfARepairedEntryComposition).toBe("");
    });

    it("names the entry-composition check on standard error", ({
      theEntryCompositionCheckIsNamedOnStandardErrorForARepairedEntryComposition,
    }) => {
      expect(theEntryCompositionCheckIsNamedOnStandardErrorForARepairedEntryComposition).toBe(true);
    });

    it("wraps the guard script the repository declares", ({ theRepairedGuardScript }) => {
      expect(theRepairedGuardScript).toBe(true);
    });
  });

  describe("check --write on a workspace whose lint rule index is missing", () => {
    const it = standardIoTest.extend("theWrittenLintRuleIndexHeading", () =>
      Effect.runPromise(
        Effect.gen(function* theWrittenLintRuleIndexHeading() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;

          const root = yield* filesystem.makeTempDirectoryScoped({
            prefix: "dont-review-it-cli-",
          });
          yield* filesystem.writeFileString(
            paths.join(root, "pnpm-workspace.yaml"),
            "packages:\n  - packages/*\n",
          );
          yield* filesystem.writeFileString(
            paths.join(root, "package.json"),
            `{ "name": "probe" }`,
          );
          yield* filesystem.makeDirectory(paths.join(root, "packages/example/src/rules"), {
            recursive: true,
          });
          yield* filesystem.writeFileString(
            paths.join(root, "packages/example/package.json"),
            `{ "lintRules": ["src/rules"] }`,
          );
          yield* filesystem.writeFileString(
            paths.join(root, "packages/example/src/rules/no-thing--allow-it.ts"),
            `export const rule = {\n  name: "no-thing--allow-it",\n  meta: { docs: { description: "Disallow the thing" }, messages: { report: "No." } },\n  create: () => ({}),\n};\n`,
          );
          yield* Effect.promise(() =>
            runCommand(dontReviewItCommand, {
              rawArgs: ["check", "--write", "--repository-root", root],
            }),
          );
          process.exitCode = 0;
          return (yield* filesystem.readFileString(
            paths.join(root, "packages/example/docs/lint/index.md"),
          )).split("\n")[0];
        }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
      ),
    );

    it("writes the index", ({ theWrittenLintRuleIndexHeading }) => {
      expect(theWrittenLintRuleIndexHeading).toBe("# Lint rule index");
    });
  });

  describe("check --write on entries it must not repair", () => {
    const checked = Effect.gen(function* checked() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;

      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-cli-",
      });
      yield* filesystem.writeFileString(
        paths.join(root, "package.json"),
        `{ "scripts": { "guard": "throttle --timeout 1800 -- spool -- vp check" } }`,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\n",
      );
      yield* filesystem.makeDirectory(paths.join(root, "packages/web"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(root, "packages/web/package.json"),
        `{ "scripts": { "test": "throttle -- spool -- vp test" } }`,
      );
      yield* Effect.promise(() =>
        runCommand(dontReviewItCommand, {
          rawArgs: ["check", "--write", "--repository-root", root],
        }),
      );
    }).pipe(Effect.andThen(settledExitCode), Effect.scoped, Effect.provide(NodeServices.layer));

    const it = standardIoTest
      .extend("theExitCodeOfAnUnrepairableEntryComposition", () => Effect.runPromise(checked))
      .extend("theUnrepairableManifestIsNamedOnStandardOutput", ({ stdout }) =>
        Effect.runPromise(
          checked.pipe(Effect.map(() => stdout.text().includes("packages/web/package.json"))),
        ),
      )
      .extend(
        "theEntryCompositionCheckIsNamedOnStandardErrorForAnUnrepairableEntryComposition",
        ({ stderr }) =>
          Effect.runPromise(
            checked.pipe(Effect.map(() => stderr.text().includes("entry-composition"))),
          ),
      );

    it("exits one", ({ theExitCodeOfAnUnrepairableEntryComposition }) => {
      expect(theExitCodeOfAnUnrepairableEntryComposition).toBe(1);
    });

    it("names the manifest it must not repair", ({
      theUnrepairableManifestIsNamedOnStandardOutput,
    }) => {
      expect(theUnrepairableManifestIsNamedOnStandardOutput).toBe(true);
    });

    it("names the entry-composition check on standard error", ({
      theEntryCompositionCheckIsNamedOnStandardErrorForAnUnrepairableEntryComposition,
    }) => {
      expect(theEntryCompositionCheckIsNamedOnStandardErrorForAnUnrepairableEntryComposition).toBe(
        true,
      );
    });
  });

  describe("a manifest that exists but does not parse", () => {
    const checked = Effect.gen(function* checked() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;

      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-cli-",
      });
      yield* filesystem.writeFileString(paths.join(root, "package.json"), "{ oops");
      yield* Effect.promise(() =>
        runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] }),
      );
    }).pipe(Effect.andThen(settledExitCode), Effect.scoped, Effect.provide(NodeServices.layer));

    const it = standardIoTest
      .extend("theExitCodeOfAnUnparsableManifest", () => Effect.runPromise(checked))
      .extend("theStandardOutputOfAnUnparsableManifest", ({ stdout }) =>
        Effect.runPromise(checked.pipe(Effect.map(() => stdout.text()))),
      )
      .extend("theUnparsableManifestIsNamedOnStandardError", ({ stderr }) =>
        Effect.runPromise(
          checked.pipe(
            Effect.map(() =>
              stderr.text().includes("package.json exists but does not parse as a JSON object"),
            ),
          ),
        ),
      );

    it("exits two", ({ theExitCodeOfAnUnparsableManifest }) => {
      expect(theExitCodeOfAnUnparsableManifest).toBe(2);
    });

    it("stays silent on standard output", ({ theStandardOutputOfAnUnparsableManifest }) => {
      expect(theStandardOutputOfAnUnparsableManifest).toBe("");
    });

    it("names the manifest it could not read on standard error", ({
      theUnparsableManifestIsNamedOnStandardError,
    }) => {
      expect(theUnparsableManifestIsNamedOnStandardError).toBe(true);
    });
  });

  describe("check --write on a manifest that exists but does not parse", () => {
    const checked = Effect.gen(function* checked() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;

      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-cli-",
      });
      yield* filesystem.writeFileString(paths.join(root, "package.json"), "{ oops");
      yield* Effect.promise(() =>
        runCommand(dontReviewItCommand, {
          rawArgs: ["check", "--write", "--repository-root", root],
        }),
      );
    }).pipe(Effect.andThen(settledExitCode), Effect.scoped, Effect.provide(NodeServices.layer));

    const it = standardIoTest
      .extend("theExitCodeOfWritingToAnUnparsableManifest", () => Effect.runPromise(checked))
      .extend("theUnparsableManifestIsNamedOnStandardErrorWhileWriting", ({ stderr }) =>
        Effect.runPromise(
          checked.pipe(
            Effect.map(() =>
              stderr.text().includes("package.json exists but does not parse as a JSON object"),
            ),
          ),
        ),
      );

    it("exits two", ({ theExitCodeOfWritingToAnUnparsableManifest }) => {
      expect(theExitCodeOfWritingToAnUnparsableManifest).toBe(2);
    });

    it("names the manifest it could not read on standard error", ({
      theUnparsableManifestIsNamedOnStandardErrorWhileWriting,
    }) => {
      expect(theUnparsableManifestIsNamedOnStandardErrorWhileWriting).toBe(true);
    });
  });

  describe("a workflow definition that narrows its own start", () => {
    const checked = Effect.gen(function* checked() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;

      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-cli-",
      });
      yield* filesystem.makeDirectory(paths.join(root, ".github/workflows"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, ".github/workflows/ci.yml"),
        "on:\n  pull_request:\n    paths: [src/**]\npermissions:\n  contents: read\njobs:\n  ready:\n    steps:\n      - run: vp run guard\n",
      );
      yield* Effect.promise(() =>
        runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] }),
      );
    }).pipe(Effect.andThen(settledExitCode), Effect.scoped, Effect.provide(NodeServices.layer));

    const it = standardIoTest
      .extend("theExitCodeOfANarrowedWorkflowStart", () => Effect.runPromise(checked))
      .extend("theNarrowedWorkflowStartIsNamedOnStandardOutput", ({ stdout }) =>
        Effect.runPromise(
          checked.pipe(Effect.map(() => stdout.text().includes(".github/workflows/ci.yml:3"))),
        ),
      );

    it("fails the check", ({ theExitCodeOfANarrowedWorkflowStart }) => {
      expect(theExitCodeOfANarrowedWorkflowStart).toBe(1);
    });

    it("names the line that narrowed the start", ({
      theNarrowedWorkflowStartIsNamedOnStandardOutput,
    }) => {
      expect(theNarrowedWorkflowStartIsNamedOnStandardOutput).toBe(true);
    });
  });

  describe("a workflow definition that keeps every discipline", () => {
    const checked = Effect.gen(function* checked() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;

      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-cli-",
      });
      yield* filesystem.writeFileString(paths.join(root, "renovate.json"), "{}\n");
      yield* filesystem.makeDirectory(paths.join(root, ".github/workflows"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, ".github/workflows/ci.yml"),
        "name: CI\non:\n  pull_request:\npermissions:\n  contents: read\njobs:\n  ready:\n    steps:\n      - run: vp run guard\n",
      );
      yield* Effect.promise(() =>
        runCommand(dontReviewItCommand, { rawArgs: ["check", "--repository-root", root] }),
      );
    }).pipe(Effect.andThen(settledExitCode), Effect.scoped, Effect.provide(NodeServices.layer));

    const it = standardIoTest
      .extend("theExitCodeOfADisciplinedWorkflow", () => Effect.runPromise(checked))
      .extend("theStandardOutputOfADisciplinedWorkflow", ({ stdout }) =>
        Effect.runPromise(checked.pipe(Effect.map(() => stdout.text()))),
      )
      .extend(
        "theEntryCompositionCheckIsNamedOnStandardErrorForADisciplinedWorkflow",
        ({ stderr }) =>
          Effect.runPromise(
            checked.pipe(Effect.map(() => stderr.text().includes("entry-composition"))),
          ),
      );

    it("exits zero", ({ theExitCodeOfADisciplinedWorkflow }) => {
      expect(theExitCodeOfADisciplinedWorkflow).toBe(0);
    });

    it("stays silent on standard output", ({ theStandardOutputOfADisciplinedWorkflow }) => {
      expect(theStandardOutputOfADisciplinedWorkflow).toBe("");
    });

    it("names the entry-composition check on standard error", ({
      theEntryCompositionCheckIsNamedOnStandardErrorForADisciplinedWorkflow,
    }) => {
      expect(theEntryCompositionCheckIsNamedOnStandardErrorForADisciplinedWorkflow).toBe(true);
    });
  });
});
