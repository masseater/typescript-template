import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Path, Schema, Stream } from "effect";
import { ChildProcess } from "effect/unstable/process";
import { describe, expect, it } from "vite-plus/test";

import { capturedProcess } from "./captured-process.ts";
import { repositoryRoot } from "./repository-root.ts";

const RegisteredHook = Schema.Struct({ command: Schema.String });

const ClaudeSettings = Schema.Struct({
  hooks: Schema.Record(
    Schema.String,
    Schema.Array(Schema.Struct({ hooks: Schema.Array(RegisteredHook) })),
  ),
});

const WorkspaceManifest = Schema.Struct({
  bin: Schema.optional(Schema.Record(Schema.String, Schema.String)),
});

const SkippedCheckNotice = Schema.Struct({
  hookSpecificOutput: Schema.Struct({
    additionalContext: Schema.String,
    hookEventName: Schema.String,
  }),
});

const workspaceBinPattern = /vp exec -F (?<workspace>@repo\/[\w-]+) -- (?<bin>[\w-]+)$/u;

const directNodeRunPattern =
  /(?:^|[\s;&|(])node(?:\s+-{1,2}[\w-]+(?:=\S+)?)*\s+\S+\.[cm]?[jt]sx?\b/u;

const workspaceDirectories: Readonly<Record<string, string>> = {
  "@repo/ai-native": "tools/ai-native",
};

const directNodeRuns = (commands: readonly string[]): readonly string[] =>
  commands.filter((command) => directNodeRunPattern.test(command));

const { registeredEvents, undeclaredBins } = await Effect.runPromise(
  Effect.gen(function* settingsCommands() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const settings = yield* Schema.decodeEffect(Schema.fromJsonString(ClaudeSettings))(
      yield* filesystem.readFileString(paths.join(repositoryRoot, ".claude/settings.json")),
    );
    const events = Object.entries(settings.hooks).flatMap(([hookEvent, matcherGroups]) =>
      matcherGroups.flatMap((matcherGroup) =>
        matcherGroup.hooks.map((registered) => ({ command: registered.command, hookEvent })),
      ),
    );
    const undeclared = yield* Effect.filter(events, ({ command }) => {
      const groups = workspaceBinPattern.exec(command)?.groups;
      if (groups?.["workspace"] === undefined || groups["bin"] === undefined) {
        return Effect.succeed(true);
      }
      const directory = workspaceDirectories[groups["workspace"]];
      const bin = groups["bin"];
      return directory === undefined
        ? Effect.succeed(true)
        : Effect.map(
            Effect.flatMap(
              filesystem.readFileString(paths.join(repositoryRoot, directory, "package.json")),
              Schema.decodeEffect(Schema.fromJsonString(WorkspaceManifest)),
            ),
            (manifest) => manifest.bin?.[bin] === undefined,
          );
    });
    return { registeredEvents: events, undeclaredBins: undeclared.map(({ command }) => command) };
  }).pipe(Effect.provide(NodeServices.layer)),
);

const registeredCommands = registeredEvents.map(({ command }) => command);

const syncBaseWithoutVitePlus = await Effect.runPromise(
  Effect.scoped(
    Effect.forEach(
      registeredEvents.filter(({ command }) => command.endsWith("-- sync-base")),
      ({ command, hookEvent }) =>
        Effect.gen(function* syncBaseWithoutVitePlus() {
          const filesystem = yield* FileSystem.FileSystem;
          const home = yield* filesystem.makeTempDirectoryScoped({ prefix: "sync-base-home-" });
          const result = yield* capturedProcess(
            ChildProcess.make("sh", ["-c", command], {
              env: { CLAUDE_PROJECT_DIR: repositoryRoot, HOME: home, PATH: "/usr/bin:/bin" },
              stdin: Stream.encodeText(Stream.make("{}")),
            }),
          );
          const notice = yield* Schema.decodeEffect(Schema.fromJsonString(SkippedCheckNotice))(
            result.stdout,
          );
          return {
            exitCode: result.exitCode,
            hookEvent,
            noticeEvent: notice.hookSpecificOutput.hookEventName,
            saysUnchecked: notice.hookSpecificOutput.additionalContext.startsWith(
              "sync-base did not check whether the open pull request is behind its base",
            ),
          };
        }),
    ),
  ).pipe(Effect.provide(NodeServices.layer)),
);

describe(".claude/settings.json", () => {
  it("starts every hook through a bin its workspace declares", () => {
    expect(undeclaredBins).toStrictEqual([]);
  });

  it("runs no hook source file with node directly", () => {
    expect(directNodeRuns(registeredCommands)).toStrictEqual([]);
  });

  it("runs every hook command from the project directory", () => {
    expect(
      registeredCommands.filter((command) => !command.startsWith('cd "$CLAUDE_PROJECT_DIR" && ')),
    ).toStrictEqual([]);
  });

  it("tells the conversation that sync-base did not check the base where vp is not installed", () => {
    expect(syncBaseWithoutVitePlus).toStrictEqual(
      ["SessionStart", "UserPromptSubmit", "Stop"].map((hookEvent) => ({
        exitCode: 0,
        hookEvent,
        noticeEvent: hookEvent,
        saysUnchecked: true,
      })),
    );
  });
});

describe("a hook command that runs a source file with node", () => {
  it("is caught", () => {
    expect(
      directNodeRuns([
        "exec vp exec -F @repo/ai-native -- node --experimental-strip-types ./src/features/ai-native/sync-base/cli.ts",
        "exec node tools/ai-native/src/features/ai-native/worktree-home/cli.ts",
        "exec vp exec -F @repo/ai-native -- worktree-home",
      ]),
    ).toStrictEqual([
      "exec vp exec -F @repo/ai-native -- node --experimental-strip-types ./src/features/ai-native/sync-base/cli.ts",
      "exec node tools/ai-native/src/features/ai-native/worktree-home/cli.ts",
    ]);
  });
});
