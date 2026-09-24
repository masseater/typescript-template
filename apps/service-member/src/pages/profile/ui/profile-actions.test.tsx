import { renderedAt } from "@repo/ui/testing";
import { describe, expect, it } from "vite-plus/test";

import { ProfileActions } from "./profile-actions.tsx";

const idle = { blocked: false, error: undefined } as const;

function rendered(
  state: Readonly<{ blocked?: boolean; following?: boolean; own?: boolean }>,
  errors: Readonly<{ block?: string; follow?: string }> = {},
): string {
  return renderedAt(
    <ProfileActions
      block={{ ...idle, error: errors.block }}
      blocked={state.blocked ?? false}
      follow={{ ...idle, error: errors.follow }}
      following={state.following ?? false}
      memberId="member-1"
      onToggleBlock={() => undefined}
      onToggleFollow={() => undefined}
      own={state.own ?? false}
    />,
    ["/users/$id", "/settings/profile", "/messages/new"],
  );
}

describe("profile actions", () => {
  it("lets the owner edit and share their own profile", () => {
    expect.hasAssertions();
    const html = rendered({ blocked: true, own: true });
    expect(html).toContain('href="/settings/profile"');
    expect(html).toContain("リンクをコピー");
    expect(html).not.toContain("ブロック");
  });

  it("offers only to unblock a blocked member", () => {
    expect.hasAssertions();
    const html = rendered({ blocked: true }, { block: "解除できません。" });
    expect(html).toContain("ブロックを解除");
    expect(html).toContain("解除できません。");
    expect(html).not.toContain("メッセージを送る");
  });

  it("offers to follow, message and block another member", () => {
    expect.hasAssertions();
    const html = rendered({});
    expect(html).toContain("フォロー");
    expect(html).not.toContain("フォロー中");
    expect(html).toContain('href="/messages/new?peer=member-1"');
    expect(html).toContain("ブロック");
    expect(html).not.toContain("ブロックを解除");
  });

  it("marks a followed member and shows both failures", () => {
    expect.hasAssertions();
    const html = rendered(
      { following: true },
      { block: "ブロックできません。", follow: "フォローできません。" },
    );
    expect(html).toContain("フォロー中");
    expect(html).toContain("フォローできません。");
    expect(html).toContain("ブロックできません。");
  });
});
