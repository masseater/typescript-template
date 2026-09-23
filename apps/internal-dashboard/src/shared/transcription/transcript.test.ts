import { describe, expect, test } from "vite-plus/test";

import { transcriptOf } from "./transcript.ts";

function output(
  words: readonly Readonly<{
    end: number;
    punctuated_word: string;
    speaker: number;
    start: number;
    word: string;
  }>[],
) {
  return { results: { channels: [{ alternatives: [{ words }] }] } };
}

describe("transcriptOf", () => {
  test("joins consecutive words of one speaker into one segment", () => {
    expect(
      transcriptOf(
        output([
          { end: 0.4, punctuated_word: "今日は", speaker: 0, start: 0, word: "今日は" },
          { end: 0.9, punctuated_word: "よろしく。", speaker: 0, start: 0.5, word: "よろしく" },
          { end: 1.6, punctuated_word: "はい。", speaker: 1, start: 1.2, word: "はい" },
        ]),
      ),
    ).toStrictEqual({
      durationMs: 1600,
      segments: [
        { endMs: 900, speakerLabel: 0, startMs: 0, text: "今日はよろしく。" },
        { endMs: 1600, speakerLabel: 1, startMs: 1200, text: "はい。" },
      ],
    });
  });

  test("starts a new segment after a long pause by the same speaker", () => {
    expect(
      transcriptOf(
        output([
          { end: 1, punctuated_word: "まず", speaker: 0, start: 0, word: "まず" },
          { end: 4, punctuated_word: "次に", speaker: 0, start: 3.5, word: "次に" },
        ]),
      ).segments.map((segment) => segment.text),
    ).toStrictEqual(["まず", "次に"]);
  });

  test("keeps a space only between latin words", () => {
    expect(
      transcriptOf(
        output([
          { end: 0.3, punctuated_word: "Cloudflare", speaker: 0, start: 0, word: "Cloudflare" },
          { end: 0.6, punctuated_word: "Workers", speaker: 0, start: 0.3, word: "Workers" },
          { end: 0.9, punctuated_word: "で", speaker: 0, start: 0.6, word: "で" },
          { end: 1.2, punctuated_word: "動く", speaker: 0, start: 0.9, word: "動く" },
        ]),
      ).segments[0]?.text,
    ).toBe("Cloudflare Workersで動く");
  });

  test("returns an empty transcript for silence", () => {
    expect(transcriptOf(output([]))).toStrictEqual({ durationMs: 0, segments: [] });
  });
});
