import { verifySession } from "@repo/auth";
import { RECORDING_FAILURE, httpStatus, jobsQueueBinding, readJobs } from "@repo/config";
import { RequestRejected } from "@repo/observability";
import { FileStore } from "@repo/runtime";
import { CreatedResource, IdentifierQuery } from "@repo/runtime/contracts";
import {
  AppOrigin,
  createApi,
  readJsonBody,
  readSearchParams,
  type ApiRoutes,
} from "@repo/runtime/http";
import { env } from "cloudflare:workers";
import { Effect, Layer } from "effect";

import {
  PeopleList,
  PersonRegistration,
  RecordingList,
  RecordingUpload,
  RecordingView,
  SpeakerAssignment,
  maximumRecordingBytes,
} from "#shared/contracts/index.ts";
import {
  CoreRecords,
  RecordingAudioUnsupported,
  RecordingQueueFailed,
} from "#shared/transcription/index.ts";

import type { AppServices } from "@repo/runtime";

const failures = {
  ConfigurationInvalid: "unexpected",
  DatabaseFailure: "unexpected",
  RecordingAudioUnsupported: {
    message: "音声か動画のファイルを選んでください。",
    status: httpStatus.unsupportedMediaType,
  },
  RecordingNotFound: { message: "録音が見つかりません。", status: httpStatus.notFound },
  RecordingNotRetryable: {
    message: "失敗した録音だけをやり直せます。",
    status: httpStatus.conflict,
  },
  RpcClientError: {
    message: "録音の保存先に届きませんでした。時間をおいてやり直してください。",
    status: httpStatus.serviceUnavailable,
  },
  RecordingQueueFailed: {
    message: "文字起こしの順番待ちに入れられませんでした。録音の画面からやり直してください。",
    status: httpStatus.serviceUnavailable,
  },
  SpeakerPersonNotFound: { message: "登録された人が見つかりません。", status: httpStatus.notFound },
  StorageFailed: "unexpected",
} as const;

const audioTypes = ["audio/", "video/"];

function uploadRejection(request: Request, origin: string) {
  if (request.headers.get("origin") !== origin) {
    return new RequestRejected({ reason: "origin_denied" });
  }
  const length = Number(request.headers.get("content-length"));
  if (request.body === null || !Number.isInteger(length) || length <= 0) {
    return new RequestRejected({ reason: "body_required" });
  }
  return length > maximumRecordingBytes
    ? new RequestRejected({ reason: "body_too_large" })
    : undefined;
}

const enqueue = Effect.fn("enqueueRecording")(function* enqueue(
  recordingId: string,
  packet: {
    readonly jobId: string;
    readonly ownerId: string;
  },
) {
  const jobs = yield* readJobs(env);
  yield* Effect.tryPromise({
    catch: (cause) => new RecordingQueueFailed({ cause }),
    try: () => jobs[jobsQueueBinding].send(packet),
  }).pipe(
    Effect.tapError(() =>
      CoreRecords.use((core) =>
        core.failRecording({ failure: RECORDING_FAILURE.enqueueFailed, recordingId }),
      ),
    ),
  );
});

const uploadRecording = Effect.fn("uploadRecording")(function* uploadRecording(request: Request) {
  const { user } = yield* verifySession(request.headers);
  const rejected = uploadRejection(request, yield* AppOrigin);
  if (rejected !== undefined) {
    return yield* rejected;
  }
  const { title } = yield* readSearchParams(RecordingUpload, request);
  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (!audioTypes.some((prefix) => contentType.startsWith(prefix)) || request.body === null) {
    return yield* new RecordingAudioUnsupported();
  }
  const id = crypto.randomUUID();
  const jobId = crypto.randomUUID();
  const objectKey = `recordings/${id}`;
  const byteSize = Number(request.headers.get("content-length"));
  const files = yield* FileStore;
  yield* files.putStream(objectKey, { body: request.body, contentType });
  yield* (yield* CoreRecords)
    .createRecording({
      byteSize,
      contentType,
      id,
      jobId,
      objectKey,
      ownerId: user.id,
      title,
    })
    .pipe(Effect.onError(() => Effect.ignore(files.remove([objectKey]))));
  yield* enqueue(id, { jobId, ownerId: user.id });
  return { id };
});

const retry = Effect.fn("retryRecording")(function* retry(request: Request) {
  const { user } = yield* verifySession(request.headers);
  const { id } = yield* readJsonBody(IdentifierQuery, request);
  const jobId = crypto.randomUUID();
  yield* (yield* CoreRecords).retryRecording({ jobId, recordingId: id });
  yield* enqueue(id, { jobId, ownerId: user.id });
  return { id };
});

const remove = Effect.fn("deleteRecording")(function* remove(request: Request) {
  yield* verifySession(request.headers);
  const { id } = yield* readJsonBody(IdentifierQuery, request);
  const objectKey = yield* (yield* CoreRecords).deleteRecording({ recordingId: id });
  yield* (yield* FileStore).remove([objectKey]);
  return { id };
});

const assign = Effect.fn("assignSpeaker")(function* assign(request: Request) {
  yield* verifySession(request.headers);
  const assignment = yield* readJsonBody(SpeakerAssignment, request);
  yield* (yield* CoreRecords).assignSpeaker(assignment);
  return { id: assignment.recordingId };
});

const register = Effect.fn("registerPerson")(function* register(request: Request) {
  const { user } = yield* verifySession(request.headers);
  const { name } = yield* readJsonBody(PersonRegistration, request);
  return { id: yield* (yield* CoreRecords).registerPerson({ consentRecordedBy: user.id, name }) };
});

const forget = Effect.fn("removePerson")(function* forget(request: Request) {
  yield* verifySession(request.headers);
  const { id } = yield* readJsonBody(IdentifierQuery, request);
  yield* (yield* CoreRecords).removePerson({ personId: id });
  return { id };
});

function withRecordings<Success, Failure, Requirements>(
  handle: (request: Request) => Effect.Effect<Success, Failure, Requirements>,
) {
  return (request: Request) =>
    handle(request).pipe(
      Effect.provide(
        Layer.mergeAll(CoreRecords.fromEnvironment(env), FileStore.fromEnvironment(env)),
      ),
    );
}

function recordingsApi(api: ApiRoutes<AppServices>) {
  return createApi("")
    .get(
      "/recordings",
      api.route(
        RecordingList,
        withRecordings((request) =>
          verifySession(request.headers).pipe(
            Effect.andThen(CoreRecords.use((core) => core.listRecordings({}))),
            Effect.map((recordings) => ({ recordings })),
          ),
        ),
        failures,
      ),
    )
    .post("/recordings", api.route(CreatedResource, withRecordings(uploadRecording), failures))
    .get(
      "/recording",
      api.route(
        RecordingView,
        withRecordings((request) =>
          Effect.gen(function* view() {
            yield* verifySession(request.headers);
            const { id } = yield* readSearchParams(IdentifierQuery, request);
            return yield* (yield* CoreRecords).findRecording({ recordingId: id });
          }),
        ),
        failures,
      ),
    )
    .delete("/recording", api.route(CreatedResource, withRecordings(remove), failures))
    .post("/recording/retry", api.route(CreatedResource, withRecordings(retry), failures))
    .patch("/recording/speaker", api.route(CreatedResource, withRecordings(assign), failures))
    .get(
      "/people",
      api.route(
        PeopleList,
        withRecordings((request) =>
          verifySession(request.headers).pipe(
            Effect.andThen(CoreRecords.use((core) => core.listPeople({}))),
            Effect.map((people) => ({ people })),
          ),
        ),
        failures,
      ),
    )
    .post("/people", api.route(CreatedResource, withRecordings(register), failures))
    .delete("/people", api.route(CreatedResource, withRecordings(forget), failures));
}

export { recordingsApi };
