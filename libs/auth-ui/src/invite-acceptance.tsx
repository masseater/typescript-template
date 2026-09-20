import { httpStatus } from "@repo/observability/http-status";
import {
  ErrorBody,
  InvitePreview,
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
  useAction,
  useTextInput,
} from "@repo/ui";
import { Effect, Fiber, Result, Schema } from "effect";
import { useEffect, useState, type ReactElement, type SyntheticEvent } from "react";

import { decodeJson, errorMessage } from "./protocol.ts";

const inviteEndpoint = "/api/invite";

type Invitation =
  | Readonly<{ email: string; status: "open" }>
  | Readonly<{ message: string; status: "closed" }>
  | Readonly<{ status: "loading" }>;

const closedMessage = "招待が無効か、有効期限が切れています。招待した人に再送を依頼してください。";

const readFailure = async (served: Response): Promise<unknown> => {
  try {
    return await served.json();
  } catch (unreadableFailure) {
    return { error: errorMessage(unreadableFailure) };
  }
};

const failureOf = async (served: Response): Promise<string> => {
  const decoded = Schema.decodeUnknownResult(ErrorBody)(await readFailure(served));
  return Result.isSuccess(decoded) ? decoded.success.error : closedMessage;
};

const previewInvite = async (endpoint: string): Promise<Invitation> => {
  const served = await fetch(endpoint, { cache: "no-store", credentials: "same-origin" });
  if (served.status === httpStatus.notFound) {
    return { message: closedMessage, status: "closed" };
  }
  if (!served.ok) {
    return { message: await failureOf(served), status: "closed" };
  }
  const servedInvite: unknown = await served.json();
  return { email: decodeJson(InvitePreview, servedInvite).email, status: "open" };
};

const loadInvitation = (token: string): Effect.Effect<Invitation> =>
  Effect.promise(async (): Promise<Invitation> => {
    try {
      return await previewInvite(`${inviteEndpoint}?${new URLSearchParams({ token })}`);
    } catch (previewFailure) {
      return { message: errorMessage(previewFailure), status: "closed" };
    }
  });

const useInvitation = (token: string): Invitation => {
  const [invitation, setInvitation] = useState<Invitation>({ status: "loading" });
  useEffect(() => {
    const loading = Effect.runFork(Effect.map(loadInvitation(token), setInvitation));
    return (): void => {
      Effect.runFork(Fiber.interrupt(loading));
    };
  }, [token]);
  return invitation;
};

const acceptInvite = async (
  endpoint: string,
  acceptance: Readonly<{ name: string; password: string; token: string }>,
): Promise<void> => {
  const served = await fetch(endpoint, {
    body: JSON.stringify(acceptance),
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (!served.ok) {
    throw new Error(await failureOf(served));
  }
};

const InviteForm = ({
  email,
  onAccepted,
  token,
}: Readonly<{ email: string; onAccepted: () => void; token: string }>): ReactElement => {
  const action = useAction();
  const displayName = useTextInput();
  const password = useTextInput();
  const submit = (submitEvent: Readonly<Pick<SyntheticEvent, "preventDefault">>): void => {
    submitEvent.preventDefault();
    action.run(async () => {
      await acceptInvite(inviteEndpoint, {
        name: displayName.value,
        password: password.value,
        token,
      });
      onAccepted();
    });
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
          name="password"
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

const InviteAcceptance = ({ token }: Readonly<{ token: string }>): ReactElement => {
  const invitation = useInvitation(token);
  const [accepted, setAccepted] = useState(false);
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
  if (invitation.status === "loading") {
    return <StatusMessage variant={STATUS_VARIANT.pending}>招待を確認しています。</StatusMessage>;
  }
  if (invitation.status === "closed") {
    return <StatusMessage variant={STATUS_VARIANT.failure}>{invitation.message}</StatusMessage>;
  }
  const markAccepted = (): void => {
    setAccepted(true);
  };
  return <InviteForm email={invitation.email} token={token} onAccepted={markAccepted} />;
};

export { InviteAcceptance };
