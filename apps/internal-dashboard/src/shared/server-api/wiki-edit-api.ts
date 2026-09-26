import { verifySession } from "@repo/auth";
import { STAFF_PERMISSION, grantsStaffLevel, httpStatus } from "@repo/config";
import {
  WikiDraftConflict,
  discardWikiDraft,
  findWikiDraft,
  markWikiDraftPublished,
  saveWikiDraft,
} from "@repo/db";
import { annotateSpan } from "@repo/observability";
import { FileStore } from "@repo/runtime";
import { sessionFailures } from "@repo/runtime/account";
import { createApi, readJsonBody, readSearchParams, type ApiRoutes } from "@repo/runtime/http";
import { Effect, Encoding } from "effect";

import {
  WikiDraftDiscard,
  WikiDraftPublish,
  WikiDraftPublished,
  WikiDraftSave,
  WikiDraftSaved,
  WikiImageUpload,
  WikiImageUploaded,
  WikiSource,
  WikiSourceQuery,
} from "#shared/contracts/index.ts";
import { readWikiFrontmatter } from "#shared/wiki-document/wiki-frontmatter.ts";
import {
  editorImagePrefix,
  toEditorImages,
  toRepositoryImages,
} from "#shared/wiki-document/wiki-image-paths.ts";
import { WikiImageTooLarge } from "#shared/wiki-document/wiki-image-too-large.ts";
import { WikiPageMissing } from "#shared/wiki-document/wiki-page-missing.ts";
import {
  WikiPublishForbidden,
  WikiPublishUnchanged,
  WikiPublisher,
} from "#shared/wiki-publish/index.ts";

import type { WikiServices } from "#shared/wiki/index.ts";

const maximumDraftBytes = 262_144;
const maximumImageBytes = 5_242_880;
const base64Overhead = 4 / 3;
const jsonEnvelopeBytes = 1024;
const maximumImageBody = Math.ceil(maximumImageBytes * base64Overhead) + jsonEnvelopeBytes;
const imageExtensions = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
const imageTypes: ReadonlyMap<string, string> = new Map(
  Object.entries(imageExtensions).map(([type, extension]) => [extension, type]),
);
const imageReads = 4;
const imageNamePattern = /^(?<hash>[0-9a-f]{64})\.(?<extension>gif|jpg|png|webp)$/u;

const conflict = {
  message: "ほかの人が先に保存しました。再読み込みしてから編集してください。",
  status: httpStatus.conflict,
} as const;
const missing = { message: "ページが見つかりません。", status: httpStatus.notFound } as const;

const wikiSources = (): Effect.Effect<typeof import("#shared/wiki-document/wiki-sources.ts")> =>
  Effect.promise(() => import("#shared/wiki-document/wiki-sources.ts"));

const publishedSource = Effect.fn("publishedSource")(function* publishedSource(path: string) {
  const { gitBlobRevision, readWikiSource } = yield* wikiSources();
  const markdown = yield* readWikiSource(path);
  if (markdown === undefined) {
    return yield* WikiPageMissing.make();
  }
  return { markdown, revision: yield* gitBlobRevision(markdown) };
});

const canPublish = (user: Readonly<{ permission: string | null }>): boolean =>
  grantsStaffLevel(user.permission, STAFF_PERMISSION.editor);

const settledDraft = Effect.fn("settledWikiDraft")(function* settledDraft(
  path: string,
  revision: string,
) {
  const draft = yield* findWikiDraft(path);
  if (draft === undefined || draft.publishedRevision !== revision) {
    return draft;
  }
  const discarded = yield* discardWikiDraft(path, draft.version).pipe(
    Effect.as(true),
    Effect.catchTag("WikiDraftConflict", () => Effect.succeed(false)),
  );
  return discarded ? undefined : yield* findWikiDraft(path);
});

const openSource = Effect.fn("openSource")(function* openSource(
  path: string,
  user: Readonly<{ permission: string | null }>,
) {
  const published = yield* publishedSource(path);
  const publisher = yield* WikiPublisher;
  const publishable = publisher.publishable && canPublish(user);
  const draft = yield* settledDraft(path, published.revision);
  if (draft === undefined) {
    return {
      baseRevision: published.revision,
      draft: null,
      markdown: toEditorImages(published.markdown, path),
      path,
      publishable,
    };
  }
  return {
    baseRevision: draft.baseRevision,
    draft: { publishedUrl: draft.publishedUrl, updatedAt: draft.updatedAt, version: draft.version },
    markdown: draft.markdown,
    path,
    publishable,
  };
});

const getSource = Effect.fn("getWikiSource")(function* getSource(request: Request) {
  const { user } = yield* verifySession(request.headers);
  const { path } = yield* readSearchParams(WikiSourceQuery, request);
  return yield* openSource(path, user);
});

const putDraft = Effect.fn("saveWikiDraft")(function* putDraft(request: Request) {
  const { user } = yield* verifySession(request.headers);
  const draft = yield* readJsonBody(WikiDraftSave, request, maximumDraftBytes);
  yield* publishedSource(draft.path);
  yield* readWikiFrontmatter(draft.markdown);
  const version = yield* saveWikiDraft({ ...draft, updatedBy: user.id });
  return { version };
});

const deleteDraft = Effect.fn("discardWikiDraft")(function* deleteDraft(request: Request) {
  const { user } = yield* verifySession(request.headers);
  const { path, version } = yield* readJsonBody(WikiDraftDiscard, request);
  yield* discardWikiDraft(path, version);
  return yield* openSource(path, user);
});

const postImage = Effect.fn("uploadWikiImage")(function* postImage(request: Request) {
  yield* verifySession(request.headers);
  const { bytes, contentType } = yield* readJsonBody(WikiImageUpload, request, maximumImageBody);
  if (bytes.byteLength > maximumImageBytes) {
    return yield* WikiImageTooLarge.make();
  }
  const digest = yield* Effect.promise(() =>
    crypto.subtle.digest("SHA-256", new Uint8Array(bytes)),
  );
  const name = `${Encoding.encodeHex(new Uint8Array(digest))}.${imageExtensions[contentType]}`;
  const files = yield* FileStore;
  yield* files.put(`wiki/images/${name}`, { bytes, contentType });
  return { url: `${editorImagePrefix}${name}` };
});

const readImage = Effect.fn("readWikiImage")(function* readImage(name: string) {
  const files = yield* FileStore;
  const image = yield* files.get(`wiki/images/${name}`);
  if (image === undefined) {
    return yield* WikiPageMissing.make();
  }
  return { bytes: new Uint8Array(image.bytes), name };
});

const getImage = Effect.fn("serveWikiImage")(function* getImage(request: Request) {
  yield* verifySession(request.headers);
  const name = new URL(request.url).pathname.split("/").at(-1) ?? "";
  const extension = imageNamePattern.exec(name)?.groups?.["extension"];
  const contentType = extension === undefined ? undefined : imageTypes.get(extension);
  if (contentType === undefined) {
    return yield* WikiPageMissing.make();
  }
  const image = yield* readImage(name);
  return new Response(image.bytes, {
    headers: {
      "cache-control": "private, max-age=31536000, immutable",
      "content-type": contentType,
      "x-content-type-options": "nosniff",
    },
  });
});

const postPublish = Effect.fn("publishWikiDraft")(function* postPublish(request: Request) {
  const { user } = yield* verifySession(request.headers);
  if (!canPublish(user)) {
    return yield* WikiPublishForbidden.make();
  }
  const { path, version } = yield* readJsonBody(WikiDraftPublish, request);
  const draft = yield* findWikiDraft(path);
  if (draft?.version !== version) {
    return yield* WikiDraftConflict.make();
  }
  const { title } = yield* readWikiFrontmatter(draft.markdown);
  const { images, markdown } = toRepositoryImages(draft.markdown, path);
  const revision = yield* (yield* wikiSources()).gitBlobRevision(markdown);
  if (revision === draft.baseRevision) {
    return yield* WikiPublishUnchanged.make();
  }
  if (draft.publishedRevision === revision && draft.publishedUrl !== null) {
    return { url: draft.publishedUrl };
  }
  const imageFiles = yield* Effect.forEach(images, readImage, { concurrency: imageReads });
  const publisher = yield* WikiPublisher;
  const pullRequest = yield* publisher.publish({
    baseRevision: draft.baseRevision,
    images: imageFiles,
    markdown,
    pagePath: path,
    title,
  });
  yield* annotateSpan({ page: path, pullRequest: pullRequest.number });
  yield* markWikiDraftPublished({ path, revision, url: pullRequest.url, version }).pipe(
    Effect.tapError(() => publisher.withdraw(pullRequest.number)),
  );
  yield* publisher.enqueue(pullRequest.number);
  return { url: pullRequest.url };
});

function wikiEditApi<Requirements>(api: ApiRoutes<WikiServices | Requirements>) {
  return createApi("/wiki-edit")
    .get(
      "/source",
      ...api.route({ response: WikiSource }, getSource, {
        ...sessionFailures,
        DatabaseFailure: "unexpected",
        WikiPageMissing: missing,
      }),
    )
    .put(
      "/draft",
      ...api.route({ response: WikiDraftSaved }, putDraft, {
        ...sessionFailures,
        DatabaseFailure: "unexpected",
        WikiDraftConflict: conflict,
        WikiPageInvalid: {
          message: "タイトルと説明を入れてください。",
          status: httpStatus.badRequest,
        },
        WikiPageMissing: missing,
      }),
    )
    .delete(
      "/draft",
      ...api.route({ response: WikiSource }, deleteDraft, {
        ...sessionFailures,
        DatabaseFailure: "unexpected",
        WikiDraftConflict: conflict,
        WikiPageMissing: missing,
      }),
    )
    .post(
      "/publish",
      ...api.route({ response: WikiDraftPublished }, postPublish, {
        ...sessionFailures,
        DatabaseFailure: "unexpected",
        StorageFailed: "unexpected",
        WikiDraftConflict: conflict,
        WikiPageInvalid: {
          message: "タイトルと説明を入れてください。",
          status: httpStatus.badRequest,
        },
        WikiPageMissing: {
          message: "下書きに入れた画像が見つかりません。画像を入れ直してください。",
          status: httpStatus.notFound,
        },
        WikiPublishFailed: "unexpected",
        WikiPublishForbidden: {
          message: "文書を公開できるのは「変更できる」権限の人だけです。",
          status: httpStatus.forbidden,
        },
        WikiPublishKeyInvalid: "unexpected",
        WikiPublishStale: {
          message:
            "公開されている文書がこの下書きより後に更新されました。下書きの内容を控えてから捨て、最新の文書に反映し直してください。",
          status: httpStatus.conflict,
        },
        WikiPublishUnavailable: {
          message: "この環境では公開を有効にしていません。",
          status: httpStatus.notImplemented,
        },
        WikiPublishUnchanged: {
          message: "公開されている文書から変わっていません。",
          status: httpStatus.badRequest,
        },
        WikiPublishUnreachable: {
          message: "GitHub に届きませんでした。時間をおいてもう一度公開してください。",
          status: httpStatus.serviceUnavailable,
        },
      }),
    )
    .post(
      "/images",
      ...api.route({ response: WikiImageUploaded }, postImage, {
        ...sessionFailures,
        DatabaseFailure: "unexpected",
        StorageFailed: "unexpected",
        WikiImageTooLarge: {
          message: "画像は 5MB までです。",
          status: httpStatus.payloadTooLarge,
        },
      }),
    )
    .get(
      "/images/:name",
      ...api.raw(getImage, {
        ...sessionFailures,
        DatabaseFailure: "unexpected",
        StorageFailed: "unexpected",
        WikiPageMissing: { message: "画像が見つかりません。", status: httpStatus.notFound },
      }),
    );
}

export { wikiEditApi };
