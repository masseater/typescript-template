import { layer } from "@effect/vitest";
import { Effect, Layer, Redacted } from "effect";
import { http, type HttpHandler } from "msw";
import { setupServer } from "msw/node";
import { describe, expect } from "vite-plus/test";

import { githubRequestFor } from "./github-request.ts";

const githubApi = setupServer();

const listeningGitHubApi = Layer.effectDiscard(
  Effect.acquireRelease(
    Effect.sync(() => {
      githubApi.listen({ onUnhandledRequest: "error" });
    }),
    () =>
      Effect.sync(() => {
        githubApi.close();
      }),
  ),
);

const answeringWith = (handler: HttpHandler) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      githubApi.use(handler);
    }),
    () =>
      Effect.sync(() => {
        githubApi.resetHandlers();
      }),
  );

const requestedWithAToken = (requestPath: string) =>
  Effect.flatMap(Effect.fromNullishOr(githubRequestFor(Redacted.make("token"))), (request) =>
    request(requestPath),
  );

const isGitHubApi = ({ request }: { readonly request: Request }): boolean =>
  new URL(request.url).origin === "https://api.github.com";

layer(listeningGitHubApi)("githubRequestFor", (it) => {
  describe("a token that was never given", () => {
    it.effect("has no request to make without a token", () =>
      Effect.sync(() => {
        expect(githubRequestFor(undefined)).toBe(null);
      }),
    );
  });

  describe("a token that was given as an empty string", () => {
    it.effect("has no request to make for an empty token", () =>
      Effect.sync(() => {
        expect(githubRequestFor(Redacted.make(""))).toBe(null);
      }),
    );
  });

  describe("a compare the API answered", () => {
    const answeredCompare = Effect.gen(function* answeredCompare() {
      yield* answeringWith(
        http.get(isGitHubApi, ({ request }) =>
          Response.json({
            merge_base_commit: { sha: "basesha" },
            received: [
              request.url,
              request.headers.get("authorization"),
              request.headers.get("accept"),
              request.headers.get("x-github-api-version"),
            ],
          }),
        ),
      );
      return yield* requestedWithAToken("/repos/owner/name/compare/a...b");
    });

    it.effect("answers under the token headers the handler received", () =>
      Effect.gen(function* program() {
        expect(yield* answeredCompare).toStrictEqual({
          merge_base_commit: { sha: "basesha" },
          received: [
            "https://api.github.com/repos/owner/name/compare/a...b",
            "Bearer token",
            "application/vnd.github+json",
            "2022-11-28",
          ],
        });
      }),
    );
  });

  describe("a failing answer from the API", () => {
    const failureFromReadingAFailingAnswer = Effect.gen(
      function* failureFromReadingAFailingAnswer() {
        yield* answeringWith(http.get(isGitHubApi, () => new Response("no", { status: 404 })));
        const failure = yield* Effect.flip(
          requestedWithAToken("/repos/owner/name/contents/absent.ts"),
        );
        return failure.message;
      },
    );

    it.effect("refuses to read past a failing answer", () =>
      Effect.gen(function* program() {
        expect(yield* failureFromReadingAFailingAnswer).toBe(
          "Do not read past a GitHub API failure: 404 on /repos/owner/name/contents/absent.ts.",
        );
      }),
    );
  });
});
