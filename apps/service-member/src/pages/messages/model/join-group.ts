import { useAction } from "@repo/ui";
import { useNavigate } from "@tanstack/react-router";

import { joinGroup } from "#pages/messages/api/groups.ts";

function useJoinGroup(groupId: string, invite: string | undefined) {
  const action = useAction();
  const navigate = useNavigate();
  function handleJoin(): void {
    action.run(async () => {
      const conversationId = await joinGroup(groupId, invite);
      await navigate({ params: { id: conversationId }, to: "/messages/$id" });
    });
  }
  return { blocked: action.blocked, error: action.error, handleJoin };
}

export { useJoinGroup };
