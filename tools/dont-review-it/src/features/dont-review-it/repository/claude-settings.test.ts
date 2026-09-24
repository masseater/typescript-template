import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Path, Schema, Stream } from "effect";
import { ChildProcess } from "effect/unstable/process";
import { describe, expect, it } from "vite-plus/test";

import { pathExists } from "../platform/file-system.ts";
import { capturedProcess } from "./captured-process.ts";
import { repositoryRoot } from "./repository-root.ts";

const ClaudeSettings = Schema.Struct({
  hooks: Schema.Record(
    Schema.String,
    Schema.Array(
      Schema.Struct({
        hooks: Schema.Array(Schema.Struct({ command: Schema.String })),
      }),
    ),
  ),
});

const packageScriptPattern =
  /vp exec -F (?<workspace>@repo\/[\w-]+) -- node --experimental-strip-types (?<script>\S+)/u;

const workspaceDirectories: Readonly<Record<string, string>> = {
  "@repo/ai-native": "tools/ai-native",
};

const { registeredCommands, unreachableScripts } = await Effect.runPromise(
  Effect.gen(function* settingsCommands() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const settings = yield* Schema.decodeEffect(Schema.fromJsonString(ClaudeSettings))(
      yield* filesystem.readFileString(paths.join(repositoryRoot, ".claude/settings.json")),
    );
    const commands = Object.values(settings.hooks)
      .flat()
      .flatMap((matcherGroup) => matcherGroup.hooks.map((registered) => registered.command));
    const unreachable = yield* Effect.filter(commands, (command) => {
      const groups = packageScriptPattern.exec(command)?.groups;
      if (groups?.["workspace"] === undefined || groups["script"] === undefined) {
        return Effect.succeed(false);
      }
      const directory = workspaceDirectories[groups["workspace"]];
      return directory === undefined
        ? Effect.succeed(true)
        : Effect.map(
            pathExists(paths.join(repositoryRoot, directory, groups["script"])),
            (present) => !present,
          );
    });
    return { registeredCommands: commands, unreachableScripts: unreachable };
  }).pipe(Effect.provide(NodeServices.layer)),
);

const exitCodesWithoutVitePlus = await Effect.runPromise(
  Effect.scoped(
    Effect.forEach(
      registeredCommands.filter((command) => command.includes("sync-base")),
      (command) =>
        Effect.gen(function* syncBaseWithoutVitePlus() {
          const filesystem = yield* FileSystem.FileSystem;
          const home = yield* filesystem.makeTempDirectoryScoped({ prefix: "sync-base-home-" });
          const result = yield* capturedProcess(
            ChildProcess.make("/bin/sh", ["-c", command], {
              env: { CLAUDE_PROJECT_DIR: repositoryRoot, HOME: home, PATH: "/usr/bin:/bin" },
              stdin: Stream.encodeText(Stream.make("{}")),
            }),
          );
          return result.exitCode;
        }),
    ),
  ).pipe(Effect.provide(NodeServices.layer)),
);

describe(".claude/settings.json", () => {
  it("runs every workspace hook through a script that exists", () => {
    expect(unreachableScripts).toStrictEqual([]);
  });

  it("runs every hook command from the project directory", () => {
    expect(
      registeredCommands.filter((command) => !command.startsWith('cd "$CLAUDE_PROJECT_DIR" && ')),
    ).toStrictEqual([]);
  });

  it("lets every sync-base hook end quietly on a host where vp is not installed", () => {
    expect(exitCodesWithoutVitePlus).toStrictEqual([0, 0, 0]);
  });
});
