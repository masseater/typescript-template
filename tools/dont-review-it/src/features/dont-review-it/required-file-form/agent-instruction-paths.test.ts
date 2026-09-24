import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { agentInstructionPathsIn } from "./agent-instruction-paths.ts";
import { defaultRequiredFileFormConfig } from "./config.ts";

const PACKAGE_ROOT = "tools/example";

const unresolvedMessage = (reference: string): string =>
  `Agent instructions must not name a path that does not exist. \`${reference}\` resolves neither from ${PACKAGE_ROOT} nor from the repository root. Point it at the current location, or drop the reference.`;

const problemsFor = (instructions: string | null) =>
  Effect.gen(function* problemsFor() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
      prefix: "agent-instruction-paths-",
    });
    const packageDirectory = paths.join(repositoryRoot, PACKAGE_ROOT);

    yield* filesystem.makeDirectory(paths.join(packageDirectory, "src", "features"), {
      recursive: true,
    });
    yield* filesystem.writeFileString(paths.join(packageDirectory, "src", "present.ts"), "");
    yield* filesystem.writeFileString(paths.join(repositoryRoot, "DESIGN.md"), "# design\n");
    if (instructions !== null) {
      yield* filesystem.writeFileString(paths.join(packageDirectory, "AGENTS.md"), instructions);
    }

    return yield* agentInstructionPathsIn({
      repositoryRoot,
      packageRoot: PACKAGE_ROOT,
      config: defaultRequiredFileFormConfig,
    });
  });

layer(NodeServices.layer)("agentInstructionPathsIn", (it) => {
  describe("a directory without instructions", () => {
    it.effect("says nothing about it", () =>
      Effect.gen(function* program() {
        expect(yield* problemsFor(null)).toStrictEqual([]);
      }),
    );
  });

  describe("instructions naming paths that exist", () => {
    it.effect("accepts paths from the package and from the repository root", () =>
      Effect.gen(function* program() {
        const problems = yield* problemsFor(
          "# AGENTS.md\n\n- MUST: read `src/present.ts` and `src/features/`.\n- Follow `DESIGN.md`.\n",
        );
        expect(problems).toStrictEqual([]);
      }),
    );
  });

  describe("instructions naming a path that is gone", () => {
    it.effect("reports the reference with its line", () =>
      Effect.gen(function* program() {
        const problems = yield* problemsFor(
          "# AGENTS.md\n\n- ok: `src/present.ts`\n- MUST: read `src/absent.ts`.\n- also `NOTES.md`\n",
        );
        expect(problems).toStrictEqual([
          {
            file: `${PACKAGE_ROOT}/AGENTS.md`,
            line: 4,
            message: unresolvedMessage("src/absent.ts"),
          },
          {
            file: `${PACKAGE_ROOT}/AGENTS.md`,
            line: 5,
            message: unresolvedMessage("NOTES.md"),
          },
        ]);
      }),
    );
  });

  describe("inline code that is not a file path", () => {
    it.effect("leaves routes, package specifiers, export subpaths, URLs and commands alone", () =>
      Effect.gen(function* program() {
        const problems = yield* problemsFor(
          [
            "# AGENTS.md",
            "",
            "- `/wiki` and `/mcp`",
            "- `@repo/db/admin` and `@better-auth/oauth-provider`",
            "- `./optional-setting` and `.`",
            "- `https://example.com/missing.md`",
            "- `service.name` and `vp install` and `[[term]]`",
            "",
          ].join("\n"),
        );
        expect(problems).toStrictEqual([]);
      }),
    );
  });

  describe("a fenced code block naming a missing path", () => {
    it.effect("does not treat the block as a reference", () =>
      Effect.gen(function* program() {
        const problems = yield* problemsFor("# AGENTS.md\n\n```sh\ncat src/absent.ts\n```\n");
        expect(problems).toStrictEqual([]);
      }),
    );
  });
});
