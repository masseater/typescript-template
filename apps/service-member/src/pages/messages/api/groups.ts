import { absent, apiData, apiDataOrNone } from "@repo/runtime/client";
import { notFound } from "@tanstack/react-router";

import { userClient } from "#shared/api/index.ts";
import { GroupCreated, GroupJoined, GroupView, OpenGroupList } from "#shared/contracts/index.ts";

import type { GroupJoinPolicy } from "@repo/config";

type GroupPageView = typeof GroupView.Type;
type OpenGroupsView = typeof OpenGroupList.Type;

async function loadOpenGroups(): Promise<OpenGroupsView> {
  const { api } = await userClient();
  return apiData(OpenGroupList, await api.groups.open.get());
}

async function loadGroup(id: string, invite: string | undefined): Promise<GroupPageView> {
  const { api } = await userClient();
  const view = apiDataOrNone(
    GroupView,
    await api.groups.view.get({
      query: invite === undefined ? { id } : { id, invite },
    }),
    absent.notFound,
  );
  if (view === undefined) {
    throw notFound();
  }
  return view;
}

async function createGroup(
  name: string,
  joinPolicy: GroupJoinPolicy,
): Promise<typeof GroupCreated.Type> {
  const { api } = await userClient();
  return apiData(GroupCreated, await api.groups.create.post({ joinPolicy, name }));
}

async function joinGroup(id: string, invite: string | undefined): Promise<string> {
  const { api } = await userClient();
  return apiData(
    GroupJoined,
    await api.groups.join.post(invite === undefined ? { id } : { id, invite }),
  ).conversationId;
}

export { createGroup, joinGroup, loadGroup, loadOpenGroups };
export type { GroupPageView, OpenGroupsView };
