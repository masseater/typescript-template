import { assert, describe, it } from "@effect/vitest";
import { APPLICATION, RECORDING_STATUS, httpStatus } from "@repo/config";
import { recordingSink } from "@repo/observability/testing";
import { accountApi } from "@repo/runtime/account";
import { appLayer } from "@repo/runtime/bindings";
import { apiRoot, apiRoutes, createApi } from "@repo/runtime/http";
import { appEnvironment, fixtureOrigin } from "@repo/runtime/testing";
import { workerRuntime } from "@repo/runtime/worker";
import { applyD1Migrations, reset, type D1Migration } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { Effect, Layer, Schema } from "effect";

import {
  PeopleList,
  RecordingAccepted,
  RecordingList,
  RecordingView,
} from "#shared/contracts/index.ts";
import { CoreRecords } from "#shared/transcription/index.ts";
import { recordingsApi } from "./recordings-api.ts";

declare global {
  namespace Cloudflare {
    interface Env {
      readonly EMAIL: {
        taken(): Promise<ReadonlyArray<{ readonly text: string; readonly to: readonly string[] }>>;
      };
      readonly CORE: Fetcher;
      readonly FILES: R2Bucket;
      readonly TEST_MIGRATIONS: D1Migration[];
    }
  }
}

const routes = { "/api/recordings": "recordings" };
const reporting = { log: recordingSink().sink, service: APPLICATION.user } as const;
const migrated = Effect.promise(() => reset()).pipe(
  Effect.andThen(Effect.promise(() => applyD1Migrations(env.DB, env.TEST_MIGRATIONS))),
);
const core = CoreRecords.layer(env.CORE);
const password = "test-password-safe-123";
const audio = new Uint8Array([0x49, 0x44, 0x33, 1, 2, 3, 4, 5]);
const decodeAccepted = Schema.decodeUnknownEffect(RecordingAccepted);
const decodeList = Schema.decodeUnknownEffect(RecordingList);
const decodePeople = Schema.decodeUnknownEffect(PeopleList);
const decodeView = Schema.decodeUnknownEffect(RecordingView);

type App = ReturnType<typeof recordingsApp>;

function recordingsApp() {
  const runtime = workerRuntime(() =>
    Layer.orDie(appLayer({ env: appEnvironment(), audience: APPLICATION.user, routes })),
  );
  const api = apiRoutes(runtime, reporting);
  return createApi(apiRoot).use(accountApi(api)).use(recordingsApi(api));
}

function send(
  app: App,
  path: string,
  init: Readonly<{
    body?: BodyInit;
    contentType?: string;
    cookie?: string;
    method?: "DELETE" | "GET" | "PATCH" | "POST";
    origin?: string;
  }>,
): Effect.Effect<Response> {
  return Effect.promise(() =>
    Promise.resolve(
      app.fetch(
        new Request(`${fixtureOrigin}${apiRoot}${path}`, {
          headers: {
            ...(init.body instanceof Uint8Array
              ? { "content-length": String(init.body.byteLength) }
              : {}),
            "content-type": init.contentType ?? "application/json",
            cookie: init.cookie ?? "",
            origin: init.origin ?? fixtureOrigin,
          },
          method: init.method ?? (init.body === undefined ? "GET" : "POST"),
          ...(init.body === undefined ? {} : { body: init.body }),
        }),
      ),
    ),
  );
}

function sendJson(
  app: App,
  path: string,
  init: Readonly<{ body: unknown; cookie: string; method?: "DELETE" | "PATCH" | "POST" }>,
): Effect.Effect<Response> {
  return Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(init.body).pipe(
    Effect.orDie,
    Effect.flatMap((body) =>
      send(app, path, { body, cookie: init.cookie, method: init.method ?? "POST" }),
    ),
  );
}

const jsonOf = (response: Response): Effect.Effect<unknown> =>
  Effect.promise(() => response.json() as Promise<unknown>);

const signedIn = Effect.fn("signedIn")(function* signedIn(app: App, email: string) {
  const signedUp = yield* sendJson(app, "/auth/sign-up/email", {
    body: { email, name: email.split("@")[0], password },
    cookie: "",
  });
  assert.strictEqual(signedUp.status, httpStatus.ok);
  const delivered = yield* Effect.promise(() => env.EMAIL.taken());
  const link =
    delivered
      .findLast((sent) => sent.to.includes(email))
      ?.text.split("\n")
      .find((line) => line.startsWith("http://")) ?? "";
  const token = new URLSearchParams(new URL(link).hash.slice(1)).get("token") ?? "";
  const verified = yield* sendJson(app, "/verify-email", { body: { token }, cookie: "" });
  assert.strictEqual(verified.status, httpStatus.ok);
  const session = yield* sendJson(app, "/auth/sign-in/email", {
    body: { email, password },
    cookie: "",
  });
  assert.strictEqual(session.status, httpStatus.ok);
  return session.headers
    .getSetCookie()
    .map((header) => header.split(";")[0] ?? "")
    .join("; ");
});

const uploaded = Effect.fn("uploaded")(function* uploaded(app: App, cookie: string) {
  const response = yield* send(app, "/recordings?title=%E5%AE%9A%E4%BE%8B", {
    body: audio,
    contentType: "audio/mpeg",
    cookie,
  });
  assert.strictEqual(response.status, httpStatus.ok);
  return (yield* decodeAccepted(yield* jsonOf(response))).id;
});

describe("recordings api", () => {
  it.effect("refuses anonymous callers", () =>
    Effect.gen(function* program() {
      yield* migrated;
      const app = recordingsApp();
      const statuses = yield* Effect.all([
        send(app, "/recordings", {}),
        send(app, "/recordings?title=a", { body: audio, contentType: "audio/mpeg" }),
        send(app, "/people", {}),
      ]).pipe(Effect.map((responses) => responses.map((response) => response.status)));
      assert.deepStrictEqual(statuses, [
        httpStatus.unauthorized,
        httpStatus.unauthorized,
        httpStatus.unauthorized,
      ]);
    }),
  );

  it.effect("stores an upload, queues it and lists it as waiting", () =>
    Effect.gen(function* program() {
      yield* migrated;
      const app = recordingsApp();
      const cookie = yield* signedIn(app, "host@example.test");
      const id = yield* uploaded(app, cookie);
      const stored = yield* Effect.promise(() => env.FILES.get(`recordings/${id}`));
      assert.strictEqual(stored?.size, audio.byteLength);
      assert.strictEqual(stored?.httpMetadata?.contentType, "audio/mpeg");
      const list = yield* decodeList(yield* jsonOf(yield* send(app, "/recordings", { cookie })));
      assert.deepStrictEqual(
        list.recordings.map((recording) => [recording.id, recording.title, recording.status]),
        [[id, "定例", RECORDING_STATUS.queued]],
      );
    }),
  );

  it.effect("rejects uploads that are not audio or come from another origin", () =>
    Effect.gen(function* program() {
      yield* migrated;
      const app = recordingsApp();
      const cookie = yield* signedIn(app, "host@example.test");
      const statuses = yield* Effect.all([
        send(app, "/recordings?title=a", { body: audio, contentType: "text/plain", cookie }),
        send(app, "/recordings?title=a", {
          body: audio,
          contentType: "audio/mpeg",
          cookie,
          origin: "https://elsewhere.example",
        }),
        send(app, "/recordings?title=", { body: audio, contentType: "audio/mpeg", cookie }),
      ]).pipe(Effect.map((responses) => responses.map((response) => response.status)));
      assert.deepStrictEqual(statuses, [
        httpStatus.unsupportedMediaType,
        httpStatus.forbidden,
        httpStatus.badRequest,
      ]);
    }),
  );

  it.effect("registers a consenting person and forgets them on request", () =>
    Effect.gen(function* program() {
      yield* migrated;
      const app = recordingsApp();
      const cookie = yield* signedIn(app, "host@example.test");
      const withoutConsent = yield* sendJson(app, "/people", {
        body: { consent: false, name: "田中" },
        cookie,
      });
      assert.strictEqual(withoutConsent.status, httpStatus.badRequest);
      const registered = yield* sendJson(app, "/people", {
        body: { consent: true, name: "田中" },
        cookie,
      });
      const personId = (yield* decodeAccepted(yield* jsonOf(registered))).id;
      const listed = yield* decodePeople(yield* jsonOf(yield* send(app, "/people", { cookie })));
      assert.deepStrictEqual(
        listed.people.map((person) => [person.id, person.name]),
        [[personId, "田中"]],
      );
      const removed = yield* sendJson(app, "/people", {
        body: { id: personId },
        cookie,
        method: "DELETE",
      });
      assert.strictEqual(removed.status, httpStatus.ok);
      const after = yield* decodePeople(yield* jsonOf(yield* send(app, "/people", { cookie })));
      assert.deepStrictEqual(after.people, []);
    }),
  );

  it.effect("retries only failed recordings and deletes the audio with the recording", () =>
    Effect.gen(function* program() {
      yield* migrated;
      const app = recordingsApp();
      const cookie = yield* signedIn(app, "host@example.test");
      const id = yield* uploaded(app, cookie);
      const early = yield* sendJson(app, "/recording/retry", { body: { id }, cookie });
      assert.strictEqual(early.status, httpStatus.conflict);
      yield* Effect.provide(
        CoreRecords.use((records) =>
          records.failRecording({ failure: "model_rejected", recordingId: id }),
        ),
        core,
      );
      const retried = yield* sendJson(app, "/recording/retry", { body: { id }, cookie });
      assert.strictEqual(retried.status, httpStatus.ok);
      const view = yield* decodeView(
        yield* jsonOf(yield* send(app, `/recording?id=${id}`, { cookie })),
      );
      assert.strictEqual(view.recording.status, RECORDING_STATUS.queued);
      assert.strictEqual(view.recording.failure, null);
      const deleted = yield* sendJson(app, "/recording", {
        body: { id },
        cookie,
        method: "DELETE",
      });
      assert.strictEqual(deleted.status, httpStatus.ok);
      const gone = yield* send(app, `/recording?id=${id}`, { cookie });
      assert.strictEqual(gone.status, httpStatus.notFound);
      const stored = yield* Effect.promise(() => env.FILES.get(`recordings/${id}`));
      assert.strictEqual(stored, null);
    }),
  );

  it.effect("names a transcribed speaker and drops the name when the person is forgotten", () =>
    Effect.gen(function* program() {
      yield* migrated;
      const app = recordingsApp();
      const cookie = yield* signedIn(app, "host@example.test");
      const id = yield* uploaded(app, cookie);
      yield* Effect.provide(
        CoreRecords.use((records) =>
          records.storeTranscript({
            recordingId: id,
            transcript: {
              durationMs: 900,
              segments: [{ endMs: 900, speakerLabel: 0, startMs: 0, text: "始めます。" }],
            },
          }),
        ),
        core,
      );
      const unknown = yield* sendJson(app, "/recording/speaker", {
        body: { label: 0, personId: "missing", recordingId: id },
        cookie,
        method: "PATCH",
      });
      assert.strictEqual(unknown.status, httpStatus.notFound);
      const registered = yield* sendJson(app, "/people", {
        body: { consent: true, name: "田中" },
        cookie,
      });
      const personId = (yield* decodeAccepted(yield* jsonOf(registered))).id;
      const unknownLabel = yield* sendJson(app, "/recording/speaker", {
        body: { label: 5, personId, recordingId: id },
        cookie,
        method: "PATCH",
      });
      assert.strictEqual(unknownLabel.status, httpStatus.notFound);
      const named = yield* sendJson(app, "/recording/speaker", {
        body: { label: 0, personId, recordingId: id },
        cookie,
        method: "PATCH",
      });
      assert.strictEqual(named.status, httpStatus.ok);
      const view = yield* decodeView(
        yield* jsonOf(yield* send(app, `/recording?id=${id}`, { cookie })),
      );
      assert.deepStrictEqual(view.speakers, [{ label: 0, person: { id: personId, name: "田中" } }]);
      yield* sendJson(app, "/people", { body: { id: personId }, cookie, method: "DELETE" });
      const forgotten = yield* decodeView(
        yield* jsonOf(yield* send(app, `/recording?id=${id}`, { cookie })),
      );
      assert.deepStrictEqual(forgotten.speakers, [{ label: 0, person: null }]);
    }),
  );
});
