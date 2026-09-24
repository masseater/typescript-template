import { renderedAt } from "@repo/ui/testing";
import { describe, expect, it } from "vite-plus/test";

import { serviceName } from "#shared/config/index.ts";
import { ConsentView } from "./consent-view.tsx";

function rendered(clientId: string | undefined, client: string | undefined, error: string): string {
  return renderedAt(
    <ConsentView client={client} clientId={clientId} error={error} onError={() => undefined} />,
    ["/consent"],
  );
}

describe("consent", () => {
  it("says the client is unknown when the request names none", () => {
    expect(rendered(undefined, undefined, "")).toContain(
      "連携を求めているクライアントが分かりません。",
    );
  });

  it("does not wait for a client the request does not name", () => {
    expect(rendered(undefined, undefined, "")).not.toContain("読み込み中です。");
  });

  it("says it is loading until the client name arrives", () => {
    expect(rendered("client-1", undefined, "")).toContain("読み込み中です。");
  });

  it("asks to allow the named client", () => {
    expect(rendered("client-1", "Claude", "")).toContain(
      `Claude に ${serviceName} の管理操作を許可しますか？`,
    );
  });

  it("shows the failure", () => {
    expect(rendered("client-1", undefined, "クライアントの情報を取得できませんでした。")).toContain(
      "クライアントの情報を取得できませんでした。",
    );
  });

  it("drops the loading notice once the load failed", () => {
    expect(rendered("client-1", undefined, "失敗")).not.toContain("読み込み中です。");
  });
});
