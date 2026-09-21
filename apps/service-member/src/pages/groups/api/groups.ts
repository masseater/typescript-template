import { absent, apiData, apiDataOrNone } from "@repo/runtime/client";
import { notFound } from "@tanstack/react-router";

import { userClient } from "#shared/api/index.ts";
import { GroupInviteRefreshed, GroupJoined, GroupView } from "#shared/contracts/index.ts";

type GroupDetail = typeof GroupView.Type;

async function loadGroup(id: string, invite?: string): Promise<GroupDetail> {
  const { api } = await userClient();
  const group = apiDataOrNone(
    GroupView,
    await api.groups.view.get({ query: invite === undefined ? { id } : { id, invite } }),
    absent.notFound,
  );
  if (group === undefined) {
    throw notFound();
  }
  return group;
}

async function joinGroup(id: string, invite?: string): Promise<string> {
  const { api } = await userClient();
  const joined = apiData(
    GroupJoined,
    await api.groups.join.post(invite === undefined ? { id } : { id, invite }),
  );
  return joined.conversationId;
}

async function leaveGroup(id: string): Promise<void> {
  const { api } = await userClient();
  await api.groups.leave.post({ id });
}

async function renameGroup(id: string, name: string): Promise<void> {
  const { api } = await userClient();
  await api.groups.rename.post({ id, name });
}

async function refreshInvite(id: string): Promise<string> {
  const { api } = await userClient();
  return apiData(GroupInviteRefreshed, await api.groups.invite.post({ id })).inviteToken;
}

export { joinGroup, leaveGroup, loadGroup, refreshInvite, renameGroup };
export type { GroupDetail };
