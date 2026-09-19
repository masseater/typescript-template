import { attemptAsync } from "es-toolkit";
import { http } from "msw";
import { setupServer } from "msw/node";
import { describe, expect, test } from "vite-plus/test";

import { githubRequestFor } from "./github-request.ts";

describe("githubRequestFor", () => {
  describe("a token that was never given", () => {
    const it = test.extend("requestForAnAbsentToken", () => githubRequestFor(undefined));

    it("has no request to make without a token", ({ requestForAnAbsentToken }) => {
      expect(requestForAnAbsentToken).toBe(null);
    });
  });

  describe("a token that was given as an empty string", () => {
    const it = test.extend("requestForAnEmptyToken", () => githubRequestFor(""));

    it("has no request to make for an empty token", ({ requestForAnEmptyToken }) => {
      expect(requestForAnEmptyToken).toBe(null);
    });
  });

  describe("a compare the API answered", () => {
    const it = test.extend("answeredCompare", async ({}, { onCleanup }) => {
      const seen = Promise.withResolvers<Request>();
      const server = setupServer(
        http.get(
          ({ request }) => new URL(request.url).origin === "https://api.github.com",
          ({ request }) => {
            seen.resolve(request);
            return Response.json({ merge_base_commit: { sha: "basesha" } });
          },
        ),
      );
      server.listen({ onUnhandledRequest: "error" });
      onCleanup(() => {
        server.close();
      });
      const decoded = await githubRequestFor("token")?.("/repos/owner/name/compare/a...b");
      const interceptedRequest = await seen.promise;
      return Promise.all([
        Promise.resolve(decoded),
        Promise.all([
          Promise.resolve(interceptedRequest.url),
          Promise.resolve(interceptedRequest.headers.get("authorization")),
          Promise.resolve(interceptedRequest.headers.get("accept")),
          Promise.resolve(interceptedRequest.headers.get("x-github-api-version")),
        ]),
      ]);
    });

    it("answers under the token headers the handler received", ({ answeredCompare }) => {
      expect(answeredCompare).toStrictEqual([
        { merge_base_commit: { sha: "basesha" } },
        [
          "https://api.github.com/repos/owner/name/compare/a...b",
          "Bearer token",
          "application/vnd.github+json",
          "2022-11-28",
        ],
      ]);
    });
  });

  describe("a failing answer from the API", () => {
    const it = test.extend("failureFromReadingAFailingAnswer", async ({}, { onCleanup }) => {
      const server = setupServer(
        http.get(
          ({ request }) => new URL(request.url).origin === "https://api.github.com",
          () => new Response("no", { status: 404 }),
        ),
      );
      server.listen({ onUnhandledRequest: "error" });
      onCleanup(() => {
        server.close();
      });
      const [failure] = await attemptAsync<unknown, Error>(async () =>
        githubRequestFor("token")?.("/repos/owner/name/contents/absent.ts"),
      );
      return failure === null ? null : failure.message;
    });

    it("refuses to read past a failing answer", ({ failureFromReadingAFailingAnswer }) => {
      expect(failureFromReadingAFailingAnswer).toBe(
        "Do not read past a GitHub API failure: 404 on /repos/owner/name/contents/absent.ts.",
      );
    });
  });
});
