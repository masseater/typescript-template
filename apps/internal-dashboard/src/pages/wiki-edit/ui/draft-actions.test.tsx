import { actionState, renderedAt } from "@repo/ui/testing";
import { describe, expect, it } from "vite-plus/test";

import { DraftActions } from "./draft-actions.tsx";

function rendered(
  shown: Readonly<{ pending?: boolean; publishable?: boolean; version?: number }>,
): string {
  const idle = actionState();
  return renderedAt(
    <DraftActions
      backHref="/wiki/guide"
      discarding={idle}
      onDiscard={() => undefined}
      onPublish={() => undefined}
      onSave={() => undefined}
      publishable={shown.publishable ?? false}
      publishing={idle}
      saving={actionState({ pending: shown.pending ?? false })}
      version={shown.version ?? 0}
    />,
    ["/", "/wiki/guide"],
  );
}

describe("wiki draft actions", () => {
  it("offers only saving before a draft exists", () => {
    const shown = rendered({});
    expect(shown).toContain("下書きを保存");
    expect(shown).not.toContain("保存した下書きを公開");
    expect(shown).not.toContain("下書きを捨てる");
  });

  it("offers publishing and discarding for a publishable draft", () => {
    const shown = rendered({ publishable: true, version: 1 });
    expect(shown).toContain("保存した下書きを公開");
    expect(shown).toContain("下書きを捨てる");
  });

  it("links back to the page", () => {
    expect(rendered({})).toContain('href="/wiki/guide"');
  });

  it("disables every draft action while a save is running", () => {
    expect(
      rendered({ pending: true, publishable: true, version: 1 }).match(/disabled=""/gu),
    ).toHaveLength(3);
  });
});
