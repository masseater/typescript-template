import { Effect, Schema } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

type RepositoryAddress = Readonly<{ owner: string; repository: string }>;

const repositorySlug = (address: RepositoryAddress): string =>
  `${address.owner}/${address.repository}`;

const repositoryStage = (address: RepositoryAddress): string =>
  `${address.owner}-${address.repository}`.toLowerCase();

const RepositoryView = Schema.fromJsonString(
  Schema.Struct({ name: Schema.String, owner: Schema.Struct({ login: Schema.String }) }),
);

class RepositoryFailure extends Schema.TaggedError<RepositoryFailure>()("RepositoryFailure", {
  code: Schema.Literals(["repository_view_unavailable", "repository_view_invalid"]),
}) {}

const originRepository = Effect.fn("originRepository")(function* originRepository(
  workingDirectory: string,
) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const viewed = yield* spawner
    .string(
      ChildProcess.make("gh", ["repo", "view", "--json", "owner,name"], { cwd: workingDirectory }),
    )
    .pipe(Effect.mapError(() => new RepositoryFailure({ code: "repository_view_unavailable" })));
  const view = yield* Schema.decodeEffect(RepositoryView)(viewed).pipe(
    Effect.mapError(() => new RepositoryFailure({ code: "repository_view_invalid" })),
  );
  return { owner: view.owner.login, repository: view.name } as const satisfies RepositoryAddress;
});

export { originRepository, repositorySlug, repositoryStage };
export type { RepositoryAddress };
