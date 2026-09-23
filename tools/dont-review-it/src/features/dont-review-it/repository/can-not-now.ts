#!/usr/bin/env node
import { NodeServices } from "@effect/platform-node";
import { causeRecord, runCli } from "@repo/cli";
import { Config, Effect, FileSystem, Redacted, Schema } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientResponse,
  type HttpClientError,
} from "effect/unstable/http";

import { pendingIssues, trustedComments } from "./can-not-now-scope.ts";

const API_ORIGIN = "https://api.github.com";
const PAGE_SIZE = 100;

const Issue = Schema.Struct({
  author_association: Schema.String,
  body: Schema.NullOr(Schema.String),
  number: Schema.Int,
  pull_request: Schema.optionalKey(Schema.Unknown),
  title: Schema.String,
});

const Comment = Schema.Struct({
  author_association: Schema.String,
  body: Schema.NullOr(Schema.String),
  user: Schema.NullOr(Schema.Struct({ login: Schema.String })),
});

const Pull = Schema.Struct({
  head: Schema.Struct({
    ref: Schema.String,
    repo: Schema.NullOr(Schema.Struct({ full_name: Schema.String })),
  }),
});

class GitHubApiFailure extends Schema.TaggedError<GitHubApiFailure>()("GitHubApiFailure", {
  status: Schema.Int,
  url: Schema.String,
}) {
  public override get message(): string {
    return `Do not read past a GitHub API failure: ${this.status} on ${this.url}.`;
  }
}

type GitHubRead<Read> = Effect.Effect<
  Read,
  HttpClientError.HttpClientError | GitHubApiFailure | Schema.SchemaError
>;

const readGitHub = Effect.gen(function* readGitHub() {
  const token = yield* Config.Redacted("GH_TOKEN");
  const repository = yield* Config.String("GITHUB_REPOSITORY");
  const client = yield* HttpClient.HttpClient;

  const pageOf = <Item, Encoded>(
    item: Schema.Codec<Item, Encoded>,
    route: string,
    page: number,
  ): GitHubRead<readonly Item[]> =>
    Effect.gen(function* readPage() {
      const separator = route.includes("?") ? "&" : "?";
      const url = `${API_ORIGIN}/repos/${repository}${route}${separator}per_page=${PAGE_SIZE}&page=${page}`;
      const answered = yield* client.get(url, {
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${Redacted.value(token)}`,
          "x-github-api-version": "2022-11-28",
        },
      });
      if (answered.status < 200 || answered.status >= 300) {
        return yield* new GitHubApiFailure({ status: answered.status, url });
      }
      return yield* HttpClientResponse.schemaBodyJson(Schema.Array(item))(answered);
    });

  const everyPage = <Item, Encoded>(
    item: Schema.Codec<Item, Encoded>,
    route: string,
    page = 1,
  ): GitHubRead<readonly Item[]> =>
    Effect.filterOrElse(
      pageOf(item, route, page),
      (items) => items.length < PAGE_SIZE,
      (items) => Effect.map(everyPage(item, route, page + 1), (rest) => [...items, ...rest]),
    );

  const [issues, openPulls] = yield* Effect.all(
    [
      everyPage(Issue, "/issues?labels=can-not-now&state=open"),
      everyPage(Pull, "/pulls?state=open"),
    ],
    { concurrency: "unbounded" },
  );

  return yield* Effect.forEach(
    pendingIssues({ issues, openPulls, repository }),
    (issue) =>
      Effect.map(everyPage(Comment, `/issues/${issue.number}/comments`), (comments) => ({
        body: issue.body ?? "",
        comments: trustedComments(comments),
        number: issue.number,
        title: issue.title,
      })),
    { concurrency: "unbounded" },
  );
});

runCli(
  Effect.gen(function* canNotNow() {
    const tasks = yield* readGitHub;
    const githubOutput = yield* Config.String("GITHUB_OUTPUT");
    const filesystem = yield* FileSystem.FileSystem;
    const encodedTasks = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(tasks);
    yield* filesystem.writeFileString(
      githubOutput,
      `count=${tasks.length}\nissues=${encodedTasks}\n`,
      { flag: "a" },
    );
  }).pipe(Effect.provide([NodeServices.layer, FetchHttpClient.layer])),
  (cause) => causeRecord("quality.can_not_now_failed", { cause }),
);
