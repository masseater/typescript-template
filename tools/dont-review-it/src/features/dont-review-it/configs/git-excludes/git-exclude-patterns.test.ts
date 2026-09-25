import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Config, Effect, FileSystem, Path } from "effect";
import { attempt } from "es-toolkit";
import { describe, expect } from "vite-plus/test";

import { gitExcludePatterns } from "./git-exclude-patterns.ts";

const searchPath = Config.String("PATH").pipe(Config.withDefault(""));

layer(NodeServices.layer)("gitExcludePatterns", (it) => {
  describe("a repository carrying a global excludes file, an info/exclude and a .gitignore", () => {
    const fixture = Effect.gen(function* patterns() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const home = yield* filesystem.makeTempDirectoryScoped({ prefix: "mst-git-excludes-home-" });
      yield* filesystem.writeFileString(
        paths.join(home, "global-ignore"),
        "# machine wide\n.agents/\n",
      );
      yield* filesystem.writeFileString(
        paths.join(home, ".gitconfig"),
        `[core]\n\texcludesFile = ${paths.join(home, "global-ignore")}\n`,
      );
      const env = {
        HOME: home,
        PATH: yield* searchPath,
      };
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "mst-git-excludes-repository-",
      });
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, ".git", "objects"), {
        recursive: true,
      });
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, ".git", "refs"), {
        recursive: true,
      });
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, ".git", "info"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, ".git", "HEAD"),
        "ref: refs/heads/main\n",
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, ".git", "info", "exclude"),
        "scratch/\n",
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, ".gitignore"),
        "dist/*\n!dist/keep.ts\n",
      );
      return gitExcludePatterns({ cwd: repositoryRoot, env });
    });

    it.effect("gathers all three, global first and the repository .gitignore last", () =>
      Effect.gen(function* program() {
        const patterns = yield* fixture;
        expect(patterns).toStrictEqual([".agents/", "scratch/", "dist/*", "!dist/keep.ts"]);
      }),
    );
  });

  describe("core.excludesFile left unset while XDG_CONFIG_HOME names a directory", () => {
    const fixture = Effect.gen(function* patterns() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const home = yield* filesystem.makeTempDirectoryScoped({ prefix: "mst-git-excludes-home-" });
      const configHome = paths.join(home, "config");
      yield* filesystem.makeDirectory(paths.join(configHome, "git"), { recursive: true });
      yield* filesystem.writeFileString(paths.join(configHome, "git", "ignore"), ".serena/\n");
      return gitExcludePatterns({
        cwd: home,
        env: {
          HOME: home,
          PATH: yield* searchPath,
          XDG_CONFIG_HOME: configHome,
        },
      });
    });

    it.effect("falls back to the ignore file under that directory", () =>
      Effect.gen(function* program() {
        const patterns = yield* fixture;
        expect(patterns).toStrictEqual([".serena/"]);
      }),
    );
  });

  describe("core.excludesFile left unset with no XDG_CONFIG_HOME", () => {
    const fixture = Effect.gen(function* patterns() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const home = yield* filesystem.makeTempDirectoryScoped({ prefix: "mst-git-excludes-home-" });
      yield* filesystem.makeDirectory(paths.join(home, ".config", "git"), { recursive: true });
      yield* filesystem.writeFileString(paths.join(home, ".config", "git", "ignore"), ".takt/\n");
      return gitExcludePatterns({
        cwd: home,
        env: {
          HOME: home,
          PATH: yield* searchPath,
        },
      });
    });

    it.effect("falls back to the ignore file under the home directory", () =>
      Effect.gen(function* program() {
        const patterns = yield* fixture;
        expect(patterns).toStrictEqual([".takt/"]);
      }),
    );
  });

  describe("a directory outside any repository holding no exclude file", () => {
    const fixture = Effect.gen(function* patterns() {
      const filesystem = yield* FileSystem.FileSystem;
      const home = yield* filesystem.makeTempDirectoryScoped({ prefix: "mst-git-excludes-home-" });
      return gitExcludePatterns({
        cwd: home,
        env: {
          HOME: home,
          PATH: yield* searchPath,
        },
      });
    });

    it.effect("yields no patterns", () =>
      Effect.gen(function* program() {
        const patterns = yield* fixture;
        expect(patterns).toStrictEqual([]);
      }),
    );
  });

  describe("an environment naming no home at all", () => {
    const fixtures = Effect.gen(function* homelessPatterns() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const homelessSandbox = yield* filesystem.makeTempDirectoryScoped({
        prefix: "mst-git-excludes-home-",
      });
      yield* filesystem.makeDirectory(paths.join(homelessSandbox, ".config", "git"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(homelessSandbox, ".config", "git", "ignore"),
        ".takt/\n",
      );
      const inheritedPath = yield* searchPath;
      return {
        patternsWithoutHome: gitExcludePatterns({
          cwd: homelessSandbox,
          env: {
            PATH: inheritedPath,
          },
        }),
        patternsWithEmptyHome: gitExcludePatterns({
          cwd: homelessSandbox,
          env: {
            HOME: "",
            PATH: inheritedPath,
          },
        }),
      };
    });

    it.effect("reads no global excludes file, as git does", () =>
      Effect.gen(function* program() {
        const patterns = yield* fixtures;
        expect(patterns).toStrictEqual({ patternsWithoutHome: [], patternsWithEmptyHome: [] });
      }),
    );
  });

  describe("a git that cannot be started at all", () => {
    const fixture = Effect.gen(function* unstartableGitFailure() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const home = yield* filesystem.makeTempDirectoryScoped({ prefix: "mst-git-excludes-home-" });
      const unstartablePath = yield* filesystem.makeTempDirectoryScoped({
        prefix: "mst-git-excludes-path-",
      });
      yield* filesystem.writeFileString(
        paths.join(unstartablePath, "git"),
        "#!/bin/sh\nkill -TERM $$\n",
        { mode: 0o755 },
      );
      const [unaskableGit] = attempt<readonly string[], Error>(() =>
        gitExcludePatterns({
          cwd: home,
          env: {
            HOME: home,
            PATH: unstartablePath,
          },
        }),
      );
      return unaskableGit;
    });

    it.effect("is raised rather than read as an absence of patterns", () =>
      Effect.gen(function* program() {
        const unstartableGitFailure = yield* fixture;
        expect(unstartableGitFailure).toStrictEqual(
          new Error("git config --type=path --get core.excludesFile could not be run"),
        );
      }),
    );
  });

  describe("a revision answer naming only one path", () => {
    const fixture = Effect.gen(function* patterns() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const home = yield* filesystem.makeTempDirectoryScoped({ prefix: "mst-git-excludes-home-" });
      const answeringPath = yield* filesystem.makeTempDirectoryScoped({
        prefix: "mst-git-excludes-path-",
      });
      yield* filesystem.writeFileString(
        paths.join(answeringPath, "git"),
        '#!/bin/sh\n[ "$1" = "rev-parse" ] && echo /the-only-line\nexit 0\n',
        { mode: 0o755 },
      );
      return gitExcludePatterns({
        cwd: home,
        env: {
          HOME: home,
          PATH: answeringPath,
        },
      });
    });

    it.effect("yields no repository exclude files", () =>
      Effect.gen(function* program() {
        const patterns = yield* fixture;
        expect(patterns).toStrictEqual([]);
      }),
    );
  });
});
