import { Cause } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { describe, expect, test } from "vite-plus/test";

import { renderedAt } from "./rendered-test-fixture.tsx";
import { RequestContent } from "./request-content.tsx";

const loadingMarkup =
  '<div class="css-PKJb"><p data-slot="status" role="status" aria-live="polite" class="inline-flex items-start gap-1 text-base leading-normal text-muted-foreground"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-loader-circle lucide-loader-2 mt-0.5 size-4 shrink-0 text-muted-foreground motion-safe:animate-spin" data-slot="spinner" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg><span>読み込み中です。</span></p><style class="_styletron_hydrate_" data-hydrate=""></style></div><div class="css-PKJb"></div>';
const failureMarkup =
  '<div class="css-PKJb"><div class="flex flex-col items-start gap-2"><p data-slot="status" role="alert" aria-live="assertive" class="inline-flex items-start gap-1 text-base leading-normal text-destructive"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle-alert lucide-alert-circle mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" x2="12" y1="8" y2="12"></line><line x1="12" x2="12.01" y1="16" y2="16"></line></svg><span>一覧を取得できませんでした。通信できません。</span></p><button data-baseweb="button" aria-label="再試行" data-slot="button" type="button" class="css-gOpPds">再試行</button></div><style class="_styletron_hydrate_" data-hydrate=""></style></div><div class="css-PKJb"></div>';
const loadedMarkup =
  '<div class="css-PKJb"><p>規約</p><style class="_styletron_hydrate_" data-hydrate=""></style></div><div class="css-PKJb"></div>';

describe("RequestContent", () => {
  const it = test
    .extend("theRefreshingContent", () =>
      renderedAt(
        <RequestContent
          failureTitle="一覧を取得できませんでした。"
          fetched={AsyncResult.success("規約", { waiting: true })}
          onRetry={() => undefined}
        >
          {(loaded) => <p>{loaded}</p>}
        </RequestContent>,
        ["/"],
      ))
    .extend("theFailedContent", () =>
      renderedAt(
        <RequestContent
          failureTitle="一覧を取得できませんでした。"
          fetched={AsyncResult.failure(Cause.fail(new Error("通信できません。")))}
          onRetry={() => undefined}
        >
          {(loaded) => <p>{String(loaded)}</p>}
        </RequestContent>,
        ["/"],
      ),
    )
    .extend("theLoadedContent", () =>
      renderedAt(
        <RequestContent
          failureTitle="一覧を取得できませんでした。"
          fetched={AsyncResult.success("規約")}
          onRetry={() => undefined}
        >
          {(loaded) => <p>{loaded}</p>}
        </RequestContent>,
        ["/"],
      ),
    );

  it("says it is loading while the value refreshes", ({ theRefreshingContent }) => {
    expect.hasAssertions();
    expect(theRefreshingContent).toBe(loadingMarkup);
  });

  it("shows the failure after its title with a retry button", ({ theFailedContent }) => {
    expect.hasAssertions();
    expect(theFailedContent).toBe(failureMarkup);
  });

  it("renders the loaded value", ({ theLoadedContent }) => {
    expect.hasAssertions();
    expect(theLoadedContent).toBe(loadedMarkup);
  });
});
