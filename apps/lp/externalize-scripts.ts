import { Array as Arr, Effect, Option, Schema, String as Str, pipe } from "effect";
import { Hex } from "effect/encoding";
import { parse } from "node-html-parser";

type Script = Readonly<{ src: string; code: string }>;

const SCRIPT_DIR = "assets";

const HASH_LENGTH = 16;

const START = 0;

const taggedError = Schema.TaggedError;

class InlineStyle extends taggedError<InlineStyle, { readonly brand: unique symbol }>()(
  "InlineStyle",
  { file: Schema.String, reason: Schema.String },
) {}

const INLINE_STYLE_REASON =
  "CSP の style-src 'self' が inline のスタイルを止める。スタイルは CSS ファイルから読む";

const srcOf = (code: string): Effect.Effect<string> =>
  Effect.promise(() => crypto.subtle.digest("SHA-256", new TextEncoder().encode(code))).pipe(
    Effect.map(
      (digest) =>
        `/${SCRIPT_DIR}/inline-${pipe(Hex.encode(new Uint8Array(digest)), Str.slice(START, HASH_LENGTH))}.js`,
    ),
  );

const tagOf = (rawAttrs: string, src: string): string =>
  `<${pipe([`script src="${src}"`, rawAttrs], Arr.filter(Str.isNonEmpty), Arr.join(" "))}></script>`;

const externalize = Effect.fn("externalize")(function* externalize({
  html,
  file,
}: Readonly<{ html: string; file: string }>) {
  const root = parse(html);
  yield* Arr.match(root.querySelectorAll("style, [style]"), {
    onEmpty: () => Effect.void,
    onNonEmpty: () => Effect.fail(InlineStyle.make({ file, reason: INLINE_STYLE_REASON })),
  });
  const inline = root.querySelectorAll("script:not([src])");
  const scripts: readonly Script[] = yield* pipe(
    inline,
    Effect.forEach((element) =>
      Effect.map(srcOf(element.rawText), (src) => ({ src, code: element.rawText })),
    ),
  );
  const ends = pipe(
    inline,
    Arr.map(({ range: [, end] }) => end),
  );
  const replaced = pipe(
    Arr.zip([START, ...ends], inline),
    Arr.zipWith(
      scripts,
      ([from, element], { src }) =>
        `${pipe(html, Str.slice(from, element.range[START]))}${tagOf(element.rawAttrs, src)}`,
    ),
  );
  const lastEnd = pipe(
    Arr.last(ends),
    Option.getOrElse(() => START),
  );
  const tail = pipe(html, Str.slice(lastEnd));
  return { html: `${Arr.join(replaced, "")}${tail}`, scripts };
});

export { SCRIPT_DIR, externalize };
