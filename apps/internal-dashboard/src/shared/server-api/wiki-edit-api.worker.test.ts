import { Auth } from "@repo/auth";
import { AuthApps, MockNetwork, authTest, runWith, wikiStaff } from "@repo/auth/testing";
import { APPLICATION, ROLE, STAFF_PERMISSION, httpStatus } from "@repo/config";
import { findWikiDraft, markWikiDraftPublished } from "@repo/db";
import { addUser, runStatement } from "@repo/db/testing";
import { recordingSink } from "@repo/observability/testing";
import { apiRoot, apiRoutes, createApi } from "@repo/runtime/http";
import { appEnvironment, fixtureOrigin } from "@repo/runtime/testing";
import { workerRuntime } from "@repo/runtime/worker";
import { Effect, Encoding, Layer, Result, Schema } from "effect";
import { describe, expect } from "vite-plus/test";

import {
  WikiDraftPublished,
  WikiDraftSaved,
  WikiImageUploaded,
  WikiSource,
} from "#shared/contracts/index.ts";
import { gitBlobRevision, readWikiSource } from "#shared/wiki-document/wiki-sources.ts";
import {
  baseCommit,
  baseTree,
  createdCommit,
  createdTree,
  fakeGitHub,
  pullRequestUrl,
} from "#shared/wiki-publish/github-test-fixture.ts";
import { WikiPublisher } from "#shared/wiki-publish/index.ts";
import { mergeQueueLabel, wikiDocsDirectory } from "#shared/wiki-publish/wiki-repository.ts";
import { wikiLayer } from "#shared/wiki/index.ts";
import { wikiEditApi } from "./wiki-edit-api.ts";

const routes = { "/api/wiki-edit/*": "wiki-edit" };
const page = "index.md";
const draftMarkdown = "---\ntitle: 下書き\ndescription: 編集中\n---\n\n書きかけの本文\n";
const onePixelPng = Result.getOrThrow(
  Encoding.decodeBase64(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
  ),
);
const decodeSource = Schema.decodeUnknownEffect(WikiSource);
const decodeSaved = Schema.decodeUnknownEffect(WikiDraftSaved);
const decodeUploaded = Schema.decodeUnknownEffect(WikiImageUploaded);
const decodePublished = Schema.decodeUnknownEffect(WikiDraftPublished);
const encodeJson = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));

type Method = "DELETE" | "GET" | "POST" | "PUT";

function editApp(wikiAuth: Auth["Service"], publisher: Layer.Layer<WikiPublisher>) {
  const services = Layer.orDie(wikiLayer(appEnvironment(), routes));
  const runtime = workerRuntime(() =>
    Layer.mergeAll(services, Layer.succeed(Auth, wikiAuth), publisher),
  );
  const api = apiRoutes(runtime, { log: recordingSink().sink, service: APPLICATION.dashboard });
  return createApi(apiRoot).use(wikiEditApi(api));
}

type App = ReturnType<typeof editApp>;

const send = Effect.fn("send")(function* send(
  app: App,
  path: string,
  init: Readonly<{ body?: unknown; cookie: string; method: Method }>,
) {
  const body = init.body === undefined ? {} : { body: yield* encodeJson(init.body) };
  return yield* Effect.promise(() =>
    Promise.resolve(
      app.fetch(
        new Request(`${fixtureOrigin}${apiRoot}${path}`, {
          headers: {
            "content-type": "application/json",
            cookie: init.cookie,
            origin: fixtureOrigin,
          },
          method: init.method,
          ...body,
        }),
      ),
    ),
  );
});

const jsonOf = (response: Response): Effect.Effect<unknown> =>
  Effect.promise(() => response.json() as Promise<unknown>);

const signedInEditor = Effect.fn("signedInEditor")(function* signedInEditor(
  publisher: Layer.Layer<WikiPublisher> = WikiPublisher.layer(undefined),
) {
  const client = yield* wikiStaff("editor@example.com");
  return {
    app: editApp((yield* AuthApps)[APPLICATION.dashboard], publisher),
    cookie: client.cookieHeaders().get("cookie") ?? "",
  };
});

const openPage = Effect.fn("openPage")(function* openPage(app: App, cookie: string) {
  const response = yield* send(app, `/wiki-edit/source?path=${page}`, { cookie, method: "GET" });
  expect(response.status).toBe(httpStatus.ok);
  return yield* decodeSource(yield* jsonOf(response));
});

describe("editing a wiki page", () => {
  authTest("opens the published page with the git revision it was read at", ({ auth }) =>
    runWith(auth, () =>
      Effect.gen(function* openPublished() {
        const { app, cookie } = yield* signedInEditor();
        const published = yield* readWikiSource(page);
        expect(yield* openPage(app, cookie)).toStrictEqual({
          baseRevision: yield* gitBlobRevision(published ?? ""),
          draft: null,
          markdown: published,
          path: page,
          publishable: false,
        });
      }),
    ),
  );

  authTest("reopens a saved draft and refuses a save from an older version", ({ auth }) =>
    runWith(auth, () =>
      Effect.gen(function* saveDraft() {
        const { app, cookie } = yield* signedInEditor();
        const { baseRevision } = yield* openPage(app, cookie);
        const draft = { baseRevision, markdown: draftMarkdown, path: page, version: 0 };
        const saved = yield* send(app, "/wiki-edit/draft", { body: draft, cookie, method: "PUT" });
        expect(yield* decodeSaved(yield* jsonOf(saved))).toStrictEqual({ version: 1 });
        const reopened = yield* openPage(app, cookie);
        expect({ ...reopened, draft: { version: reopened.draft?.version } }).toStrictEqual({
          baseRevision,
          draft: { version: 1 },
          markdown: draftMarkdown,
          path: page,
          publishable: false,
        });
        const stale = yield* send(app, "/wiki-edit/draft", { body: draft, cookie, method: "PUT" });
        expect(stale.status).toBe(httpStatus.conflict);
      }),
    ),
  );

  authTest("discards a draft and reopens the published page", ({ auth }) =>
    runWith(auth, () =>
      Effect.gen(function* discardDraft() {
        const { app, cookie } = yield* signedInEditor();
        const published = yield* openPage(app, cookie);
        const saved = yield* send(app, "/wiki-edit/draft", {
          body: {
            baseRevision: published.baseRevision,
            markdown: draftMarkdown,
            path: page,
            version: 0,
          },
          cookie,
          method: "PUT",
        });
        expect(saved.status).toBe(httpStatus.ok);
        const discarded = yield* send(app, "/wiki-edit/draft", {
          body: { path: page, version: 1 },
          cookie,
          method: "DELETE",
        });
        expect(discarded.status).toBe(httpStatus.ok);
        expect(yield* openPage(app, cookie)).toStrictEqual(published);
      }),
    ),
  );

  authTest(
    "refuses a draft without a title and a draft for a page that does not exist",
    ({ auth }) =>
      runWith(auth, () =>
        Effect.gen(function* refuseDraft() {
          const { app, cookie } = yield* signedInEditor();
          const untitled = yield* send(app, "/wiki-edit/draft", {
            body: { baseRevision: null, markdown: "本文だけ\n", path: page, version: 0 },
            cookie,
            method: "PUT",
          });
          expect(untitled.status).toBe(httpStatus.badRequest);
          const missing = yield* send(app, "/wiki-edit/draft", {
            body: {
              baseRevision: null,
              markdown: draftMarkdown,
              path: "no-such-page.md",
              version: 0,
            },
            cookie,
            method: "PUT",
          });
          expect(missing.status).toBe(httpStatus.notFound);
        }),
      ),
  );

  authTest("serves an uploaded image only to a signed-in editor", ({ auth }) =>
    runWith(auth, () =>
      Effect.gen(function* uploadImage() {
        const { app, cookie } = yield* signedInEditor();
        const uploaded = yield* send(app, "/wiki-edit/images", {
          body: { bytes: Encoding.encodeBase64(onePixelPng), contentType: "image/png" },
          cookie,
          method: "POST",
        });
        const { url } = yield* decodeUploaded(yield* jsonOf(uploaded));
        const path = url.slice(apiRoot.length);
        const served = yield* send(app, path, { cookie, method: "GET" });
        expect(served.headers.get("content-type")).toBe("image/png");
        expect(new Uint8Array(yield* Effect.promise(() => served.arrayBuffer()))).toStrictEqual(
          onePixelPng,
        );
        const anonymous = yield* send(app, path, { cookie: "", method: "GET" });
        expect(anonymous.status).toBe(httpStatus.unauthorized);
      }),
    ),
  );

  authTest("refuses an image type that is not on the allowed list", ({ auth }) =>
    runWith(auth, () =>
      Effect.gen(function* refuseSvg() {
        const { app, cookie } = yield* signedInEditor();
        const refused = yield* send(app, "/wiki-edit/images", {
          body: { bytes: Encoding.encodeBase64("<svg/>"), contentType: "image/svg+xml" },
          cookie,
          method: "POST",
        });
        expect(refused.status).toBe(httpStatus.badRequest);
      }),
    ),
  );
});

const saveDraftWith = Effect.fn("saveDraftWith")(function* saveDraftWith(
  app: App,
  cookie: string,
  markdown: string,
) {
  const { baseRevision } = yield* openPage(app, cookie);
  const saved = yield* send(app, "/wiki-edit/draft", {
    body: { baseRevision, markdown, path: page, version: 0 },
    cookie,
    method: "PUT",
  });
  expect(saved.status).toBe(httpStatus.ok);
});

const publishDraft = (app: App, cookie: string) =>
  send(app, "/wiki-edit/publish", { body: { path: page, version: 1 }, cookie, method: "POST" });

const publishedRevision = Effect.fn("publishedRevision")(function* publishedRevision() {
  return yield* gitBlobRevision((yield* readWikiSource(page)) ?? "");
});

describe("publishing a wiki draft", () => {
  authTest(
    "opens a pull request with the page and its images and remembers it on the draft",
    ({ auth }) =>
      runWith(auth, () =>
        Effect.gen(function* publish() {
          const revision = yield* publishedRevision();
          const github = yield* fakeGitHub(revision);
          (yield* MockNetwork).use(...github.handlers);
          const { app, cookie } = yield* signedInEditor(WikiPublisher.layer(github.config));
          const uploaded = yield* send(app, "/wiki-edit/images", {
            body: { bytes: Encoding.encodeBase64(onePixelPng), contentType: "image/png" },
            cookie,
            method: "POST",
          });
          const { url } = yield* decodeUploaded(yield* jsonOf(uploaded));
          const image = url.split("/").at(-1) ?? "";
          yield* saveDraftWith(app, cookie, `${draftMarkdown}\n![図](${url})\n`);
          const response = yield* publishDraft(app, cookie);
          const reopened = yield* openPage(app, cookie);
          const callsBeforeRetry = github.calls.length;
          const retried = yield* publishDraft(app, cookie);
          const title = "docs: 「下書き」を更新";
          const branch = `wiki/index-${createdCommit.slice(0, 7)}`;
          expect({
            calls: github.calls,
            publishable: reopened.publishable,
            published: yield* decodePublished(yield* jsonOf(response)),
            remembered: reopened.draft?.publishedUrl,
            retried: yield* decodePublished(yield* jsonOf(retried)),
            retryCalls: github.calls.length - callsBeforeRetry,
          }).toStrictEqual({
            calls: [
              {
                body: { content: Encoding.encodeBase64(onePixelPng), encoding: "base64" },
                path: "/git/blobs",
              },
              {
                body: {
                  base_tree: baseTree,
                  tree: [
                    {
                      content: `${draftMarkdown}\n![図](./images/${image})\n`,
                      mode: "100644",
                      path: `${wikiDocsDirectory}/${page}`,
                      type: "blob",
                    },
                    {
                      mode: "100644",
                      path: `${wikiDocsDirectory}/images/${image}`,
                      sha: "b10b1",
                      type: "blob",
                    },
                  ],
                },
                path: "/git/trees",
              },
              {
                body: { message: title, parents: [baseCommit], tree: createdTree },
                path: "/git/commits",
              },
              { body: { ref: `refs/heads/${branch}`, sha: createdCommit }, path: "/git/refs" },
              {
                body: {
                  base: "main",
                  body: `wiki の編集画面から公開した変更です。\n\n文書: \`${wikiDocsDirectory}/${page}\``,
                  head: branch,
                  title,
                },
                path: "/pulls",
              },
              { body: { labels: [mergeQueueLabel] }, path: "/labels" },
            ],
            publishable: true,
            published: { url: pullRequestUrl },
            remembered: pullRequestUrl,
            retried: { url: pullRequestUrl },
            retryCalls: 0,
          });
        }),
      ),
  );

  authTest(
    "refuses to publish over a page that changed on the default branch and writes nothing",
    ({ auth }) =>
      runWith(auth, () =>
        Effect.gen(function* stale() {
          const github = yield* fakeGitHub("0".repeat(40));
          (yield* MockNetwork).use(...github.handlers);
          const { app, cookie } = yield* signedInEditor(WikiPublisher.layer(github.config));
          yield* saveDraftWith(app, cookie, draftMarkdown);
          const response = yield* publishDraft(app, cookie);
          expect({ calls: github.calls, status: response.status }).toStrictEqual({
            calls: [],
            status: httpStatus.conflict,
          });
        }),
      ),
  );

  authTest("refuses to publish without the GitHub App settings or without a change", ({ auth }) =>
    runWith(auth, () =>
      Effect.gen(function* refused() {
        const { app, cookie } = yield* signedInEditor();
        const published = yield* openPage(app, cookie);
        yield* saveDraftWith(app, cookie, draftMarkdown);
        const unconfigured = yield* publishDraft(app, cookie);
        const discarded = yield* send(app, "/wiki-edit/draft", {
          body: { path: page, version: 1 },
          cookie,
          method: "DELETE",
        });
        expect(discarded.status).toBe(httpStatus.ok);
        yield* saveDraftWith(app, cookie, published.markdown);
        const unchanged = yield* publishDraft(app, cookie);
        expect([unconfigured.status, unchanged.status]).toStrictEqual([
          httpStatus.notImplemented,
          httpStatus.badRequest,
        ]);
      }),
    ),
  );

  authTest("leaves the draft unpublished when GitHub cannot open the pull request", ({ auth }) =>
    runWith(auth, () =>
      Effect.gen(function* unreachable() {
        const github = yield* fakeGitHub(yield* publishedRevision(), { unavailableStep: "/pulls" });
        (yield* MockNetwork).use(...github.handlers);
        const { app, cookie } = yield* signedInEditor(WikiPublisher.layer(github.config));
        yield* saveDraftWith(app, cookie, draftMarkdown);
        const response = yield* publishDraft(app, cookie);
        const reopened = yield* openPage(app, cookie);
        expect({
          labelled: github.calls.some((call) => call.path === "/labels"),
          remembered: reopened.draft?.publishedUrl,
          status: response.status,
        }).toStrictEqual({
          labelled: false,
          remembered: null,
          status: httpStatus.serviceUnavailable,
        });
      }),
    ),
  );

  authTest("signs with the PKCS#1 key GitHub hands out for an app", ({ auth }) =>
    runWith(auth, () =>
      Effect.gen(function* pkcs1() {
        const github = yield* fakeGitHub(yield* publishedRevision(), { keyFormat: "pkcs1" });
        (yield* MockNetwork).use(...github.handlers);
        const { app, cookie } = yield* signedInEditor(WikiPublisher.layer(github.config));
        yield* saveDraftWith(app, cookie, draftMarkdown);
        const response = yield* publishDraft(app, cookie);
        expect(yield* decodePublished(yield* jsonOf(response))).toStrictEqual({
          url: pullRequestUrl,
        });
      }),
    ),
  );

  authTest("lets only staff who can change things publish", ({ auth }) =>
    runWith(auth, () =>
      Effect.gen(function* viewer() {
        const github = yield* fakeGitHub(yield* publishedRevision());
        (yield* MockNetwork).use(...github.handlers);
        const { app, cookie } = yield* signedInEditor(WikiPublisher.layer(github.config));
        yield* saveDraftWith(app, cookie, draftMarkdown);
        yield* addUser({ permission: STAFF_PERMISSION.editor, role: ROLE.staff, userId: "keeper" });
        yield* runStatement(
          "UPDATE user SET permission = ? WHERE email = ?",
          STAFF_PERMISSION.viewer,
          "editor@example.com",
        );
        const response = yield* publishDraft(app, cookie);
        const reopened = yield* openPage(app, cookie);
        expect({
          calls: github.calls,
          publishable: reopened.publishable,
          status: response.status,
        }).toStrictEqual({ calls: [], publishable: false, status: httpStatus.forbidden });
      }),
    ),
  );

  authTest("drops the draft once the published page carries what was published", ({ auth }) =>
    runWith(auth, () =>
      Effect.gen(function* settled() {
        const { app, cookie } = yield* signedInEditor();
        yield* saveDraftWith(app, cookie, draftMarkdown);
        yield* markWikiDraftPublished({
          path: page,
          revision: yield* publishedRevision(),
          url: pullRequestUrl,
          version: 1,
        });
        const reopened = yield* openPage(app, cookie);
        expect({ draft: reopened.draft, stored: yield* findWikiDraft(page) }).toStrictEqual({
          draft: null,
          stored: undefined,
        });
      }),
    ),
  );
});
