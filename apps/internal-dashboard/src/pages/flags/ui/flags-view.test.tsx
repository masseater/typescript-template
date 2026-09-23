import { RegistryProvider } from "@effect/atom-react";
import { FLAG_KEY } from "@repo/feature-flags/definitions";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { FlagsView } from "./flags-view.tsx";

import type { FlagEntry } from "#shared/contracts/index.ts";

const entry = {
  description: "会員向けの掲示板を公開する",
  enabled: true,
  key: FLAG_KEY.memberBoard,
} as const satisfies FlagEntry;

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

  it("lists each flag with its description and current state", () => {
    expect.hasAssertions();
    const html = rendered(undefined, [entry]);
    expect(html).toContain(FLAG_KEY.memberBoard);
    expect(html).toContain(entry.description);
    expect(html).toContain(`aria-label="${FLAG_KEY.memberBoard} をオフにする"`);
    expect(html).not.toContain("読み込み中です。");
  });
});
