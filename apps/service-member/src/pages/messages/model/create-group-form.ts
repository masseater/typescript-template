import { useAction, useTextInput } from "@repo/ui";

import { createGroup } from "#pages/messages/api/messages.ts";

import type { GroupJoinPolicy } from "#pages/messages/api/messages.ts";
interface CreateGroupForm {
  readonly blocked: boolean;
  readonly error: string | undefined;
  readonly handleNameChange: (value: string) => void;
  readonly name: string;
  readonly pending: boolean;
  readonly submit: (joinPolicy: GroupJoinPolicy) => void;
}
function useCreateGroupForm(onCreated: (groupId: string) => Promise<void>): CreateGroupForm {
  const name = useTextInput();
  const action = useAction();
  function submit(joinPolicy: GroupJoinPolicy): void {
    action.run(() =>
      createGroup(name.value, joinPolicy).then((created) =>
        onCreated(created.groupId).then(() => undefined),
      ),
    );
  }
  return {
    blocked: action.blocked,
    error: action.error,
    handleNameChange: name.handleChange,
    name: name.value,
    pending: action.pending,
    submit,
  };
}
export { useCreateGroupForm };
