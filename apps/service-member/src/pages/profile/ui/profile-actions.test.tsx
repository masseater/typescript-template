import { PROFILE_VISIBILITY } from "@repo/config";
import { renderedAt } from "@repo/ui/testing";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vite-plus/test";

import { visibilityOptions } from "#entities/profile/index.ts";
import { ProfileActions } from "./profile-actions.tsx";

import type { ProfileVisibility } from "@repo/config";

const idle = { blocked: false, error: undefined } as const;

const privateNotice = "公開範囲が「自分だけ」のときは、共有しても相手には見えません。";

function rendered(
  state: Readonly<{
    blocked?: boolean;
    following?: boolean;
    own?: boolean;
    visibility?: ProfileVisibility;
  }>,
  errors: Readonly<{ block?: string; follow?: string }> = {},
): string {
  const queries = new QueryClient();
  queries.setQueryData(visibilityOptions.queryKey, {
    searchable: true,
    visibility: state.visibility ?? PROFILE_VISIBILITY.allMembers,
  });
  return renderedAt(
    <QueryClientProvider client={queries}>
      <ProfileActions
        block={{ ...idle, error: errors.block }}
        blocked={state.blocked ?? false}
        follow={{ ...idle, error: errors.follow }}
        following={state.following ?? false}
        memberId="member-1"
        onToggleBlock={() => undefined}
        onToggleFollow={() => undefined}
        own={state.own ?? false}
      />
    </QueryClientProvider>,
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

  it("warns the owner that a profile visible only to them cannot be shared", () => {
    expect.hasAssertions();
    expect(rendered({ own: true, visibility: PROFILE_VISIBILITY.self })).toContain(privateNotice);
  });

  it("does not warn the owner whose profile all members can see", () => {
    expect.hasAssertions();
    expect(rendered({ own: true, visibility: PROFILE_VISIBILITY.allMembers })).not.toContain(
      privateNotice,
    );
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
