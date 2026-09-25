import { Config, Effect, Schema } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

const repositoryKey = "GITHUB_REPOSITORY";

const RepositorySlug = Schema.String.check(
  Schema.isPattern(/^[\w.-]+\/[\w.-]+$/u, { message: `${repositoryKey} must be owner/repository` }),
);

type RepositoryAddress = Readonly<{ owner: string; repository: string }>;

const repositorySlug = (address: RepositoryAddress): string =>
  `${address.owner}/${address.repository}`;

const addressOf = (slug: string): RepositoryAddress => {
  const [owner = "", repository = ""] = slug.split("/");
  return { owner, repository };
};

const targetRepository: Config.Config<RepositoryAddress> = Config.schema(
  RepositorySlug,
  repositoryKey,
).pipe(Config.map(addressOf));

const RepositoryView = Schema.fromJsonString(
  Schema.Struct({ name: Schema.String, owner: Schema.Struct({ login: Schema.String }) }),
);

class RepositoryFailure extends Schema.TaggedError<RepositoryFailure>()("RepositoryFailure", {
  code: Schema.Literals([
    "repository_view_unavailable",
    "repository_view_invalid",
    "repository_mismatch",
  ]),
  keys: Schema.Array(Schema.String),
}) {}

const viewedRepository = Effect.fn("viewedRepository")(function* viewedRepository(
  workingDirectory: string,
) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const viewed = yield* spawner
    .string(
      ChildProcess.make("gh", ["repo", "view", "--json", "owner,name"], { cwd: workingDirectory }),
    )
    .pipe(
      Effect.mapError(
        () => new RepositoryFailure({ code: "repository_view_unavailable", keys: [] }),
      ),
    );
  const view = yield* Schema.decodeEffect(RepositoryView)(viewed).pipe(
    Effect.mapError(() => new RepositoryFailure({ code: "repository_view_invalid", keys: [] })),
  );
  return { owner: view.owner.login, repository: view.name } as const satisfies RepositoryAddress;
});

const matchingRepository = (
  declared: RepositoryAddress,
  viewed: RepositoryAddress,
): Effect.Effect<RepositoryAddress, RepositoryFailure> =>
  repositorySlug(declared).toLowerCase() === repositorySlug(viewed).toLowerCase()
    ? Effect.succeed(declared)
    : Effect.fail(
        new RepositoryFailure({
          code: "repository_mismatch",
          keys: [repositoryKey, repositorySlug(declared), repositorySlug(viewed)],
        }),
      );

export { matchingRepository, repositorySlug, targetRepository, viewedRepository };
export type { RepositoryAddress };
