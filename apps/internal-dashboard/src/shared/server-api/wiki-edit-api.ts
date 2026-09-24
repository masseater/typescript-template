import { verifySession } from "@repo/auth";
import { httpStatus } from "@repo/config";
import { discardWikiDraft, findWikiDraft, saveWikiDraft } from "@repo/db";
import { FileStore } from "@repo/runtime";
import { sessionFailures } from "@repo/runtime/account";
import { createApi, readJsonBody, readSearchParams, type ApiRoutes } from "@repo/runtime/http";
import { Effect, Encoding } from "effect";

import {
  WikiDraftDiscard,
  WikiDraftSave,
  WikiDraftSaved,
  WikiImageUpload,
  WikiImageUploaded,
  WikiSource,
  WikiSourceQuery,
} from "#shared/contracts/index.ts";
import { readWikiFrontmatter } from "#shared/wiki-document/wiki-frontmatter.ts";
import { WikiImageTooLarge } from "#shared/wiki-document/wiki-image-too-large.ts";
import { WikiPageMissing } from "#shared/wiki-document/wiki-page-missing.ts";

import type { WikiServices } from "#shared/wiki/index.ts";

const imagesPath = "/wiki-edit/images";
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
const imageNamePattern = /^(?<hash>[0-9a-f]{64})\.(?<extension>gif|jpg|png|webp)$/u;

const conflict = {
  message: "ほかの人が先に保存しました。再読み込みしてから編集してください。",
  status: httpStatus.conflict,
} as const;
const missing = { message: "ページが見つかりません。", status: httpStatus.notFound } as const;

const publishedSource = Effect.fn("publishedSource")(function* publishedSource(path: string) {
  const { gitBlobRevision, readWikiSource } = yield* Effect.promise(
    () => import("#shared/wiki-document/wiki-sources.ts"),
  );
  const markdown = yield* readWikiSource(path);
  if (markdown === undefined) {
    return yield* new WikiPageMissing();
  }
  return { markdown, revision: yield* gitBlobRevision(markdown) };
});

const openSource = Effect.fn("openSource")(function* openSource(path: string) {
  const published = yield* publishedSource(path);
  const draft = yield* findWikiDraft(path);
  if (draft === undefined) {
    return {
      baseRevision: published.revision,
      draft: null,
      markdown: published.markdown,
      path,
    };
  }
  return {
    baseRevision: draft.baseRevision,
    draft: { updatedAt: draft.updatedAt, version: draft.version },
    markdown: draft.markdown,
    path,
  };
});

const getSource = Effect.fn("getWikiSource")(function* getSource(request: Request) {
  yield* verifySession(request.headers);
  const { path } = yield* readSearchParams(WikiSourceQuery, request);
  return yield* openSource(path);
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
  yield* verifySession(request.headers);
  const { path, version } = yield* readJsonBody(WikiDraftDiscard, request);
  yield* discardWikiDraft(path, version);
  return yield* openSource(path);
});

const postImage = Effect.fn("uploadWikiImage")(function* postImage(request: Request) {
  yield* verifySession(request.headers);
  const { bytes, contentType } = yield* readJsonBody(WikiImageUpload, request, maximumImageBody);
  if (bytes.byteLength > maximumImageBytes) {
    return yield* new WikiImageTooLarge();
  }
  const digest = yield* Effect.promise(() =>
    crypto.subtle.digest("SHA-256", new Uint8Array(bytes)),
  );
  const name = `${Encoding.encodeHex(new Uint8Array(digest))}.${imageExtensions[contentType]}`;
  const files = yield* FileStore;
  yield* files.put(`wiki/images/${name}`, { bytes, contentType });
  return { url: `/api${imagesPath}/${name}` };
});

const getImage = Effect.fn("serveWikiImage")(function* getImage(request: Request) {
  yield* verifySession(request.headers);
  const name = new URL(request.url).pathname.split("/").at(-1) ?? "";
  const extension = imageNamePattern.exec(name)?.groups?.["extension"];
  const contentType = extension === undefined ? undefined : imageTypes.get(extension);
  if (contentType === undefined) {
    return yield* new WikiPageMissing();
  }
  const files = yield* FileStore;
  const image = yield* files.get(`wiki/images/${name}`);
  if (image === undefined) {
    return yield* new WikiPageMissing();
  }
  return new Response(new Uint8Array(image.bytes), {
    headers: {
      "cache-control": "private, max-age=31536000, immutable",
      "content-type": contentType,
      "x-content-type-options": "nosniff",
    },
  });
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
