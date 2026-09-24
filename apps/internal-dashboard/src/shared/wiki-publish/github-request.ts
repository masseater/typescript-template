import {
  gitHubApiOrigin,
  gitHubRequestTimeout,
  gitHubSuccessStatus,
  httpStatus,
} from "@repo/config";
import { withSpan } from "@repo/observability";
import { Effect, Redacted, Schema } from "effect";
import { FetchHttpClient, HttpBody, HttpClient, HttpClientResponse } from "effect/unstable/http";

import { WikiPublishFailed } from "./wiki-publish-failed.ts";
import { WikiPublishUnreachable } from "./wiki-publish-unreachable.ts";

const GitHubError = Schema.Struct({
  documentation_url: Schema.optionalKey(Schema.String),
  message: Schema.String,
});

type GitHubCall = Readonly<{
  body?: unknown;
  method: "GET" | "PATCH" | "POST";
  path: string;
  step: string;
  token: Redacted.Redacted;
}>;

const send = (call: GitHubCall) => {
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${Redacted.value(call.token)}`,
    "User-Agent": "wiki-publisher",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const url = `${gitHubApiOrigin}${call.path}`;
  return call.method === "GET"
    ? HttpClient.get(url, { headers })
    : Effect.flatMap(HttpBody.json(call.body ?? {}), (body) =>
        (call.method === "PATCH" ? HttpClient.patch : HttpClient.post)(url, { body, headers }),
      );
};

const gitHubRequest = <Decoded extends Schema.Top & { readonly DecodingServices: never }>(
  schema: Decoded,
  call: GitHubCall,
): Effect.Effect<Decoded["Type"], WikiPublishFailed | WikiPublishUnreachable> =>
  Effect.gen(function* callGitHub() {
    const response = yield* send(call).pipe(
      Effect.timeout(gitHubRequestTimeout),
      Effect.provide(FetchHttpClient.layer),
      Effect.provideService(FetchHttpClient.Fetch, globalThis.fetch),
      Effect.mapError((cause) => new WikiPublishUnreachable({ cause, step: call.step })),
    );
    if (response.status >= httpStatus.internalServerError) {
      return yield* new WikiPublishUnreachable({
        cause: new Error(`GitHub answered ${String(response.status)}`),
        step: call.step,
      });
    }
    const refused = (message: string): WikiPublishFailed =>
      new WikiPublishFailed({ message, status: response.status, step: call.step });
    if (response.status < gitHubSuccessStatus.first || response.status > gitHubSuccessStatus.last) {
      const answer = yield* HttpClientResponse.schemaBodyJson(GitHubError)(response).pipe(
        Effect.orElseSucceed((): typeof GitHubError.Type => ({
          message: "GitHub gave no message",
        })),
      );
      const message =
        answer.documentation_url === undefined
          ? answer.message
          : `${answer.message} (${answer.documentation_url})`;
      return yield* refused(message);
    }
    return yield* HttpClientResponse.schemaBodyJson(schema)(response).pipe(
      Effect.mapError((issue) => refused(issue.message)),
    );
  }).pipe(withSpan("wiki.publish.github", { attributes: { step: call.step } }));

export { gitHubRequest };
