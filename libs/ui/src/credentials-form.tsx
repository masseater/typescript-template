import type { Credentials, SignInHandlers } from "./sign-in";
import type { ReactElement, SyntheticEvent } from "react";
import type { ActionState } from "./action";
import { Button } from "./shared/ui/button";
import { EmailField } from "./email-field";
import { PasswordField } from "./password-field";
import { SignIn } from "./auth-input";
import type { TextFieldApi } from "./form";
import { formColumnClassName } from "./form";
import { signIn } from "./sign-in";
import { useForm } from "@tanstack/react-form";

type CredentialsFormProps = SignInHandlers & Readonly<{ action: ActionState }>;

function CredentialsForm(props: CredentialsFormProps): ReactElement {
  const { action } = props;
  const form = useForm({
    defaultValues: { email: "", password: "" },
    onSubmit: ({ value }: Readonly<{ value: Credentials }>): void => {
      action.run(async () => {
        await signIn(value, props);
        form.setFieldValue("password", "");
      });
    },
    validators: { onSubmit: SignIn },
  });
  function submit(event: Readonly<Pick<SyntheticEvent, "preventDefault">>): void {
    event.preventDefault();
    void form.handleSubmit();
  }
  return (
    <form onSubmit={submit} noValidate aria-busy={action.pending} className={formColumnClassName}>
      <form.Field name="email">
        {(field: TextFieldApi): ReactElement => <EmailField field={field} />}
      </form.Field>
      <form.Field name="password">
        {(field: TextFieldApi): ReactElement => <PasswordField field={field} purpose="current" />}
      </form.Field>
      <Button type="submit" variant="primary" disabled={action.blocked}>
        ログイン
      </Button>
    </form>
  );
}

export { CredentialsForm };
