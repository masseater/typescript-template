import { renderedAt } from "@repo/ui/testing";
import { describe, expect, it } from "vite-plus/test";

import { DraftStatus } from "./draft-status.tsx";

function rendered(
  shown: Readonly<{
    failures?: readonly (string | undefined)[];
    publishedUrl?: string;
    version?: number;
  }>,
): string {
  return renderedAt(
    <DraftStatus
      failures={shown.failures ?? []}
      publishedUrl={shown.publishedUrl ?? null}
      version={shown.version ?? 0}
    />,
    ["/"],
  );
}

describe("wiki draft status", () => {
  it("says a saved draft is not published yet", () => {
    expect(rendered({ version: 1 })).toContain("下書きとして保存されています。");
  });

  it("says nothing about drafts before one is saved", () => {
    expect(rendered({})).not.toContain("下書きとして保存されています。");
  });

  it("links the pull request a published draft opened", () => {
    const shown = rendered({ publishedUrl: "https://github.test/pull/1", version: 1 });
    expect(shown).toContain("https://github.test/pull/1");
    expect(shown).not.toContain("下書きとして保存されています。");
  });

  it("shows every failure and skips the absent ones", () => {
    const shown = rendered({
      failures: ["保存できませんでした。", undefined, "捨てられませんでした。"],
    });
    expect(shown).toContain("保存できませんでした。");
    expect(shown).toContain("捨てられませんでした。");
  });
});
