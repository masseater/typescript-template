import { GROUP_JOIN_POLICY } from "@repo/config";
import { renderedAt } from "@repo/ui/testing";
import { describe, expect, it } from "vite-plus/test";

import { GroupPanel } from "./group-panel.tsx";

import type { GroupView } from "#shared/contracts/index.ts";

type Group = typeof GroupView.Type;

const idle = { error: undefined, pending: false } as const;

const group = {
  conversationId: "conversation-1",
  id: "group-1",
  inviteExpired: false,
  isMember: false,
  isOwner: false,
  joinPolicy: GROUP_JOIN_POLICY.open,
  memberCount: 2,
  members: [],
  name: "読書会",
  owner: { id: "owner-1", name: "山田 花子" },
} as const satisfies Group;

function rendered(
  shown: Group,
  errors: Readonly<{ copyInvite?: string; join?: string; leave?: string; rename?: string }> = {},
): string {
  return renderedAt(
    <GroupPanel
      copyInvite={{ ...idle, error: errors.copyInvite }}
      group={shown}
      join={{ ...idle, error: errors.join }}
      leave={{ ...idle, error: errors.leave }}
      onCopyInvite={() => undefined}
      onJoin={() => undefined}
      onLeave={() => undefined}
      onNameChange={() => undefined}
      onRename={() => undefined}
      rename={{ blocked: false, error: errors.rename, name: shown.name, pending: false }}
    />,
    ["/groups/$id", "/messages/$id", "/users/$id"],
  );
}

describe("group panel", () => {
  it("offers to join a group the viewer is not in", () => {
    expect.hasAssertions();
    const html = rendered(group);
    expect(html).toContain("参加する");
    expect(html).toContain('href="/users/owner-1"');
    expect(html).toContain("メンバー 2 人");
    expect(html).not.toContain("会話を開く");
    expect(html).not.toContain("グループ名を変更");
  });

  it("says the invite has expired instead of offering to join", () => {
    expect.hasAssertions();
    const html = rendered({ ...group, inviteExpired: true });
    expect(html).toContain("招待リンクの期限が切れています。");
    expect(html).not.toContain("参加する");
  });

  it("lets a member open the conversation, copy the invite and leave", () => {
    expect.hasAssertions();
    const html = rendered({ ...group, inviteExpired: true, isMember: true });
    expect(html).toContain('href="/messages/conversation-1"');
    expect(html).toContain("招待リンクをコピー");
    expect(html).toContain("退席する");
    expect(html).not.toContain("招待リンクの期限が切れています。");
  });

  it("lets the owner rename the group but not leave it", () => {
    expect.hasAssertions();
    const html = rendered(
      { ...group, isMember: true, isOwner: true },
      { rename: "変更できません。" },
    );
    expect(html).toContain("グループ名を変更");
    expect(html).toContain(`value="${group.name}"`);
    expect(html).toContain("変更できません。");
    expect(html).not.toContain("退席する");
  });

  it("lists the members with links to their profiles", () => {
    expect.hasAssertions();
    const html = rendered({
      ...group,
      members: [{ id: "member-1", joinedAt: 0, name: "佐藤 太郎" }],
    });
    expect(html).toContain('id="group-members-heading"');
    expect(html).toContain('href="/users/member-1"');
    expect(rendered(group)).not.toContain("group-members-heading");
  });

  it("shows each failed action", () => {
    expect.hasAssertions();
    const html = rendered(group, {
      copyInvite: "コピーできません。",
      join: "参加できません。",
      leave: "退席できません。",
    });
    expect(html).toContain("参加できません。");
    expect(html).toContain("退席できません。");
    expect(html).toContain("コピーできません。");
  });
});
