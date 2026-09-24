import { browserHttp } from "@repo/auth-ui";
import {
  absent,
  apiData,
  apiDataOrNoneFor,
  decodeJson,
  failureMessage,
} from "@repo/runtime/client";
import { CreatedResource } from "@repo/runtime/contracts";
import { notFound } from "@tanstack/react-router";
import { Effect } from "effect";
import { FetchHttpClient, HttpBody, HttpClient } from "effect/unstable/http";

import { wikiClient } from "#shared/api/index.ts";
import { PeopleList, RecordingList, RecordingView } from "#shared/contracts/index.ts";

import type {
  RecordingDetail,
  RecordingsOverview,
} from "#pages/recordings/model/recording-state.ts";

function loadRecordings(): Promise<RecordingsOverview> {
  return Promise.resolve(wikiClient()).then(({ api }) =>
    Promise.all([api.recordings.get(), api.people.get()]).then(([recordings, people]) => ({
      people: apiData(PeopleList, people).people,
      recordings: apiData(RecordingList, recordings).recordings,
    })),
  );
}

function loadRecording(id: string): Promise<RecordingDetail> {
  return Promise.resolve(wikiClient()).then(({ api }) =>
    Promise.all([api.recording.get({ query: { id } }), api.people.get()]).then(
      ([recording, people]) => {
        const found = apiDataOrNoneFor(absent.notFound)(RecordingView, recording);
        if (found === undefined) {
          throw notFound();
        }
        return { ...found, people: apiData(PeopleList, people).people };
      },
    ),
  );
}

function uploadRecording(title: string, audio: Readonly<File>): Promise<string> {
  return Effect.runPromise(
    Effect.gen(function* sendAudio() {
      const response = yield* HttpClient.post(
        `/api/recordings?${new URLSearchParams({ title }).toString()}`,
        { body: HttpBody.raw(audio, { contentLength: audio.size, contentType: audio.type }) },
      ).pipe(
        Effect.provide(browserHttp),
        Effect.provideService(FetchHttpClient.RequestInit, {
          credentials: "same-origin",
          redirect: "error",
        }),
      );
      const answered = yield* response.json;
      if (response.status < 200 || response.status >= 300) {
        return yield* Effect.die(
          new Error(
            failureMessage(
              { headers: new Headers(response.headers), status: response.status },
              answered,
            ),
          ),
        );
      }
      return decodeJson(CreatedResource, answered).id;
    }).pipe(Effect.orDie),
  );
}

function retryRecording(id: string): Promise<string> {
  return Promise.resolve(wikiClient()).then(({ api }) =>
    api.recording.retry.post({ id }).then((response) => apiData(CreatedResource, response).id),
  );
}

function deleteRecording(id: string): Promise<string> {
  return Promise.resolve(wikiClient()).then(({ api }) =>
    api.recording.delete({ id }).then((response) => apiData(CreatedResource, response).id),
  );
}

function assignSpeaker(
  recordingId: string,
  label: number,
  personId: string | null,
): Promise<string> {
  return Promise.resolve(wikiClient()).then(({ api }) =>
    api.recording.speaker
      .patch({ label, personId, recordingId })
      .then((response) => apiData(CreatedResource, response).id),
  );
}

function registerPerson(name: string): Promise<string> {
  return Promise.resolve(wikiClient()).then(({ api }) =>
    api.people
      .post({ consent: true, name })
      .then((response) => apiData(CreatedResource, response).id),
  );
}

function removePerson(id: string): Promise<string> {
  return Promise.resolve(wikiClient()).then(({ api }) =>
    api.people.delete({ id }).then((response) => apiData(CreatedResource, response).id),
  );
}

export {
  assignSpeaker,
  deleteRecording,
  loadRecording,
  loadRecordings,
  registerPerson,
  removePerson,
  retryRecording,
  uploadRecording,
};
