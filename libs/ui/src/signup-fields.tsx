import type { ReactElement, SyntheticEvent } from "react";
import { SignUp, maximumNameLength } from "./auth-input";
import type { ActionState } from "./action";
import { Button } from "./shared/ui/button";
import { EmailField } from "./email-field";
import { FormTextField } from "./form-text-field";
import { PasswordField } from "./password-field";
import type { Registration } from "./sign-up";
import type { TextFieldApi } from "./form";
import { formColumnClassName } from "./form";
import { signUp } from "./sign-up";
import { useForm } from "@tanstack/react-form";

function SignUpFields({
  action,
  onSent,
}: Readonly<{ action: ActionState; onSent: () => void }>): ReactElement {
  const form = useForm({
    defaultValues: { email: "", name: "", password: "" },
    onSubmit: ({ value }: Readonly<{ value: Registration }>): void => {
      action.run(async () => {
        await signUp(value);
        form.setFieldValue("password", "");
        onSent();
      });
    },
    validators: { onSubmit: SignUp },
  });
  function submit(event: Readonly<Pick<SyntheticEvent, "preventDefault">>): void {
    event.preventDefault();
    void form.handleSubmit();
  }
  return (
    <form onSubmit={submit} noValidate aria-busy={action.pending} className={formColumnClassName}>
      <form.Field name="name">
        {(field: TextFieldApi): ReactElement => (
          <FormTextField
            field={field}
            label="ユーザー名"
            name="name"
            autoComplete="name"
            required
            maxLength={maximumNameLength}
          />
        )}
      </form.Field>
      <form.Field name="email">
        {(field: TextFieldApi): ReactElement => <EmailField field={field} />}
      </form.Field>
      <form.Field name="password">
        {(field: TextFieldApi): ReactElement => <PasswordField field={field} purpose="new" />}
      </form.Field>
      <Button type="submit" variant="primary" disabled={action.blocked}>
        登録する
      </Button>
    </form>
  );
}

export { SignUpFields };
