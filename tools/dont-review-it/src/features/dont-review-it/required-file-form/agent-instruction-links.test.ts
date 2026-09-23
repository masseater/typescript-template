import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { agentInstructionLinksIn } from "./agent-instruction-links.ts";
import { defaultRequiredFileFormConfig } from "./config.ts";

const PACKAGE_ROOT = ".";

const MISSING_LINK =
  "A directory that instructs agents must not leave the second name unreachable. Create it here as a symbolic link to AGENTS.md.";

const INSTRUCTIONS_UNDER_THE_LINK =
  "Agent instructions must not live under CLAUDE.md alone. Write them here and leave CLAUDE.md pointing at this file.";

const SPELLED_TWICE =
  "Agent instructions must not be spelled twice. Replace this file with a symbolic link to AGENTS.md.";

layer(NodeServices.layer)("agentInstructionLinksIn", (it) => {
  describe("a directory holding neither name", () => {
    const problemsFixture = Effect.gen(function* problems() {
      const filesystem = yield* FileSystem.FileSystem;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "agent-instruction-links-",
      });

      return yield* agentInstructionLinksIn({
        repositoryRoot,
        packageRoot: PACKAGE_ROOT,
        config: defaultRequiredFileFormConfig,
      });
    });

    it.effect("says nothing about it", () =>
      Effect.gen(function* program() {
        const problems = yield* problemsFixture;
        expect(problems).toStrictEqual([]);
      }),
    );
  });

  describe("a directory holding the instructions with no second name", () => {
    const problemsFixture = Effect.gen(function* problems() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "agent-instruction-links-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "AGENTS.md"),
        "# instructions\n",
      );
      return yield* agentInstructionLinksIn({
        repositoryRoot,
        packageRoot: PACKAGE_ROOT,
        config: defaultRequiredFileFormConfig,
      });
    });

    it.effect("asks for the second name as a link", () =>
      Effect.gen(function* program() {
        const problems = yield* problemsFixture;
        expect(problems).toStrictEqual([{ file: "CLAUDE.md", line: null, message: MISSING_LINK }]);
      }),
    );
  });

  describe("a directory holding the second name alone", () => {
    const problemsFixture = Effect.gen(function* problems() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "agent-instruction-links-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "CLAUDE.md"),
        "# instructions\n",
      );
      return yield* agentInstructionLinksIn({
        repositoryRoot,
        packageRoot: PACKAGE_ROOT,
        config: defaultRequiredFileFormConfig,
      });
    });

    it.effect("asks for the instructions under the first name", () =>
      Effect.gen(function* program() {
        const problems = yield* problemsFixture;
        expect(problems).toStrictEqual([
          { file: "AGENTS.md", line: null, message: INSTRUCTIONS_UNDER_THE_LINK },
        ]);
      }),
    );
  });

  describe("a directory spelling the instructions under both names", () => {
    const problemsFixture = Effect.gen(function* problems() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "agent-instruction-links-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "AGENTS.md"),
        "# instructions\n",
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "CLAUDE.md"),
        "# instructions\n",
      );
      return yield* agentInstructionLinksIn({
        repositoryRoot,
        packageRoot: PACKAGE_ROOT,
        config: defaultRequiredFileFormConfig,
      });
    });

    it.effect("asks for the second name to become a link", () =>
      Effect.gen(function* program() {
        const problems = yield* problemsFixture;
        expect(problems).toStrictEqual([{ file: "CLAUDE.md", line: null, message: SPELLED_TWICE }]);
      }),
    );
  });

  describe("a second name linked at something other than the instructions", () => {
    const problemsFixture = Effect.gen(function* problems() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "agent-instruction-links-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "AGENTS.md"),
        "# instructions\n",
      );
      yield* filesystem.writeFileString(paths.join(repositoryRoot, "README.md"), "# readme\n");
      yield* filesystem.symlink("README.md", paths.join(repositoryRoot, "CLAUDE.md"));
      return yield* agentInstructionLinksIn({
        repositoryRoot,
        packageRoot: PACKAGE_ROOT,
        config: defaultRequiredFileFormConfig,
      });
    });

    it.effect("asks for the link to point at the instructions", () =>
      Effect.gen(function* program() {
        const problems = yield* problemsFixture;
        expect(problems).toStrictEqual([{ file: "CLAUDE.md", line: null, message: SPELLED_TWICE }]);
      }),
    );
  });

  describe("a second name linked at the instructions", () => {
    const problemsFixture = Effect.gen(function* problems() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "agent-instruction-links-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "AGENTS.md"),
        "# instructions\n",
      );
      yield* filesystem.symlink("AGENTS.md", paths.join(repositoryRoot, "CLAUDE.md"));
      return yield* agentInstructionLinksIn({
        repositoryRoot,
        packageRoot: PACKAGE_ROOT,
        config: defaultRequiredFileFormConfig,
      });
    });

    it.effect("says nothing about it", () =>
      Effect.gen(function* program() {
        const problems = yield* problemsFixture;
        expect(problems).toStrictEqual([]);
      }),
    );
  });
});
