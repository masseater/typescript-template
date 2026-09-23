import { absent, apiData, apiDataOrNone } from "@repo/runtime/client";
import { notFound } from "@tanstack/react-router";

import { userClient } from "#shared/api/index.ts";
import { GroupInviteRefreshed, GroupJoined, GroupView } from "#shared/contracts/index.ts";

type GroupDetail = typeof GroupView.Type;

function loadGroup(id: string, invite?: string): Promise<GroupDetail> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.groups.view
      .get({ query: invite === undefined ? { id } : { id, invite } })
      .then((response) => {
        const group = apiDataOrNone(GroupView, response, absent.notFound);
        if (group === undefined) {
          throw notFound();
        }
        return group;
      }),
  );
}

function joinGroup(id: string, invite?: string): Promise<string> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.groups.join
      .post(invite === undefined ? { id } : { id, invite })
      .then((response) => apiData(GroupJoined, response).conversationId),
  );
}

function leaveGroup(id: string): Promise<void> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.groups.leave.post({ id }).then(() => undefined),
  );
}

function renameGroup(id: string, name: string): Promise<void> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.groups.rename.post({ id, name }).then(() => undefined),
  );
}

function refreshInvite(id: string): Promise<string> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.groups.invite
      .post({ id })
      .then((response) => apiData(GroupInviteRefreshed, response).inviteToken),
  );
}

export { joinGroup, leaveGroup, loadGroup, refreshInvite, renameGroup };
export type { GroupDetail };
