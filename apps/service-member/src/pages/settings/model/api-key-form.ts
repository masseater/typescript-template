import { localState, useAction, useTextInput, type ActionState } from "@repo/ui";
import { Option } from "effect";

import { createApiKey, type CreatedApiKey } from "#pages/settings/api/api-keys.ts";

interface ApiKeyForm {
  readonly action: ActionState;
  readonly handleNameChange: (value: string) => void;
  readonly issue: () => void;
  readonly issued: CreatedApiKey | undefined;
  readonly name: string;
}

const useIssued = localState(Option.none<CreatedApiKey>());

function useApiKeyForm(onIssued: () => void): ApiKeyForm {
  const name = useTextInput();
  const [issued, setIssued] = useIssued();
  const action = useAction();
  function issue(): void {
    const trimmed = name.value.trim();
    if (trimmed === "") {
      return;
    }
    action.run(async () => {
      const created = await createApiKey(trimmed);
      setIssued(Option.some(created));
      name.handleChange("");
      onIssued();
    });
  }
  return {
    action,
    handleNameChange: name.handleChange,
    issue,
    issued: Option.getOrUndefined(issued),
    name: name.value,
  };
}

export { useApiKeyForm };
