import { RegistryProvider } from "@effect/atom-react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { FlagsView } from "./flags-view.tsx";

import type { FlagEntry } from "#shared/contracts/index.ts";

function rendered(failure: string | undefined, flags: readonly FlagEntry[] | undefined): string {
  return renderToStaticMarkup(
    <RegistryProvider>
      <FlagsView
        failure={failure}
        flags={flags}
        onReload={() => undefined}
        onToggle={() => Promise.resolve(undefined)}
      />
    </RegistryProvider>,
  );
}

describe("feature flag list", () => {
  it("says it is loading until the flags arrive", () => {
    expect.hasAssertions();
    const html = rendered(undefined, undefined);
    expect(html).toContain("読み込み中です。");
    expect(html).not.toContain("再読み込み");
  });

  it("shows the failure with a reload button instead of the loading notice", () => {
    expect.hasAssertions();
    const html = rendered("フラグを取得できませんでした。", undefined);
    expect(html).toContain("フラグを取得できませんでした。");
    expect(html).toContain('aria-label="再読み込み"');
    expect(html).not.toContain("読み込み中です。");
  });

  it("says there are no flags yet once an empty list arrives", () => {
    expect.hasAssertions();
    const html = rendered(undefined, []);
    expect(html).toContain("機能フラグはまだありません。");
    expect(html).not.toContain("読み込み中です。");
  });
});
