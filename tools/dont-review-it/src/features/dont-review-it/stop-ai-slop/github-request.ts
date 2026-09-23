import { Effect, Redacted } from "effect";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";

import { GitHubRequestFailed, type GitHubRequest } from "./github-comparison.ts";

const API_ORIGIN = "https://api.github.com";

const answeredBody = Effect.fn("answeredBody")(
  function* answeredBody(token: Redacted.Redacted, requestPath: string) {
    const answered = yield* HttpClient.get(`${API_ORIGIN}${requestPath}`, {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${Redacted.value(token)}`,
        "x-github-api-version": "2022-11-28",
      },
    });
    if (answered.status < 200 || answered.status >= 300) {
      return yield* new GitHubRequestFailed({
        message: `Do not read past a GitHub API failure: ${answered.status} on ${requestPath}.`,
      });
    }
    return yield* answered.json;
  },
  Effect.catchTag("HttpClientError", (failure) =>
    Effect.fail(
      new GitHubRequestFailed({
        message: `Do not read past an unanswered GitHub API request: ${failure.message}`,
        cause: failure,
      }),
    ),
  ),
  Effect.provide(FetchHttpClient.layer),
);

export const githubRequestFor = (token: Redacted.Redacted | undefined): GitHubRequest | null =>
  token === undefined || Redacted.value(token) === ""
    ? null
    : (requestPath: string) => answeredBody(token, requestPath);
