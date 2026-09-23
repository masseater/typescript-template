import { AdminRpcs, InternalRpcs, MemberRpcs } from "@repo/core-api";
import {
  assignSpeaker,
  beginTranscription,
  checkDatabase,
  createRecording,
  Database,
  deleteRecording,
  failRecording,
  findRecording,
  listPeople,
  listRecordings,
  registerPerson,
  removePerson,
  retryRecording,
  storeTranscript,
  type DatabaseFailure,
} from "@repo/db";
import { Effect } from "effect";
import * as Layer from "effect/Layer";

import type { Rpc, RpcGroup } from "effect/unstable/rpc";
import type { CoreBindings } from "./bindings.ts";

const memberHandlers = (bindings: CoreBindings): Layer.Layer<Rpc.Handler<"databaseReady">> =>
  MemberRpcs.toLayer({
    databaseReady: (): Effect.Effect<boolean, DatabaseFailure, Database> =>
      checkDatabase().pipe(Effect.as(true)),
  }).pipe(Layer.provide(Database.layer(bindings.DB)));

const adminHandlers = (): Layer.Layer<Rpc.Handler<"ready">> =>
  AdminRpcs.toLayer({
    ready: (): Effect.Effect<boolean> => Effect.succeed(true),
  });

const internalHandlers = (
  bindings: CoreBindings,
): Layer.Layer<Rpc.ToHandler<RpcGroup.Rpcs<typeof InternalRpcs>>> =>
  InternalRpcs.toLayer({
    assignSpeaker: (assignment) => assignSpeaker(assignment),
    beginTranscription: ({ jobId }) => beginTranscription(jobId),
    createRecording: (queuedRecording) => createRecording(queuedRecording),
    deleteRecording: ({ recordingId }) => deleteRecording(recordingId),
    failRecording: ({ failure, recordingId }) => failRecording(recordingId, failure),
    findRecording: ({ recordingId }) => findRecording(recordingId),
    listPeople: () => listPeople(),
    listRecordings: () => listRecordings(),
    ready: (): Effect.Effect<boolean> => Effect.succeed(true),
    registerPerson: ({ consentRecordedBy, name }) => registerPerson(name, consentRecordedBy),
    removePerson: ({ personId }) => removePerson(personId),
    retryRecording: ({ jobId, recordingId }) => retryRecording(recordingId, jobId),
    storeTranscript: ({ recordingId, transcript }) => storeTranscript(recordingId, transcript),
  }).pipe(Layer.provide(Database.layer(bindings.DB)));

export { adminHandlers, internalHandlers, memberHandlers };
