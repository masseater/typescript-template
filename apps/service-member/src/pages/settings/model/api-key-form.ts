import { localState, useAction, useTextInput, type ActionState } from "@repo/ui";
import { Option } from "effect";

import { createApiKey, type CreatedApiKey } from "#pages/settings/api/api-keys.ts";
interface ApiKeyForm {
  readonly action: ActionState;
  readonly handleMessageSendChange: (checked: boolean) => void;
  readonly handleNameChange: (value: string) => void;
  readonly handleProfileUpdateChange: (checked: boolean) => void;
  readonly handleIssue: () => void;
  readonly issued: CreatedApiKey | undefined;
  readonly messageSend: boolean;
  readonly name: string;
  readonly profileUpdate: boolean;
}
const useIssued = localState(Option.none<CreatedApiKey>());
const useMessageSend = localState(false);
const useProfileUpdate = localState(false);
function useApiKeyForm(onIssued: () => void): ApiKeyForm {
  const name = useTextInput();
  const [issued, setIssued] = useIssued();
  const [messageSend, setMessageSend] = useMessageSend();
  const [profileUpdate, setProfileUpdate] = useProfileUpdate();
  const action = useAction();
  function handleIssue(): void {
    const trimmed = name.value.trim();
    if (trimmed === "") {
      return;
    }
    action.run(() =>
      createApiKey(trimmed, {
        messageSend,
        profileUpdate,
      }).then((created) =>
        Promise.resolve().then(() => {
          setIssued(Option.some(created));
          return Promise.resolve().then(() => {
            name.handleChange("");
            return onIssued();
          });
        }),
      ),
    );
  }
  return {
    action,
    handleIssue,
    handleMessageSendChange: setMessageSend,
    handleNameChange: name.handleChange,
    handleProfileUpdateChange: setProfileUpdate,
    issued: Option.getOrUndefined(issued),
    messageSend,
    name: name.value,
    profileUpdate,
  };
}
export { useApiKeyForm };
