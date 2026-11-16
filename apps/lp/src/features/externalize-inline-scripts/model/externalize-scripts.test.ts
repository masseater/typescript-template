import { Array as Arr, Effect, Exit, pipe } from "effect";
import { expect, test } from "vite-plus/test";

import { externalize } from "./externalize-scripts.ts";

const PAGE =
  '<html><body><main>hi</main><script data-tsr-stream-part="">self.$_TSR={}</script><script type="module" src="/assets/index.js"></script></body></html>';

const rewrite = (html: string): Promise<Readonly<{ code: string; src: boolean; html: boolean }>> =>
  Effect.runPromise(
    externalize({ html, file: "index.html" }).pipe(
      Effect.map(({ html: rewritten, scripts }) => {
        const src = pipe(
          scripts,
          Arr.map((script) => script.src),
          Arr.join(" "),
        );
        return {
          code: pipe(
            scripts,
            Arr.map((script) => script.code),
            Arr.join(" "),
          ),
          src: /^\/assets\/inline-[0-9a-f]{16}\.js$/u.test(src),
          html:
            rewritten ===
            `<html><body><main>hi</main><script src="${src}" data-tsr-stream-part=""></script><script type="module" src="/assets/index.js"></script></body></html>`,
        };
      }),
    ),
  );

const rejects = (html: string): Promise<boolean> =>
  Effect.runPromise(
    externalize({ html, file: "index.html" }).pipe(Effect.exit, Effect.map(Exit.isFailure)),
  );

test("inline の script を外部ファイルに出し、属性を保ったまま参照に置き換える", () =>
  expect(rewrite(PAGE)).resolves.toStrictEqual({ code: "self.$_TSR={}", src: true, html: true }));

test("inline のスタイルがあればビルドを止める", () =>
  expect(rejects('<p style="color: red">x</p>')).resolves.toBe(true));
