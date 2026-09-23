import { renderedAt } from "@repo/ui/testing";
import { describe, expect, it } from "vite-plus/test";

import { ConsentView } from "./consent-view.tsx";

function rendered(clientId: string | undefined, client: string | undefined, error: string): string {
  return renderedAt(
    <ConsentView client={client} clientId={clientId} error={error} onError={() => undefined} />,
    ["/consent"],
  );
}

describe("consent", () => {
  it("says which client is unknown when the request names none", () => {
    expect.hasAssertions();
    const html = rendered(undefined, undefined, "");
    expect(html).toContain("連携を求めているクライアントが分かりません。");
    expect(html).not.toContain("読み込み中です。");
  });

  it("says it is loading until the client name arrives", () => {
    expect.hasAssertions();
    expect(rendered("client-1", undefined, "")).toContain("読み込み中です。");
  });

  it("asks to allow the named client", () => {
    expect.hasAssertions();
    const html = rendered("client-1", "Claude", "");
    expect(html).toContain("管理画面 との連携");
    expect(html).toContain("Claude に 管理画面 の管理操作を許可しますか？");
    expect(html).toContain("許可する");
    expect(html).toContain("拒否する");
  });

  it("shows the failure instead of the loading notice", () => {
    expect.hasAssertions();
    const html = rendered("client-1", undefined, "クライアントの情報を取得できませんでした。");
    expect(html).toContain("クライアントの情報を取得できませんでした。");
    expect(html).not.toContain("読み込み中です。");
  });
});
