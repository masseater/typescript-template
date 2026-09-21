import { useAction } from "@repo/ui";

import { joinGroup, leaveGroup, refreshInvite } from "#pages/groups/api/groups.ts";

function useJoinGroup(
  groupId: string,
  onJoined: (conversationId: string) => Promise<void>,
  invite?: string,
) {
  const action = useAction();
  function handleJoin(): void {
    action.run(async () => {
      await onJoined(await joinGroup(groupId, invite));
    });
  }
  return { error: action.error, handleJoin, pending: action.pending };
}

function useLeaveGroup(groupId: string, onLeft: () => Promise<void>) {
  const action = useAction();
  function handleLeave(): void {
    action.run(async () => {
      await leaveGroup(groupId);
      await onLeft();
    });
  }
  return { error: action.error, handleLeave, pending: action.pending };
}

function useCopyInvite(groupId: string, onRefreshed: (token: string) => void) {
  const action = useAction();
  function handleCopyInvite(): void {
    action.run(async () => {
      onRefreshed(await refreshInvite(groupId));
    });
  }
  return { error: action.error, handleCopyInvite, pending: action.pending };
}

export { useCopyInvite, useJoinGroup, useLeaveGroup };
