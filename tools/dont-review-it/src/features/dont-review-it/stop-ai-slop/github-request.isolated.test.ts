import { layer } from "@effect/vitest";
import { Effect, Layer, Redacted, Schema } from "effect";
import { FetchHttpClient, HttpClientError } from "effect/unstable/http";
import { http, HttpResponse, type HttpHandler } from "msw";
import { setupServer } from "msw/node";
import { describe, expect, vi } from "vite-plus/test";

import { GitHubAnswerUnexpected, gitHubApiFor, GitHubRequestFailed } from "./github-request.ts";

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

const isGitHubApi = ({ request }: { readonly request: Request }): boolean =>
  new URL(request.url).origin === "https://api.github.com";

const api = gitHubApiFor(Redacted.make("token"));

const comparedWith = (answer: () => Response) =>
  Effect.gen(function* comparedWith() {
    yield* answeringWith(http.get(isGitHubApi, answer));
    return yield* (yield* api).compare("owner/name", { base: "a", head: "b" });
  });

const contentsWith = (answer: () => Response) =>
  Effect.gen(function* contentsWith() {
    yield* answeringWith(http.get(isGitHubApi, answer));
    return yield* (yield* api).contents("owner/name", {
      sourcePath: "src/with space.ts",
      revision: "headsha",
    });
  });

const unexpectedCompare = (message: string) =>
  new GitHubAnswerUnexpected({
    message: `Do not read a GitHub API answer of an unexpected shape on /repos/owner/name/compare/a...b: ${message}`,
    cause: expect.any(Schema.SchemaError),
  });

const unexpectedContents = (message: string) =>
  new GitHubAnswerUnexpected({
    message: `Do not read a GitHub API answer of an unexpected shape on /repos/owner/name/contents/src/with%20space.ts?ref=headsha: ${message}`,
    cause: expect.any(Schema.SchemaError),
  });

layer(Layer.merge(listeningGitHubApi, FetchHttpClient.layer))("gitHubApiFor", (it) => {
  describe("a compare the API answered", () => {
    const answeredCompare = Effect.gen(function* answeredCompare() {
      const received = vi.fn<(url: string, headers: Readonly<Record<string, string>>) => void>();
      yield* answeringWith(
        http.get(isGitHubApi, ({ request }) => {
          received(request.url, {
            accept: request.headers.get("accept") ?? "",
            authorization: request.headers.get("authorization") ?? "",
            "x-github-api-version": request.headers.get("x-github-api-version") ?? "",
          });
          return HttpResponse.json({
            merge_base_commit: { sha: "basesha", url: "ignored" },
            files: [
              {
                filename: "src/moved.ts",
                status: "renamed",
                previous_filename: "src/was.ts",
                changes: 0,
              },
            ],
          });
        }),
      );
      return {
        compared: yield* (yield* api).compare("owner/name", { base: "a", head: "b" }),
        received,
      };
    });

    it.effect("answers the decoded compare", () =>
      Effect.gen(function* program() {
        expect((yield* answeredCompare).compared).toStrictEqual({
          merge_base_commit: { sha: "basesha" },
          files: [
            {
              filename: "src/moved.ts",
              status: "renamed",
              previous_filename: "src/was.ts",
              changes: 0,
            },
          ],
        });
      }),
    );

    it.effect("asks the compare endpoint once under the token headers", () =>
      Effect.gen(function* program() {
        expect((yield* answeredCompare).received).toHaveBeenCalledExactlyOnceWith(
          "https://api.github.com/repos/owner/name/compare/a...b",
          {
            accept: "application/vnd.github+json",
            authorization: "Bearer token",
            "x-github-api-version": "2022-11-28",
          },
        );
      }),
    );
  });

  describe("a file the contents API answered", () => {
    it.effect("answers the bytes the base64 content carries", () =>
      Effect.gen(function* program() {
        expect(
          yield* contentsWith(() =>
            HttpResponse.json({ encoding: "base64", content: "ZXhwb3J0\nIGNvbnN0\n" }),
          ),
        ).toStrictEqual(new TextEncoder().encode("export const"));
      }),
    );
  });

  describe("a failing answer from the API", () => {
    it.effect("refuses to read past a failing answer", () =>
      Effect.gen(function* program() {
        expect(
          yield* Effect.flip(contentsWith(() => new HttpResponse("no", { status: 404 }))),
        ).toStrictEqual(
          new GitHubRequestFailed({
            message:
              "Do not read past a GitHub API failure: 404 on /repos/owner/name/contents/src/with%20space.ts?ref=headsha.",
            cause: expect.any(HttpClientError.HttpClientError),
          }),
        );
      }),
    );
  });

  describe("a request the API never answered", () => {
    it.effect("refuses to read past an unanswered request", () =>
      Effect.gen(function* program() {
        expect(yield* Effect.flip(comparedWith(() => HttpResponse.error()))).toStrictEqual(
          new GitHubRequestFailed({
            message:
              "Do not read past an unanswered GitHub API request: Transport error (GET https://api.github.com/repos/owner/name/compare/a...b)",
            cause: expect.any(HttpClientError.HttpClientError),
          }),
        );
      }),
    );
  });

  describe("an answer that is not JSON", () => {
    it.effect("refuses the answer without calling it unanswered", () =>
      Effect.gen(function* program() {
        expect(
          yield* Effect.flip(comparedWith(() => new HttpResponse("<html>", { status: 200 }))),
        ).toStrictEqual(
          new GitHubAnswerUnexpected({
            message:
              "Do not read a GitHub API answer that is not JSON: /repos/owner/name/compare/a...b.",
            cause: expect.any(HttpClientError.HttpClientError),
          }),
        );
      }),
    );
  });

  describe("a compare status that maps to no change", () => {
    it.effect("refuses a compare status it cannot map to a change", () =>
      Effect.gen(function* program() {
        expect(
          yield* Effect.flip(
            comparedWith(() =>
              HttpResponse.json({
                merge_base_commit: { sha: "basesha" },
                files: [{ filename: "src/legacy.ts", status: "unchanged", changes: 0 }],
              }),
            ),
          ),
        ).toStrictEqual(
          unexpectedCompare(
            'Expected "added" | "changed" | "copied" | "modified" | "removed"\n  at ["files"][0]["status"]',
          ),
        );
      }),
    );
  });

  describe("a renamed file the compare answered without its former path", () => {
    it.effect("refuses a rename whose former path is empty", () =>
      Effect.gen(function* program() {
        expect(
          yield* Effect.flip(
            comparedWith(() =>
              HttpResponse.json({
                merge_base_commit: { sha: "basesha" },
                files: [
                  {
                    filename: "docs/moved.md",
                    status: "renamed",
                    previous_filename: "",
                    changes: 0,
                  },
                ],
              }),
            ),
          ),
        ).toStrictEqual(
          unexpectedCompare(
            'Expected a value with a length of at least 1\n  at ["files"][0]["previous_filename"]\nExpected "added" | "changed" | "copied" | "modified" | "removed"\n  at ["files"][0]["status"]',
          ),
        );
      }),
    );
  });

  describe("a compare the API answered as something other than an object", () => {
    it.effect("refuses a compare that is not an object", () =>
      Effect.gen(function* program() {
        expect(
          yield* Effect.flip(comparedWith(() => HttpResponse.json("no compare here"))),
        ).toStrictEqual(unexpectedCompare("Expected object"));
      }),
    );
  });

  describe("a compare that answered its changed files as something other than a list", () => {
    it.effect("refuses changed files that are not a list", () =>
      Effect.gen(function* program() {
        expect(
          yield* Effect.flip(
            comparedWith(() =>
              HttpResponse.json({
                merge_base_commit: { sha: "basesha" },
                files: { "src/legacy.ts": "modified" },
              }),
            ),
          ),
        ).toStrictEqual(unexpectedCompare('Expected array | undefined\n  at ["files"]'));
      }),
    );
  });

  describe("a file the contents API answered without content", () => {
    it.effect("refuses contents that carry no encoded content", () =>
      Effect.gen(function* program() {
        expect(yield* Effect.flip(contentsWith(() => HttpResponse.json({})))).toStrictEqual(
          unexpectedContents('Missing key\n  at ["encoding"]'),
        );
      }),
    );
  });

  describe("a file too large for the contents API to encode", () => {
    it.effect("refuses contents answered without base64 content", () =>
      Effect.gen(function* program() {
        expect(
          yield* Effect.flip(
            contentsWith(() => HttpResponse.json({ encoding: "none", content: "" })),
          ),
        ).toStrictEqual(unexpectedContents('Expected "base64"\n  at ["encoding"]'));
      }),
    );
  });
});
