import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vite-plus/test";

import { STATUS_VARIANT } from "./status-variants.ts";
import { StatusMessage } from "./status.tsx";

const emptyMarkup =
  '<p data-slot="status" role="status" aria-live="polite" class="inline-flex items-start gap-1 text-base leading-normal text-muted-foreground"><span>一覧はまだありません。</span></p>';

const pendingMarkup =
  '<p data-slot="status" role="status" aria-live="polite" class="inline-flex items-start gap-1 text-base leading-normal text-muted-foreground"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-loader-circle lucide-loader-2 mt-0.5 size-4 shrink-0 text-muted-foreground motion-safe:animate-spin" data-slot="spinner" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg><span>読み込み中です。</span></p>';

describe("空の状態", () => {
  const it = test.extend("theEmptyStatus", () =>
    renderToStaticMarkup(
      <StatusMessage variant={STATUS_VARIANT.empty}>一覧はまだありません。</StatusMessage>,
    ));

  it("待機を示すスピナーを出さない", ({ theEmptyStatus }) => {
    expect.hasAssertions();
    expect(theEmptyStatus).toBe(emptyMarkup);
  });
});

describe("処理中の状態", () => {
  const it = test.extend("thePendingStatus", () =>
    renderToStaticMarkup(
      <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>,
    ));

  it("リクエストの途中はスピナーを出す", ({ thePendingStatus }) => {
    expect.hasAssertions();
    expect(thePendingStatus).toBe(pendingMarkup);
  });
});
