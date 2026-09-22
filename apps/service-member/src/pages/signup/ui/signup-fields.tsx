import { authClient, requireSuccess } from "@repo/auth-ui";
import { AUTHENTICATION_METHOD } from "@repo/config";
import {
  type ActionState,
  Button,
  Field,
  FormColumn,
  useTextInput,
  type TextInput,
} from "@repo/ui";
import { Effect } from "effect";

import type { ReactElement, SyntheticEvent } from "react";

const signUp = (
  fields: Readonly<{ email: TextInput; name: TextInput; password: TextInput }>,
  onSent: () => void,
): Promise<void> =>
  Effect.runPromise(
    Effect.gen(function* registerAccount() {
      const { email, name, password } = fields;
      requireSuccess(
        yield* Effect.promise(() =>
          authClient.signUp.email({
            callbackURL: "/login",
            email: email.value,
            name: name.value,
            password: password.value,
          }),
        ),
      );
      password.handleChange("");
      onSent();
    }),
  );

const SignUpFields = ({
  action,
  onSent,
}: {
  readonly action: ActionState;
  readonly onSent: () => void;
}): ReactElement => {
  const accountName = useTextInput();
  const email = useTextInput();
  const password = useTextInput();
  const submit = (submitEvent: Readonly<Pick<SyntheticEvent, "preventDefault">>): void => {
    submitEvent.preventDefault();
    action.run(() => signUp({ email, name: accountName, password }, onSent));
  };
  return (
    <form onSubmit={submit} aria-busy={action.pending}>
      <FormColumn>
        <Field
          label="ユーザー名"
          name="name"
          autoComplete="name"
          required
          maxLength={100}
          value={accountName.value}
          onValueChange={accountName.handleChange}
        />
        <Field
          label="メールアドレス"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email.value}
          onValueChange={email.handleChange}
        />
        <Field
          label="パスワード（12文字以上）"
          name={AUTHENTICATION_METHOD.password}
          type={AUTHENTICATION_METHOD.password}
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          value={password.value}
          onValueChange={password.handleChange}
        />
        <Button type="submit" variant="primary" disabled={action.blocked}>
          登録する
        </Button>
      </FormColumn>
    </form>
  );
};

export { SignUpFields };
