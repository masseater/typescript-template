import { useToast } from "@repo/ui";
import { useNavigate, useRouter } from "@tanstack/react-router";

import { useCopyInvite, useJoinGroup, useLeaveGroup } from "#pages/groups/model/group-actions.ts";
import { useRenameGroupForm } from "#pages/groups/model/rename-group-form.ts";
import { GroupPanel } from "./group-panel.tsx";

import type { GroupDetail } from "#pages/groups/api/groups.ts";
import type { GroupsSearch } from "#pages/groups/model/groups-search.ts";
import type { ReactElement } from "react";
function invitePath(groupId: string, token: string): string {
  return `/groups/${groupId}?invite=${token}`;
}
function GroupPage({
  group,
  search,
}: Readonly<{
  group: GroupDetail;
  search: GroupsSearch;
}>): ReactElement {
  const navigate = useNavigate();
  const router = useRouter();
  const notify = useToast();
  const join = useJoinGroup(
    group.id,
    (conversationId) =>
      router.invalidate().then(() =>
        navigate({
          params: {
            id: conversationId,
          },
          to: "/messages/$id",
        }).then(() => notify("success", "グループに参加しました。")),
      ),
    search.invite,
  );
  const leave = useLeaveGroup(group.id, () =>
    router.invalidate().then(() => notify("success", "グループから退席しました。")),
  );
  const copyInvite = useCopyInvite(group.id, (token) => {
    const link = `${globalThis.location.origin}${invitePath(group.id, token)}`;
    void navigator.clipboard.writeText(link);
    notify("success", "招待リンクをコピーしました。");
  });
  const rename = useRenameGroupForm(group.id, group.name, () =>
    router.invalidate().then(() => notify("success", "グループ名を変更しました。")),
  );
  return (
    <GroupPanel
      copyInvite={copyInvite}
      group={group}
      join={join}
      leave={leave}
      onCopyInvite={copyInvite.handleCopyInvite}
      onJoin={join.handleJoin}
      onLeave={leave.handleLeave}
      onNameChange={rename.handleNameChange}
      onRename={rename.handleSubmit}
      rename={rename}
    />
  );
}
export { GroupPage };
