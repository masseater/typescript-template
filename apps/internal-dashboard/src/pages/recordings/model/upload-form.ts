import { localState, useAction, useTextInput } from "@repo/ui";
import { Effect } from "effect";

import { uploadRecording } from "#pages/recordings/api/recordings.ts";

import type { SubmitEventHandler } from "react";

const useChosenAudio = localState<File | undefined>(undefined);

function upload(
  title: string,
  audio: File | undefined,
  onUploaded: (recordingId: string) => Promise<void>,
): Promise<void> {
  return Effect.runPromise(
    Effect.gen(function* sendRecording() {
      if (audio === undefined) {
        return yield* Effect.die(new Error("録音ファイルを選んでください。"));
      }
      const recordingId = yield* Effect.promise(() => uploadRecording(title, audio));
      yield* Effect.promise(() => onUploaded(recordingId));
    }),
  );
}

interface UploadForm {
  readonly blocked: boolean;
  readonly error: string | undefined;
  readonly handleAudioChange: (audio: File | undefined) => void;
  readonly handleSubmit: SubmitEventHandler<HTMLFormElement>;
  readonly handleTitleChange: (value: string) => void;
  readonly pending: boolean;
  readonly title: string;
}

function useUploadForm(onUploaded: (recordingId: string) => Promise<void>): UploadForm {
  const title = useTextInput();
  const [audio, setAudio] = useChosenAudio();
  const action = useAction();
  function handleSubmit(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    action.run(() => upload(title.value, audio, onUploaded));
  }
  return {
    blocked: action.blocked,
    error: action.error,
    handleAudioChange: setAudio,
    handleSubmit,
    handleTitleChange: title.handleChange,
    pending: action.pending,
    title: title.value,
  };
}

export { useUploadForm };
