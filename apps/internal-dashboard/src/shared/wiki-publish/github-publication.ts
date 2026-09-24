import { httpStatus } from "@repo/config";
import { Effect, Encoding, Schema } from "effect";

import { imageDirectory } from "#shared/wiki-document/wiki-image-paths.ts";
import { installationToken } from "./github-app-token.ts";
import { gitHubRequest } from "./github-request.ts";
import { WikiPublishStale } from "./wiki-publish-stale.ts";

import type { WikiPublishConfig } from "@repo/config";

const mergeQueueLabel = "ready-to-merge";
const wikiDocsDirectory = "apps/internal-dashboard/content/docs";
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
  const call = <Decoded extends Schema.Top & { readonly DecodingServices: never }>(
    schema: Decoded,
    step: string,
    path: string,
    body?: unknown,
  ) =>
    gitHubRequest(schema, {
      body,
      method: body === undefined ? "GET" : "POST",
      path: `${repository}${path}`,
      step,
      token,
    });
  const { default_branch: base } = yield* call(Repository, "repository", "");
  const head = yield* call(Reference, "base-ref", `/git/ref/heads/${base}`);
  const baseCommit = yield* call(Commit, "base-commit", `/git/commits/${head.object.sha}`);
  const documentPath = `${wikiDocsDirectory}/${publication.pagePath}`;
  const current = yield* call(
    Created,
    "base-content",
    `/contents/${documentPath}?ref=${head.object.sha}`,
  ).pipe(
    Effect.catchTag("WikiPublishFailed", (failure) =>
      failure.status === httpStatus.notFound ? Effect.succeed(undefined) : Effect.fail(failure),
    ),
  );
  if ((current?.sha ?? null) !== publication.baseRevision) {
    return yield* new WikiPublishStale();
  }
  const images = yield* Effect.forEach(
    publication.images,
    (image) =>
      call(Created, "image-blob", "/git/blobs", {
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
  const tree = yield* call(Created, "tree", "/git/trees", {
    base_tree: baseCommit.tree.sha,
    tree: [
      { content: publication.markdown, mode: fileMode, path: documentPath, type: "blob" },
      ...images,
    ],
  });
  const title = `docs: 「${publication.title}」を更新`;
  const commit = yield* call(Created, "commit", "/git/commits", {
    message: title,
    parents: [head.object.sha],
    tree: tree.sha,
  });
  const branch = branchName(publication.pagePath, commit.sha);
  yield* call(Reference, "branch", "/git/refs", { ref: `refs/heads/${branch}`, sha: commit.sha });
  const pullRequest = yield* call(PullRequest, "pull-request", "/pulls", {
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

export {
  enqueuePullRequest,
  mergeQueueLabel,
  publishToGitHub,
  wikiDocsDirectory,
  withdrawPullRequest,
};
export type { WikiPublication };
