import { authClient, requireSuccess } from "@repo/auth-ui";
import { maximumNameLength, maximumPasswordLength } from "@repo/runtime/contracts";
import { type ActionState, Button, Field, FormColumn } from "@repo/ui";
import { useForm } from "@tanstack/react-form";
import { Schema } from "effect";

import { SignUpSubmission } from "#shared/contracts/index.ts";
import { EmailField, NameField, fieldError } from "#shared/forms/index.ts";

import type { FormEvent, ReactElement } from "react";

const signUpSchema = Schema.toStandardSchemaV1(SignUpSubmission);

const signUp = (values: typeof SignUpSubmission.Type, onSent: () => void): Promise<void> =>
  authClient.signUp
    .email({
      callbackURL: "/login",
      email: values.email,
      name: values.name,
      password: values.password,
    })
    .then(requireSuccess)
    .then(() => {
      onSent();
    });

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
      action.run(() => signUp(value, onSent));
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
          {(field) => <NameField field={field} label="ユーザー名" maxLength={maximumNameLength} />}
        </form.Field>
        <form.Field name="email">{(field) => <EmailField field={field} />}</form.Field>
        <form.Field name="password">
          {(field) => (
            <Field
              label="パスワード（12文字以上）"
              name="password"
              type="password"
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
