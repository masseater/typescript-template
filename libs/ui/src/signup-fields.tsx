import { Button, Field } from "./shared/ui";
import type { ReactElement, SubmitEventHandler, SyntheticEvent } from "react";
import type { ActionState } from "./action";
import type { TextInput } from "./use-text-input";
import { authClient } from "./client";
import { requireSuccess } from "./protocol";
import { useCallback } from "react";
import { useTextInput } from "./use-text-input";

interface SignUpFieldsProps {
  readonly action: ActionState;
  readonly onSent: (sent: boolean) => void;
}

interface SignUpInputs extends SignUpFieldsProps {
  readonly email: TextInput;
  readonly name: TextInput;
  readonly password: TextInput;
}

function useSignUpSubmit({
  action,
  email,
  name,
  onSent,
  password,
}: SignUpInputs): SubmitEventHandler<HTMLFormElement> {
  const { run } = action;
  const { value: emailValue } = email;
  const { value: nameValue } = name;
  const { setValue: setPassword, value: passwordValue } = password;
  return useCallback<SubmitEventHandler<HTMLFormElement>>(
    (event: Readonly<Pick<SyntheticEvent, "preventDefault">>) => {
      event.preventDefault();
      run(async () => {
        requireSuccess(
          await authClient.signUp.email({
            callbackURL: "/login",
            email: emailValue,
            name: nameValue,
            password: passwordValue,
          }),
        );
        setPassword("");
        onSent(true);
      });
    },
    [emailValue, nameValue, onSent, passwordValue, run, setPassword],
  );
}

function SignUpFields({ action, onSent }: SignUpFieldsProps): ReactElement {
  const name = useTextInput();
  const email = useTextInput();
  const password = useTextInput();
  const submit = useSignUpSubmit({ action, email, name, onSent, password });
  return (
    <form onSubmit={submit} aria-busy={action.pending}>
      <div className="flex w-full flex-col gap-4">
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
