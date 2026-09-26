import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Config, Effect, FileSystem, Layer } from "effect";
import { describe, expect, vi } from "vite-plus/test";

import { gitExecutablePath } from "../repository-checks/index.ts";
import { GitCommandFailed, gitEnvironmentLayer, runGitText } from "./git-text.ts";

const scratchDirectory = Effect.flatMap(FileSystem.FileSystem, (filesystem) =>
  filesystem.makeTempDirectoryScoped({ prefix: "stop-ai-slop-git-text-" }),
);

const stubbedVariable = (name: string, value: string) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      vi.stubEnv(name, value);
    }),
    () =>
      Effect.sync(() => {
        vi.unstubAllEnvs();
      }),
  );

const aliasRun = (alias: string) =>
  Effect.flatMap(scratchDirectory, (repositoryRoot) =>
    runGitText({ repositoryRoot, args: ["-c", `alias.probe=!${alias}`, "probe"] }),
  );

layer(Layer.provideMerge(gitEnvironmentLayer, NodeServices.layer))("runGitText", (it) => {
  describe("a successful Git command that writes to stderr", () => {
    it.effect("fails with the text Git wrote to stderr", () =>
      Effect.gen(function* program() {
        expect(yield* Effect.flip(aliasRun("printf notice >&2"))).toStrictEqual(
          GitCommandFailed.make({ message: "Git command wrote to stderr: notice" }),
        );
      }),
    );
  });

  describe("a Git command that exits with a failure", () => {
    it.effect("fails with the command and the text Git wrote to stderr", () =>
      Effect.gen(function* program() {
        const executable = gitExecutablePath(yield* Config.String("PATH"));
        expect(yield* Effect.flip(aliasRun("printf refused >&2; exit 3"))).toStrictEqual(
          GitCommandFailed.make({
            message: `Command failed: ${executable} -c alias.probe=!printf refused >&2; exit 3 probe\nrefused`,
          }),
        );
      }),
    );
  });

  describe("a caller environment holding a variable set to the empty string", () => {
    it.effect("hands the empty variable to Git", () =>
      Effect.gen(function* program() {
        yield* stubbedVariable("STOP_AI_SLOP_EMPTY", "");
        expect(yield* aliasRun("printenv STOP_AI_SLOP_EMPTY")).toBe("\n");
      }),
    );
  });

  describe("a caller environment holding a name that ends in a large number", () => {
    it.effect("hands the variable to Git without walking up to the number", () =>
      Effect.gen(function* program() {
        yield* stubbedVariable("STOP_AI_SLOP_PORT_99999999", "open");
        expect(yield* aliasRun("printenv STOP_AI_SLOP_PORT_99999999")).toBe("open\n");
      }),
    );
  });

  describe("a caller environment naming a repository of its own", () => {
    it.effect("keeps the repository variables away from Git", () =>
      Effect.gen(function* program() {
        yield* stubbedVariable("GIT_DIR", "/absent.git");
        expect(yield* aliasRun('printf "%s" "${GIT_DIR-unset}"')).toBe("unset");
      }),
    );
  });
});
