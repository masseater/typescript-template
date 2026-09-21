import { GROUP_JOIN_POLICY, groupJoinPolicies } from "@repo/config";
import { localState, useAction } from "@repo/ui";
import { useNavigate } from "@tanstack/react-router";

import { createGroup } from "#pages/messages/api/groups.ts";

import type { GroupJoinPolicy } from "@repo/config";

const useGroupName = localState("");
const useGroupPolicy = localState<string>(GROUP_JOIN_POLICY.invite);

function isJoinPolicy(value: string): value is GroupJoinPolicy {
  return groupJoinPolicies.some((policy) => policy === value);
}

function useCreateGroupForm() {
  const [name, setName] = useGroupName();
  const [policy, setPolicy] = useGroupPolicy();
  const navigate = useNavigate();
  const action = useAction();
  function handleSubmit(event: Readonly<{ preventDefault: () => void }>): void {
    event.preventDefault();
    if (!isJoinPolicy(policy)) {
      return;
    }
    const joinPolicy = policy;
    action.run(async () => {
      const created = await createGroup(name, joinPolicy);
      await navigate({ params: { id: created.groupId }, to: "/groups/$id" });
    });
  }
  return {
    blocked: action.blocked,
    error: action.error,
    handleNameChange: setName,
    handlePolicyChange: setPolicy,
    handleSubmit,
    name,
    policy,
  };
}

export { useCreateGroupForm };
