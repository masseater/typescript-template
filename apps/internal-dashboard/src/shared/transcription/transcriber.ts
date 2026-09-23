import { RECORDING_FAILURE } from "@repo/config";
import { withSpan } from "@repo/observability";
import { readWorkerConfig } from "@repo/runtime/bindings";
import { Context, Effect, Layer, Schema } from "effect";

import { TranscriptionOutput, transcriptOf } from "./transcript.ts";
import { TranscriptionFailed } from "./transcription-failed.ts";

import type { ConfigurationInvalid } from "@repo/config";
import type { StreamedFile } from "@repo/runtime";
import type { Transcript } from "./transcript.ts";

type WorkerModel = {
  readonly run: (model: string, input: Readonly<Record<string, unknown>>) => Promise<unknown>;
};

interface Audio {
  readonly body: StreamedFile["body"];
  readonly contentType: string;
}

interface TranscriberShape {
  readonly transcribe: (audio: Audio) => Effect.Effect<Transcript, TranscriptionFailed>;
}

const transcriptionModel = "@cf/deepgram/nova-3";
const decodeOutput = Schema.decodeUnknownEffect(TranscriptionOutput);

const transcribeWith = Effect.fn("transcribeWith")(function* transcribeWith(
  ai: WorkerModel,
  audio: Audio,
) {
  const output = yield* Effect.tryPromise({
    catch: (cause) => new TranscriptionFailed({ cause, reason: RECORDING_FAILURE.modelRejected }),
    try: () =>
      ai.run(transcriptionModel, {
        audio: { body: audio.body, contentType: audio.contentType },
        diarize: true,
        language: "ja",
        mip_opt_out: true,
        punctuate: true,
        smart_format: true,
      }),
  });
  const decoded = yield* decodeOutput(output).pipe(
    Effect.mapError(
      (cause) => new TranscriptionFailed({ cause, reason: RECORDING_FAILURE.outputUnreadable }),
    ),
  );
  return transcriptOf(decoded);
});

class Transcriber extends Context.Service<Transcriber, TranscriberShape>()(
  "#shared/transcription/Transcriber",
) {
  public static layer(ai: WorkerModel | undefined): Layer.Layer<Transcriber> {
    return Layer.succeed(
      Transcriber,
      Transcriber.of({
        transcribe: (audio) =>
          ai === undefined
            ? Effect.fail(new TranscriptionFailed({ reason: RECORDING_FAILURE.aiUnbound }))
            : transcribeWith(ai, audio).pipe(withSpan("recordings.transcribe")),
      }),
    );
  }

  public static fromEnvironment(env: unknown): Layer.Layer<Transcriber, ConfigurationInvalid> {
    return Layer.unwrap(
      Effect.map(readWorkerConfig(env), (config) => Transcriber.layer(config.AI)),
    );
  }
}

export { Transcriber, transcriptionModel };
