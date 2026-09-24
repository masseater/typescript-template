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
    expect(rendered(undefined, undefined)).toContain("読み込み中です。");
  });

  it("offers no reload while loading", () => {
    expect(rendered(undefined, undefined)).not.toContain("再読み込み");
  });

  it("shows the failure", () => {
    expect(rendered("フラグを取得できませんでした。", undefined)).toContain(
      "フラグを取得できませんでした。",
    );
  });

  it("offers a reload button with the failure", () => {
    expect(rendered("失敗", undefined)).toContain('aria-label="再読み込み"');
  });

  it("drops the loading notice once the load failed", () => {
    expect(rendered("失敗", undefined)).not.toContain("読み込み中です。");
  });

  it("says there are no flags yet once an empty list arrives", () => {
    expect(rendered(undefined, [])).toContain("機能フラグはまだありません。");
  });
});
