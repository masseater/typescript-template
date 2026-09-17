import { Button, Field } from "./shared/ui";
import type { ReactElement, SyntheticEvent } from "react";
import type { ActionState } from "./action";
import type { TextInput } from "./use-text-input";
import { authClient } from "./client";
import { requireSuccess } from "./protocol";
import { useTextInput } from "./use-text-input";

interface SignUpFieldsProps {
  readonly action: ActionState;
  readonly onSent: (sent: boolean) => void;
}

async function signUp(
  fields: Readonly<{ email: TextInput; name: TextInput; password: TextInput }>,
  onSent: (sent: boolean) => void,
): Promise<void> {
  const { email, name, password } = fields;
  requireSuccess(
    await authClient.signUp.email({
      callbackURL: "/login",
      email: email.value,
      name: name.value,
      password: password.value,
    }),
  );
  password.setValue("");
  onSent(true);
}

function SignUpFields({ action, onSent }: SignUpFieldsProps): ReactElement {
  const name = useTextInput();
  const email = useTextInput();
  const password = useTextInput();
  function submit(event: Readonly<Pick<SyntheticEvent, "preventDefault">>): void {
    event.preventDefault();
    action.run(async () => signUp({ email, name, password }, onSent));
  }
  return (
    <form onSubmit={submit} aria-busy={action.pending}>
      <div className="flex w-full max-w-md flex-col gap-4">
        <Field
          label="ユーザー名"
          name="name"
          autoComplete="name"
          required
          maxLength={100}
          value={name.value}
          onChange={name.handleChange}
        />
        <Field
          label="メールアドレス"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email.value}
          onChange={email.handleChange}
        />
        <Field
          label="パスワード（12文字以上）"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          value={password.value}
          onChange={password.handleChange}
        />
        <Button type="submit" variant="primary" disabled={action.blocked}>
          登録して確認メールを送信
        </Button>
      </div>
    </form>
  );
}

export { SignUpFields };
