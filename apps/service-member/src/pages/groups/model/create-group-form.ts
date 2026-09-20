import { useAction, useTextInput } from "@repo/ui";

import { createGroup } from "#pages/groups/api/groups.ts";

interface CreateGroupForm {
  readonly blocked: boolean;
  readonly error: string | undefined;
  readonly handleNameChange: (value: string) => void;
  readonly name: string;
  readonly pending: boolean;
  readonly submit: (joinPolicy: "invite" | "open") => void;
}

function useCreateGroupForm(onCreated: (groupId: string) => Promise<void>): CreateGroupForm {
  const name = useTextInput();
  const action = useAction();
  function submit(joinPolicy: "invite" | "open"): void {
    action.run(async () => {
      const created = await createGroup(name.value, joinPolicy);
      await onCreated(created.groupId);
    });
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
