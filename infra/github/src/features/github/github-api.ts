import {
  gitHubApiOrigin,
  gitHubRequestTimeout,
  gitHubSuccessStatus,
  httpStatus,
} from "@repo/config";
import { Effect, Redacted, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientResponse } from "effect/unstable/http";

class GitHubAppFailure extends Schema.TaggedError<GitHubAppFailure>()("GitHubAppFailure", {
  cause: Schema.optionalKey(Schema.Defect()),
  code: Schema.Literals([
    "admin_permission_missing",
    "github_refused",
    "github_unreachable",
    "installation_timeout",
    "manifest_timeout",
    "private_key_invalid",
  ]),
  status: Schema.optionalKey(Schema.Finite),
  step: Schema.String,
}) {}

type GitHubCall = Readonly<{
  method: "DELETE" | "GET" | "POST";
  path: string;
  step: string;
  token?: Redacted.Redacted;
}>;

const methods = { DELETE: HttpClient.del, GET: HttpClient.get, POST: HttpClient.post };

const gitHubResponse = (
  call: GitHubCall,
): Effect.Effect<HttpClientResponse.HttpClientResponse, GitHubAppFailure> =>
  methods[call.method](`${gitHubApiOrigin}${call.path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "repo-github",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(call.token === undefined
        ? {}
        : { Authorization: `Bearer ${Redacted.value(call.token)}` }),
    },
  }).pipe(
    Effect.timeout(gitHubRequestTimeout),
    Effect.provide(FetchHttpClient.layer),
    Effect.provideService(FetchHttpClient.Fetch, globalThis.fetch),
    Effect.mapError(
      (cause) => new GitHubAppFailure({ cause, code: "github_unreachable", step: call.step }),
    ),
  );

const succeeded = (answeredStatus: number): boolean =>
  answeredStatus >= gitHubSuccessStatus.first && answeredStatus <= gitHubSuccessStatus.last;

const refused = (
  call: GitHubCall,
  refusal: Readonly<{ cause?: unknown; status: number }>,
): GitHubAppFailure =>
  new GitHubAppFailure({
    cause: refusal.cause,
    code: "github_refused",
    status: refusal.status,
    step: call.step,
  });

const gitHubRequest = <Decoded extends Schema.Top & { readonly DecodingServices: never }>(
  schema: Decoded,
  call: GitHubCall,
): Effect.Effect<Decoded["Type"], GitHubAppFailure> =>
  Effect.gen(function* callGitHub() {
    const gitHubAnswer = yield* gitHubResponse(call);
    if (!succeeded(gitHubAnswer.status)) {
      return yield* refused(call, gitHubAnswer);
    }
    return yield* HttpClientResponse.schemaBodyJson(schema)(gitHubAnswer).pipe(
      Effect.mapError((cause) => refused(call, { cause, status: gitHubAnswer.status })),
    );
  });

const gitHubLookup = <Decoded extends Schema.Top & { readonly DecodingServices: never }>(
  schema: Decoded,
  call: GitHubCall,
): Effect.Effect<Decoded["Type"] | undefined, GitHubAppFailure> =>
  gitHubRequest(schema, call).pipe(
    Effect.catchIf(
      (failure) => failure.status === httpStatus.notFound,
      () => Effect.void,
    ),
  );

const gitHubDelete = (call: GitHubCall): Effect.Effect<void, GitHubAppFailure> =>
  Effect.gen(function* deleteOnGitHub() {
    const gitHubAnswer = yield* gitHubResponse(call);
    if (gitHubAnswer.status !== httpStatus.notFound && !succeeded(gitHubAnswer.status)) {
      return yield* refused(call, gitHubAnswer);
    }
  });

export { GitHubAppFailure, gitHubDelete, gitHubLookup, gitHubRequest };
export type { GitHubCall };
