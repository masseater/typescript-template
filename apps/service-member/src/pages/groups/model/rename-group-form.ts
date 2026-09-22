import { useAction } from "@repo/ui";
import { useState } from "react";

import { renameGroup } from "#pages/groups/api/groups.ts";
interface RenameGroupForm {
  readonly blocked: boolean;
  readonly error: string | undefined;
  readonly handleNameChange: (value: string) => void;
  readonly handleSubmit: (
    event: Readonly<{
      preventDefault: () => void;
    }>,
  ) => void;
  readonly name: string;
  readonly pending: boolean;
}
function useRenameGroupForm(
  groupId: string,
  initialName: string,
  onRenamed: () => Promise<void>,
): RenameGroupForm {
  const [name, setName] = useState(initialName);
  const action = useAction();
  function handleSubmit(
    event: Readonly<{
      preventDefault: () => void;
    }>,
  ): void {
    event.preventDefault();
    action.run(() => renameGroup(groupId, name).then(() => onRenamed().then(() => undefined)));
  }
  return {
    blocked: action.blocked,
    error: action.error,
    handleNameChange: setName,
    handleSubmit,
    name,
    pending: action.pending,
  };
}
export { useRenameGroupForm };
