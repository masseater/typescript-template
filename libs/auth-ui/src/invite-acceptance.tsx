import { FormColumn, STATUS_VARIANT, StatusMessage, TextLink, localState } from "@repo/ui";
import { type ReactElement } from "react";

import { InviteForm } from "./invite-form.tsx";
import { type Invitation } from "./invite-preview.ts";

const useAccepted = localState(false);

const InviteAcceptance = ({
  endpoint,
  invitation,
  token,
}: Readonly<{ endpoint: string; invitation: Invitation; token: string }>): ReactElement => {
  const [accepted, setAccepted] = useAccepted();
  if (accepted) {
    return (
      <FormColumn>
        <StatusMessage variant={STATUS_VARIANT.success}>
          {"アカウントを作成しました。設定したパスワードでログインしてください。"}
        </StatusMessage>
        <TextLink to="/login">{"ログインへ"}</TextLink>
      </FormColumn>
    );
  }
  if (invitation.status === "unavailable") {
    return <StatusMessage variant={STATUS_VARIANT.failure}>{invitation.message}</StatusMessage>;
  }
  const markAccepted = (): void => {
    setAccepted(true);
  };
  return (
    <InviteForm
      email={invitation.email}
      endpoint={endpoint}
      token={token}
      onAccepted={markAccepted}
    />
  );
};

export { InviteAcceptance };
