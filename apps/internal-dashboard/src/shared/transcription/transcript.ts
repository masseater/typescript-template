import { Schema } from "effect";

const pauseSplitSeconds = 2;
const millisecondsPerSecond = 1000;
const latinTail = /[\p{Script=Latin}\p{Number}]$/u;
const latinHead = /^[\p{Script=Latin}\p{Number}]/u;

const TranscribedWord = Schema.Struct({
  end: Schema.Finite,
  punctuated_word: Schema.String,
  speaker: Schema.Finite,
  start: Schema.Finite,
  word: Schema.String,
});
type TranscribedWord = typeof TranscribedWord.Type;

const TranscriptionOutput = Schema.Struct({
  results: Schema.Struct({
    channels: Schema.Array(
      Schema.Struct({
        alternatives: Schema.Array(Schema.Struct({ words: Schema.Array(TranscribedWord) })),
      }),
    ),
  }),
});

interface Segment {
  readonly endMs: number;
  readonly speakerLabel: number;
  readonly startMs: number;
  readonly text: string;
}

interface Transcript {
  readonly durationMs: number;
  readonly segments: readonly Segment[];
}

function joined(text: string, word: string): string {
  return latinTail.test(text) && latinHead.test(word) ? `${text} ${word}` : `${text}${word}`;
}

function milliseconds(seconds: number): number {
  return Math.round(seconds * millisecondsPerSecond);
}

function continues(segment: Segment, word: TranscribedWord): boolean {
  return (
    segment.speakerLabel === word.speaker &&
    milliseconds(word.start) - segment.endMs < milliseconds(pauseSplitSeconds)
  );
}

function transcriptOf(output: typeof TranscriptionOutput.Type): Transcript {
  const words = output.results.channels[0]?.alternatives[0]?.words ?? [];
  const segments: Segment[] = [];
  for (const word of words) {
    const last = segments.at(-1);
    if (last !== undefined && continues(last, word)) {
      segments[segments.length - 1] = {
        ...last,
        endMs: milliseconds(word.end),
        text: joined(last.text, word.punctuated_word),
      };
    } else {
      segments.push({
        endMs: milliseconds(word.end),
        speakerLabel: word.speaker,
        startMs: milliseconds(word.start),
        text: word.punctuated_word,
      });
    }
  }
  return { durationMs: segments.at(-1)?.endMs ?? 0, segments };
}

export { TranscriptionOutput, transcriptOf };
export type { Transcript };
