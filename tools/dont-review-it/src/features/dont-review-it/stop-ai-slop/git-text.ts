import { ConfigProvider, Context, Effect, Layer, Schema, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import { gitExecutablePath } from "../repository-checks/index.ts";

export class GitCommandFailed extends Schema.TaggedError<GitCommandFailed>()("GitCommandFailed", {
  message: Schema.String,
  cause: Schema.optional(Schema.Defect()),
}) {}

type GitCommand = Readonly<{
  repositoryRoot: string;
  args: readonly string[];
}>;

type EnvironmentEntry = readonly [string, string];

const childKeysOf = (node: ConfigProvider.Node): readonly (string | number)[] => {
  switch (node._tag) {
    case "Value":
      return [];
    case "Record":
      return [...node.keys];
    case "Array":
      return Array.from({ length: node.length }, (_, index) => index);
  }
};

const environmentEntriesAt = (
  provider: ConfigProvider.ConfigProvider,
  spelledPath: ConfigProvider.Path,
): Effect.Effect<readonly EnvironmentEntry[], ConfigProvider.SourceError> =>
  Effect.flatMap(provider.load(spelledPath), (node) => {
    if (node === undefined) return Effect.succeed([]);
    const own: readonly EnvironmentEntry[] =
      node.value === undefined ? [] : [[spelledPath.join("_"), node.value]];
    return Effect.map(
      Effect.forEach(childKeysOf(node), (key) =>
        environmentEntriesAt(provider, [...spelledPath, key]),
      ),
      (nested) => [...own, ...nested.flat()],
    );
  });

export class GitEnvironment extends Context.Service<
  GitEnvironment,
  { readonly variables: Readonly<Record<string, string>> }
>()("@repo/dont-review-it/stop-ai-slop/GitEnvironment") {}

const failedCommand = (message: string): GitCommandFailed => new GitCommandFailed({ message });

export const gitEnvironmentLayer: Layer.Layer<GitEnvironment, GitCommandFailed> = Layer.effect(
  GitEnvironment,
  Effect.gen(function* repositoryAgnosticEnvironment() {
    const provider = yield* ConfigProvider.ConfigProvider;
    const entries = yield* environmentEntriesAt(provider, []).pipe(
      Effect.mapError(
        (failure) => new GitCommandFailed({ message: failure.message, cause: failure }),
      ),
    );
    return GitEnvironment.of({
      variables: Object.fromEntries(entries.filter(([spelled]) => !spelled.startsWith("GIT_"))),
    });
  }),
);

const lenientText = (bytes: Uint8Array): string => new TextDecoder("utf-8").decode(bytes);

export const runGitBuffer = Effect.fn("runGitBuffer")(
  function* runGitBuffer({ repositoryRoot, args: handedArgs }: GitCommand) {
    const { variables: environment } = yield* GitEnvironment;
    const executable = gitExecutablePath(environment.PATH);
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const handle = yield* spawner.spawn(
      ChildProcess.make(executable, [...handedArgs], {
        cwd: repositoryRoot,
        env: environment,
        stdin: "ignore",
      }),
    );
    const [stdout, stderr, exitCode] = yield* Effect.all(
      [Stream.mkUint8Array(handle.stdout), Stream.mkUint8Array(handle.stderr), handle.exitCode],
      { concurrency: "unbounded" },
    );
    if (exitCode !== 0) {
      return yield* failedCommand(
        `Command failed: ${[executable, ...handedArgs].join(" ")}\n${lenientText(stderr)}`,
      );
    }
    if (stderr.length > 0) {
      return yield* failedCommand(`Git command wrote to stderr: ${lenientText(stderr)}`);
    }
    return stdout;
  },
  Effect.scoped,
  Effect.catchTag("PlatformError", (failure) =>
    Effect.fail(new GitCommandFailed({ message: failure.message, cause: failure })),
  ),
);

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
