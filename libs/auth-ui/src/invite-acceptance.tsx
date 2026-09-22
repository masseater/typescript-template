import {
  InviteAcceptance as InviteAcceptanceBody,
  maximumNameLength,
  maximumPasswordLength,
  minimumPasswordLength,
} from "@repo/runtime/contracts";
import {
  ActionStatus,
  Button,
  Field,
  FormColumn,
  STATUS_VARIANT,
  StatusMessage,
  TextLink,
  localState,
  useAction,
  useTextInput,
} from "@repo/ui";
import { Schema } from "effect";
import { type ReactElement, type SyntheticEvent } from "react";

import { inviteFailureOf, type Invitation } from "./invite-preview.ts";

const encodeAcceptance = Schema.encodePromise(Schema.fromJsonString(InviteAcceptanceBody));

function postInvite(fetchImpl: typeof fetch, endpoint: string, body: string): Promise<Response> {
  return fetchImpl(endpoint, {
    body,
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

const acceptInvite = (
  endpoint: string,
  acceptance: Readonly<{ name: string; password: string; token: string }>,
): Promise<void> =>
  encodeAcceptance(acceptance).then((body) =>
    postInvite(fetch, endpoint, body).then((served) => {
      if (served.ok) {
        return;
      }
      return inviteFailureOf(served, "招待を受け付けられませんでした。").then((message) => {
        throw new Error(message);
      });
    }),
  );

const InviteForm = ({
  email,
  endpoint,
  onAccepted,
  token,
}: Readonly<{
  email: string;
  endpoint: string;
  onAccepted: () => void;
  token: string;
}>): ReactElement => {
  const action = useAction();
  const displayName = useTextInput();
  const password = useTextInput();
  const submit = (submitEvent: Readonly<Pick<SyntheticEvent, "preventDefault">>): void => {
    submitEvent.preventDefault();
    action.run(() =>
      acceptInvite(endpoint, {
        name: displayName.value,
        password: password.value,
        token,
      }).then(onAccepted),
    );
  };
  return (
    <form onSubmit={submit} aria-busy={action.pending} aria-label="招待を受ける">
      <FormColumn>
        <Field label="メールアドレス" name="email" type="email" readOnly value={email} />
        <Field
          label="名前"
          name="name"
          type="text"
          autoComplete="name"
          required
          maxLength={maximumNameLength}
          value={displayName.value}
          onValueChange={displayName.handleChange}
        />
        <Field
          label="パスワード"
          name="account-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={minimumPasswordLength}
          maxLength={maximumPasswordLength}
          value={password.value}
          onValueChange={password.handleChange}
        />
        <Button type="submit" variant="primary" disabled={action.blocked}>
          アカウントを作成する
        </Button>
        <ActionStatus action={action} pendingMessage="アカウントを作成しています。" />
      </FormColumn>
    </form>
  );
};

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
          アカウントを作成しました。設定したパスワードでログインしてください。
        </StatusMessage>
        <TextLink to="/login">ログインへ</TextLink>
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
