import { authClient, requireSuccess } from "@repo/auth-ui";
import { AUTHENTICATION_METHOD } from "@repo/config";
import { type ActionState, Button, Field, FormColumn } from "@repo/ui";
import { useForm } from "@tanstack/react-form";
import { Schema } from "effect";

import {
  SignUpSubmission,
  maximumNameLength,
  maximumPasswordLength,
} from "#shared/contracts/index.ts";
import { fieldError } from "#shared/forms/field-error.ts";

import type { ReactElement, FormEvent } from "react";

const signUpSchema = Schema.toStandardSchemaV1(SignUpSubmission);

const signUp = async (values: typeof SignUpSubmission.Type, onSent: () => void): Promise<void> => {
  requireSuccess(
    await authClient.signUp.email({
      callbackURL: "/login",
      email: values.email,
      name: values.name,
      password: values.password,
    }),
  );
  onSent();
};

const SignUpFields = ({
  action,
  onSent,
}: Readonly<{
  action: ActionState;
  onSent: () => void;
}>): ReactElement => {
  const form = useForm({
    defaultValues: { email: "", name: "", password: "" },
    onSubmit: ({ value }) => {
      action.run(async () => signUp(value, onSent));
    },
    validators: { onSubmit: signUpSchema },
  });
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    event.stopPropagation();
    void form.handleSubmit();
  }
  return (
    <form noValidate onSubmit={handleSubmit} aria-busy={action.pending}>
      <FormColumn>
        <form.Field name="name">
          {(field) => (
            <Field
              label="ユーザー名"
              name="name"
              autoComplete="name"
              maxLength={maximumNameLength}
              value={field.state.value}
              onValueChange={field.handleChange}
              error={fieldError(field.state.meta.errors)}
            />
          )}
        </form.Field>
        <form.Field name="email">
          {(field) => (
            <Field
              label="メールアドレス"
              name="email"
              type="email"
              autoComplete="username"
              value={field.state.value}
              onValueChange={field.handleChange}
              error={fieldError(field.state.meta.errors)}
            />
          )}
        </form.Field>
        <form.Field name="password">
          {(field) => (
            <Field
              label="パスワード（12文字以上）"
              name={AUTHENTICATION_METHOD.password}
              type={AUTHENTICATION_METHOD.password}
              autoComplete="new-password"
              maxLength={maximumPasswordLength}
              value={field.state.value}
              onValueChange={field.handleChange}
              error={fieldError(field.state.meta.errors)}
            />
          )}
        </form.Field>
        <Button type="submit" variant="primary" disabled={action.blocked}>
          登録する
        </Button>
      </FormColumn>
    </form>
  );
};

export { SignUpFields };
