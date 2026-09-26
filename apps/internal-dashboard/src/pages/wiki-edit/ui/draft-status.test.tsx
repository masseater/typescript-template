import { renderedAt } from "@repo/ui/testing";
import { describe, expect, it } from "vite-plus/test";

import { DraftStatus } from "./draft-status.tsx";

function rendered(
  shown: Readonly<{
    failure?: string;
    publishedUrl?: string;
    version?: number;
  }>,
): string {
  return renderedAt(
    <DraftStatus
      failure={shown.failure}
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

  it("shows the failure of the last draft operation as an alert", () => {
    expect(rendered({ failure: "捨てられませんでした。" })).toMatch(
      /role="alert"[^>]*>.*捨てられませんでした。/su,
    );
  });
});
