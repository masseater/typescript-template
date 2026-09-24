import { Effect, Stream } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { stripEscapes } from "./strip-escapes.ts";

describe("stripEscapes", () => {
  describe("エスケープ列を含まない入力", () => {
    const it = test.extend("strippedText", () =>
      Effect.runPromise(
        Stream.make(Buffer.from("plain text\nsecond line\n")).pipe(
          stripEscapes,
          Stream.decodeText,
          Stream.mkString,
        ),
      ));

    it("そのまま通る", ({ strippedText }) => {
      expect(strippedText).toStrictEqual("plain text\nsecond line\n");
    });
  });

  describe("SGR の色指定を挟んだ入力", () => {
    const it = test.extend("strippedText", () =>
      Effect.runPromise(
        Stream.make(Buffer.from("\x1b[31mred\x1b[0m end")).pipe(
          stripEscapes,
          Stream.decodeText,
          Stream.mkString,
        ),
      ));

    it("色指定が除去され可視文字は残る", ({ strippedText }) => {
      expect(strippedText).toStrictEqual("red end");
    });
  });

  describe("カーソル移動と消去の CSI 列", () => {
    const it = test.extend("strippedText", () =>
      Effect.runPromise(
        Stream.make(Buffer.from("a\x1b[2K\x1b[1;5Hb\x1b[?25lc")).pipe(
          stripEscapes,
          Stream.decodeText,
          Stream.mkString,
        ),
      ));

    it("除去される", ({ strippedText }) => {
      expect(strippedText).toStrictEqual("abc");
    });
  });

  describe("チャンク境界で分割された CSI 列", () => {
    const it = test.extend("strippedText", () =>
      Effect.runPromise(
        Stream.make(Buffer.from("one\x1b"), Buffer.from("[3"), Buffer.from("2mtwo")).pipe(
          stripEscapes,
          Stream.decodeText,
          Stream.mkString,
        ),
      ));

    it("除去される", ({ strippedText }) => {
      expect(strippedText).toStrictEqual("onetwo");
    });
  });

  describe("ESC 単体でチャンクが終わり次のチャンクが平文で始まる入力", () => {
    const it = test.extend("strippedText", () =>
      Effect.runPromise(
        Stream.make(Buffer.from("a\x1b"), Buffer.from("Mb")).pipe(
          stripEscapes,
          Stream.decodeText,
          Stream.mkString,
        ),
      ));

    it("2 文字エスケープとして消える", ({ strippedText }) => {
      expect(strippedText).toStrictEqual("ab");
    });
  });

  describe("BEL で終わる OSC 列", () => {
    const it = test.extend("strippedText", () =>
      Effect.runPromise(
        Stream.make(Buffer.from("x\x1b]0;window title\x07y")).pipe(
          stripEscapes,
          Stream.decodeText,
          Stream.mkString,
        ),
      ));

    it("終端まで除去される", ({ strippedText }) => {
      expect(strippedText).toStrictEqual("xy");
    });
  });

  describe("ST で終わる OSC 列", () => {
    const it = test.extend("strippedText", () =>
      Effect.runPromise(
        Stream.make(Buffer.from("x\x1b]8;;https://example.com\x1b\\y")).pipe(
          stripEscapes,
          Stream.decodeText,
          Stream.mkString,
        ),
      ));

    it("終端まで除去される", ({ strippedText }) => {
      expect(strippedText).toStrictEqual("xy");
    });
  });

  describe("DCS と APC の列", () => {
    const it = test.extend("strippedText", () =>
      Effect.runPromise(
        Stream.make(Buffer.from("a\x1bPq#0\x1b\\b\x1b_note\x1b\\c")).pipe(
          stripEscapes,
          Stream.decodeText,
          Stream.mkString,
        ),
      ));

    it("ST 終端まで除去される", ({ strippedText }) => {
      expect(strippedText).toStrictEqual("abc");
    });
  });

  describe("制御文字列の中の ESC に ST 以外が続く入力", () => {
    const it = test.extend("strippedText", () =>
      Effect.runPromise(
        Stream.make(Buffer.from("a\x1b]0;title\x1b[31mred")).pipe(
          stripEscapes,
          Stream.decodeText,
          Stream.mkString,
        ),
      ));

    it("新たなエスケープとして解釈される", ({ strippedText }) => {
      expect(strippedText).toStrictEqual("ared");
    });
  });

  describe("制御文字列の中の ESC に BEL が続く入力", () => {
    const it = test.extend("strippedText", () =>
      Effect.runPromise(
        Stream.make(Buffer.from("a\x1b]0;t\x1b\x07b")).pipe(
          stripEscapes,
          Stream.decodeText,
          Stream.mkString,
        ),
      ));

    it("そこが終端になる", ({ strippedText }) => {
      expect(strippedText).toStrictEqual("ab");
    });
  });

  describe("文字集合指定の中間バイトを持つエスケープ", () => {
    const it = test.extend("strippedText", () =>
      Effect.runPromise(
        Stream.make(Buffer.from("a\x1b(Bb\x1b#8c")).pipe(
          stripEscapes,
          Stream.decodeText,
          Stream.mkString,
        ),
      ));

    it("除去される", ({ strippedText }) => {
      expect(strippedText).toStrictEqual("abc");
    });
  });

  describe("中間バイトが複数続くエスケープ", () => {
    const it = test.extend("strippedText", () =>
      Effect.runPromise(
        Stream.make(Buffer.from("a\x1b$(0b")).pipe(
          stripEscapes,
          Stream.decodeText,
          Stream.mkString,
        ),
      ));

    it("除去される", ({ strippedText }) => {
      expect(strippedText).toStrictEqual("ab");
    });
  });

  describe("中間バイトの後に制御文字が来る壊れた列", () => {
    const it = test.extend("strippedText", () =>
      Effect.runPromise(
        Stream.make(Buffer.from("a\x1b(\x01b")).pipe(
          stripEscapes,
          Stream.decodeText,
          Stream.mkString,
        ),
      ));

    it("打ち切られる", ({ strippedText }) => {
      expect(strippedText).toStrictEqual("ab");
    });
  });

  describe("連続する ESC", () => {
    const it = test.extend("strippedText", () =>
      Effect.runPromise(
        Stream.make(Buffer.from("a\x1b\x1b[1mb")).pipe(
          stripEscapes,
          Stream.decodeText,
          Stream.mkString,
        ),
      ));

    it("最後の 1 列だけとして解釈される", ({ strippedText }) => {
      expect(strippedText).toStrictEqual("ab");
    });
  });

  describe("CSI の途中に改行が来た入力", () => {
    const it = test.extend("strippedText", () =>
      Effect.runPromise(
        Stream.make(Buffer.from("a\x1b[3\nb")).pipe(
          stripEscapes,
          Stream.decodeText,
          Stream.mkString,
        ),
      ));

    it("列を打ち切り改行を残す", ({ strippedText }) => {
      expect(strippedText).toStrictEqual("a\nb");
    });
  });

  describe("入力の末尾で未完のまま終わる CSI 列", () => {
    const it = test.extend("strippedText", () =>
      Effect.runPromise(
        Stream.make(Buffer.from("done\x1b[3")).pipe(
          stripEscapes,
          Stream.decodeText,
          Stream.mkString,
        ),
      ));

    it("捨てられる", ({ strippedText }) => {
      expect(strippedText).toStrictEqual("done");
    });
  });

  describe("入力の末尾の ESC 単体", () => {
    const it = test.extend("strippedText", () =>
      Effect.runPromise(
        Stream.make(Buffer.from("done\x1b")).pipe(stripEscapes, Stream.decodeText, Stream.mkString),
      ));

    it("捨てられる", ({ strippedText }) => {
      expect(strippedText).toStrictEqual("done");
    });
  });

  describe("チャンク境界で分割されたマルチバイト文字", () => {
    const it = test.extend("strippedText", () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const bytes = Buffer.from("日本語\x1b[1m強調\x1b[0m");
          return yield* Stream.make(bytes.subarray(0, 4), bytes.subarray(4)).pipe(
            stripEscapes,
            Stream.decodeText,
            Stream.mkString,
          );
        }),
      ));

    it("壊れずに復元される", ({ strippedText }) => {
      expect(strippedText).toStrictEqual("日本語強調");
    });
  });

  describe("エスケープ列だけの入力", () => {
    const it = test.extend("strippedText", () =>
      Effect.runPromise(
        Stream.make(Buffer.from("\x1b[1m\x1b[0m")).pipe(
          stripEscapes,
          Stream.decodeText,
          Stream.mkString,
        ),
      ));

    it("空になる", ({ strippedText }) => {
      expect(strippedText).toStrictEqual("");
    });
  });
});
