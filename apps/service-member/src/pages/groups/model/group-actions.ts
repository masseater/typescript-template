import { useAction } from "@repo/ui";

import { joinGroup, leaveGroup, refreshInvite } from "#pages/groups/api/groups.ts";

function useJoinGroup(
  groupId: string,
  onJoined: (conversationId: string) => Promise<void>,
  invite?: string,
) {
  const action = useAction();
  function handleJoin(): void {
    action.run(() => joinGroup(groupId, invite).then(onJoined));
  }
  return { error: action.error, handleJoin, pending: action.pending };
}

function useLeaveGroup(groupId: string, onLeft: () => Promise<void>) {
  const action = useAction();
  function handleLeave(): void {
    action.run(() => leaveGroup(groupId).then(onLeft));
  }
  return { error: action.error, handleLeave, pending: action.pending };
}

function useCopyInvite(groupId: string, onRefreshed: (token: string) => void) {
  const action = useAction();
  function handleCopyInvite(): void {
    action.run(() => refreshInvite(groupId).then(onRefreshed));
  }
  return { error: action.error, handleCopyInvite, pending: action.pending };
}

export { useCopyInvite, useJoinGroup, useLeaveGroup };
