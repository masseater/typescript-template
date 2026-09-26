import { httpStatus } from "@repo/config";
import { Effect, Encoding, Schema } from "effect";

import { imageDirectory } from "#shared/wiki-document/wiki-image-paths.ts";
import { installationToken } from "./github-app-token.ts";
import { gitHubRequest } from "./github-request.ts";
import { WikiPublishStale } from "./wiki-publish-stale.ts";
import { mergeQueueLabel, wikiDocsDirectory } from "./wiki-repository.ts";

import type { WikiPublishConfig } from "@repo/config";

const fileMode = "100644";
const shortShaLength = 7;
const blobUploads = 4;

const Repository = Schema.Struct({ default_branch: Schema.String });
const Reference = Schema.Struct({ object: Schema.Struct({ sha: Schema.String }) });
const Commit = Schema.Struct({ sha: Schema.String, tree: Schema.Struct({ sha: Schema.String }) });
const Created = Schema.Struct({ sha: Schema.String });
const PullRequest = Schema.Struct({ html_url: Schema.String, number: Schema.Finite });

type WikiPublication = Readonly<{
  baseRevision: string | null;
  images: readonly Readonly<{ bytes: Uint8Array; name: string }>[];
  markdown: string;
  pagePath: string;
  title: string;
}>;

const branchName = (pagePath: string, commitSha: string): string =>
  `wiki/${pagePath.replace(/\.md$/u, "").replaceAll("/", "-")}-${commitSha.slice(0, shortShaLength)}`;

const repositoryPath = (config: WikiPublishConfig): string =>
  `/repos/${config.owner}/${config.repository}`;

const publishToGitHub = Effect.fn("publishWikiToGitHub")(function* publishToGitHub(
  config: WikiPublishConfig,
  publication: WikiPublication,
) {
  const token = yield* installationToken(config);
  const repository = repositoryPath(config);
  const read = <Decoded extends Schema.Top & { readonly DecodingServices: never }>(
    schema: Decoded,
    step: string,
    path: string,
  ) => gitHubRequest(schema, { method: "GET", path: `${repository}${path}`, step, token });
  const create = <Decoded extends Schema.Top & { readonly DecodingServices: never }>(
    schema: Decoded,
    step: string,
    path: string,
    body: Readonly<Record<string, unknown>>,
  ) => gitHubRequest(schema, { body, method: "POST", path: `${repository}${path}`, step, token });
  const { default_branch: base } = yield* read(Repository, "repository", "");
  const head = yield* read(Reference, "base-ref", `/git/ref/heads/${base}`);
  const baseCommit = yield* read(Commit, "base-commit", `/git/commits/${head.object.sha}`);
  const documentPath = `${wikiDocsDirectory}/${publication.pagePath}`;
  const current = yield* read(
    Created,
    "base-content",
    `/contents/${documentPath}?ref=${head.object.sha}`,
  ).pipe(
    Effect.catchTag("WikiPublishFailed", (failure) =>
      failure.status === httpStatus.notFound ? Effect.void : Effect.fail(failure),
    ),
  );
  if ((current?.sha ?? null) !== publication.baseRevision) {
    return yield* new WikiPublishStale();
  }
  const images = yield* Effect.forEach(
    publication.images,
    (image) =>
      create(Created, "image-blob", "/git/blobs", {
        content: Encoding.encodeBase64(image.bytes),
        encoding: "base64",
      }).pipe(
        Effect.map((blob) => ({
          mode: fileMode,
          path: `${wikiDocsDirectory}/${imageDirectory}/${image.name}`,
          sha: blob.sha,
          type: "blob",
        })),
      ),
    { concurrency: blobUploads },
  );
  const tree = yield* create(Created, "tree", "/git/trees", {
    base_tree: baseCommit.tree.sha,
    tree: [
      { content: publication.markdown, mode: fileMode, path: documentPath, type: "blob" },
      ...images,
    ],
  });
  const title = `docs: 「${publication.title}」を更新`;
  const commit = yield* create(Created, "commit", "/git/commits", {
    message: title,
    parents: [head.object.sha],
    tree: tree.sha,
  });
  const branch = branchName(publication.pagePath, commit.sha);
  yield* create(Reference, "branch", "/git/refs", { ref: `refs/heads/${branch}`, sha: commit.sha });
  const pullRequest = yield* create(PullRequest, "pull-request", "/pulls", {
    base,
    body: `wiki の編集画面から公開した変更です。\n\n文書: \`${documentPath}\``,
    head: branch,
    title,
  });
  return { number: pullRequest.number, url: pullRequest.html_url };
});

const enqueuePullRequest = Effect.fn("enqueueWikiPullRequest")(function* enqueuePullRequest(
  config: WikiPublishConfig,
  pullRequest: number,
) {
  const token = yield* installationToken(config);
  yield* gitHubRequest(Schema.Unknown, {
    body: { labels: [mergeQueueLabel] },
    method: "POST",
    path: `${repositoryPath(config)}/issues/${String(pullRequest)}/labels`,
    step: "label",
    token,
  });
});

const withdrawPullRequest = Effect.fn("withdrawWikiPullRequest")(function* withdrawPullRequest(
  config: WikiPublishConfig,
  pullRequest: number,
) {
  const token = yield* installationToken(config);
  yield* gitHubRequest(Schema.Unknown, {
    body: { state: "closed" },
    method: "PATCH",
    path: `${repositoryPath(config)}/pulls/${String(pullRequest)}`,
    step: "withdraw",
    token,
  });
});

export { enqueuePullRequest, publishToGitHub, withdrawPullRequest };
export type { WikiPublication };
