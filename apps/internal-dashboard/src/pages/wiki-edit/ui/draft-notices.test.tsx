import { renderedAt } from "@repo/ui/testing";
import { describe, expect, it } from "vite-plus/test";

import { DraftNotices } from "./draft-notices.tsx";

const quiet = { discardError: undefined, drafted: false, saveError: undefined } as const;

function rendered(
  shown: Readonly<{ discardError?: string; drafted?: boolean; saveError?: string }>,
): string {
  return renderedAt(<DraftNotices {...quiet} {...shown} />, ["/"]);
}

describe("wiki draft notices", () => {
  it("says a saved draft is not published yet", () => {
    expect(rendered({ drafted: true })).toContain("下書きとして保存されています。");
  });

  it("says nothing about drafts before one is saved", () => {
    expect(rendered({})).not.toContain("下書きとして保存されています。");
  });

  it("shows a save failure", () => {
    expect(rendered({ saveError: "保存できませんでした。" })).toContain("保存できませんでした。");
  });

  it("shows a discard failure", () => {
    expect(rendered({ discardError: "捨てられませんでした。" })).toContain(
      "捨てられませんでした。",
    );
  });
});
