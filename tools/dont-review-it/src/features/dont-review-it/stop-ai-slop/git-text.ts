import { Config, Context, Effect, Layer, Option, Schema, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import { gitExecutablePath } from "../repository-checks/index.ts";

import type { PlatformError } from "effect/PlatformError";

export class GitCommandFailed extends Schema.TaggedError<GitCommandFailed>()("GitCommandFailed", {
  message: Schema.String,
  cause: Schema.optional(Schema.Defect()),
}) {}

export class GitEnvironment extends Context.Service<
  GitEnvironment,
  {
    readonly executable: string;
    readonly repositoryVariables: Readonly<Record<string, undefined>>;
  }
>()("@repo/dont-review-it/stop-ai-slop/GitEnvironment") {}

const OUTPUT_LIMIT_BYTES = 100 * 1024 * 1024;

type GitCommand = Readonly<{
  repositoryRoot: string;
  args: readonly string[];
  input?: Uint8Array;
}>;

type SpawnedGit = Readonly<{
  executable: string;
  variables: Readonly<Record<string, undefined>>;
  cwd: string | undefined;
  args: readonly string[];
  input: Uint8Array | undefined;
}>;

const lenientText = (bytes: Uint8Array): string => new TextDecoder("utf-8").decode(bytes);

const bytesWithinLimit = (
  stream: Stream.Stream<Uint8Array, PlatformError>,
  overflow: () => GitCommandFailed,
): Effect.Effect<Uint8Array, PlatformError | GitCommandFailed> =>
  stream.pipe(
    Stream.mapAccumEffect(
      () => 0,
      (seen, chunk: Uint8Array) => {
        const total = seen + chunk.length;
        return total > OUTPUT_LIMIT_BYTES
          ? Effect.fail(overflow())
          : Effect.succeed([total, [chunk]] as const);
      },
    ),
    Stream.mkUint8Array,
  );

const spawnedGit = Effect.fnUntraced(
  function* spawnedGit({ executable, variables, cwd, args: handedArgs, input }: SpawnedGit) {
    const spelled = [executable, ...handedArgs].join(" ");
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const handle = yield* spawner.spawn(
      ChildProcess.make(executable, [...handedArgs], {
        cwd,
        env: variables,
        extendEnv: true,
        stdin: input === undefined ? "ignore" : Stream.make(input),
      }),
    );
    const overflowOn = (stream: string) => () =>
      new GitCommandFailed({
        message: `Git command wrote more than ${OUTPUT_LIMIT_BYTES} bytes to ${stream}: ${spelled}`,
      });
    const [stdout, stderr, exitCode] = yield* Effect.all(
      [
        bytesWithinLimit(handle.stdout, overflowOn("stdout")),
        bytesWithinLimit(handle.stderr, overflowOn("stderr")),
        handle.exitCode,
      ],
      { concurrency: "unbounded" },
    );
    if (exitCode !== 0) {
      return yield* new GitCommandFailed({
        message: `Command failed: ${spelled}\n${lenientText(stderr)}`,
      });
    }
    if (stderr.length > 0) {
      return yield* new GitCommandFailed({
        message: `Git command wrote to stderr: ${lenientText(stderr)}`,
      });
    }
    return stdout;
  },
  Effect.scoped,
  Effect.catchTag("PlatformError", (failure) =>
    Effect.fail(new GitCommandFailed({ message: failure.message, cause: failure })),
  ),
);

export const gitEnvironmentLayer: Layer.Layer<
  GitEnvironment,
  GitCommandFailed,
  ChildProcessSpawner.ChildProcessSpawner
> = Layer.effect(
  GitEnvironment,
  Effect.gen(function* repositoryAgnosticEnvironment() {
    const searchPath = yield* Effect.orDie(Config.option(Config.String("PATH")));
    const executable = gitExecutablePath(Option.getOrUndefined(searchPath));
    const listed = yield* spawnedGit({
      executable,
      variables: {},
      cwd: undefined,
      args: ["rev-parse", "--local-env-vars"],
      input: undefined,
    });
    const names = lenientText(listed)
      .split("\n")
      .filter((name) => name !== "");
    return GitEnvironment.of({
      executable,
      repositoryVariables: Object.fromEntries(names.map((name) => [name, undefined])),
    });
  }),
);

export const runGitBuffer = Effect.fnUntraced(function* runGitBuffer({
  repositoryRoot,
  args,
  input,
}: GitCommand) {
  const { executable, repositoryVariables } = yield* GitEnvironment;
  return yield* spawnedGit({
    executable,
    variables: repositoryVariables,
    cwd: repositoryRoot,
    args,
    input,
  });
});

export const runGitText = (
  command: GitCommand,
): Effect.Effect<
  string,
  GitCommandFailed,
  ChildProcessSpawner.ChildProcessSpawner | GitEnvironment
> =>
  Effect.flatMap(runGitBuffer(command), (stdout) =>
    Effect.try({
      try: () => new TextDecoder("utf-8", { fatal: true }).decode(stdout),
      catch: (cause) =>
        new GitCommandFailed({
          message: `Git command wrote output that is not UTF-8: git ${command.args.join(" ")}`,
          cause,
        }),
    }),
  );
