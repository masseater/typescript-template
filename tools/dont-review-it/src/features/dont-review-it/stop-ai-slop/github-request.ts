import { Effect, Redacted, Schema } from "effect";
import { HttpClient, HttpClientResponse, type HttpClientError } from "effect/unstable/http";

export class GitHubRequestFailed extends Schema.TaggedError<GitHubRequestFailed>()(
  "GitHubRequestFailed",
  { message: Schema.String, cause: Schema.optional(Schema.Defect()) },
) {}

export class GitHubAnswerUnexpected extends Schema.TaggedError<GitHubAnswerUnexpected>()(
  "GitHubAnswerUnexpected",
  { message: Schema.String, cause: Schema.Defect() },
) {}

const MovedFile = Schema.Struct({
  filename: Schema.String,
  status: Schema.Literal("renamed"),
  previous_filename: Schema.NonEmptyString,
  changes: Schema.Finite,
  patch: Schema.optional(Schema.String),
});

const PlacedFile = Schema.Struct({
  filename: Schema.String,
  status: Schema.Literals(["added", "changed", "copied", "modified", "removed"]),
  changes: Schema.Finite,
  patch: Schema.optional(Schema.String),
});

const CompareAnswer = Schema.Struct({
  merge_base_commit: Schema.Struct({ sha: Schema.String }),
  files: Schema.optional(Schema.Array(Schema.Union([MovedFile, PlacedFile]))),
});

const ContentsAnswer = Schema.Struct({
  encoding: Schema.Literal("base64"),
  content: Schema.String,
});

export type ComparedFile = typeof MovedFile.Type | typeof PlacedFile.Type;

export type GitHubFailure = GitHubRequestFailed | GitHubAnswerUnexpected;

export type GitHubApi = Readonly<{
  compare: (
    repository: string,
    range: Readonly<{ base: string; head: string }>,
  ) => Effect.Effect<typeof CompareAnswer.Type, GitHubFailure>;
  contents: (
    repository: string,
    source: Readonly<{ sourcePath: string; revision: string }>,
  ) => Effect.Effect<Uint8Array, GitHubFailure>;
}>;

const API_ORIGIN = "https://api.github.com";

const refusalOf = (
  requestPath: string,
  failure: HttpClientError.HttpClientError,
): GitHubFailure => {
  switch (failure.reason._tag) {
    case "StatusCodeError":
      return GitHubRequestFailed.make({
        message: `Do not read past a GitHub API failure: ${failure.reason.response.status} on ${requestPath}.`,
        cause: failure,
      });
    case "DecodeError":
    case "EmptyBodyError":
      return GitHubAnswerUnexpected.make({
        message: `Do not read a GitHub API answer that is not JSON: ${requestPath}.`,
        cause: failure,
      });
    case "TransportError":
    case "EncodeError":
    case "InvalidUrlError":
      return GitHubRequestFailed.make({
        message: `Do not read past an unanswered GitHub API request: ${failure.message}`,
        cause: failure,
      });
  }
};

const answeredBody =
  (client: HttpClient.HttpClient, token: Redacted.Redacted) =>
  <S extends Schema.Constraint>(requestPath: string, answer: S) =>
    client
      .get(`${API_ORIGIN}${requestPath}`, {
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${Redacted.value(token)}`,
          "x-github-api-version": "2022-11-28",
        },
      })
      .pipe(
        Effect.flatMap(HttpClientResponse.filterStatusOk),
        Effect.flatMap(HttpClientResponse.schemaBodyJson(answer)),
        Effect.catchTags({
          HttpClientError: (failure) => Effect.fail(refusalOf(requestPath, failure)),
          SchemaError: (mismatch) =>
            Effect.fail(
              GitHubAnswerUnexpected.make({
                message: `Do not read a GitHub API answer of an unexpected shape on ${requestPath}: ${mismatch.message}`,
                cause: mismatch,
              }),
            ),
        }),
      );

export const gitHubApiFor = (
  token: Redacted.Redacted,
): Effect.Effect<GitHubApi, never, HttpClient.HttpClient> =>
  Effect.map(HttpClient.HttpClient, (client) => {
    const answered = answeredBody(client, token);
    return {
      compare: (repository, { base, head }) =>
        answered(`/repos/${repository}/compare/${base}...${head}`, CompareAnswer),
      contents: (repository, { sourcePath, revision }) =>
        Effect.map(
          answered(
            `/repos/${repository}/contents/${encodeURI(sourcePath)}?ref=${revision}`,
            ContentsAnswer,
          ),
          ({ content }) => Uint8Array.fromBase64(content),
        ),
    };
  });
