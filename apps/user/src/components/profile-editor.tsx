import { Button, Field, FormColumn } from "@template/ui/ui";
import type { ProfileForm } from "#profile-form.ts";
import type { ReactElement } from "react";

const nameMaxLength = 100;
const profileMaxLength = 2000;

function ProfileEditor({ form }: Readonly<{ form: ProfileForm }>): ReactElement {
  return (
    <form onSubmit={form.handleSubmit} aria-busy={form.pending}>
      <FormColumn>
        <Field
          label="ユーザー名"
          name="name"
          required
          maxLength={nameMaxLength}
          value={form.name}
          onValueChange={form.handleNameChange}
        />
        <Field
          multiline
          label="自己紹介"
          name="profile"
          maxLength={profileMaxLength}
          value={form.profile}
          onValueChange={form.handleProfileChange}
        />
        <Button type="submit" variant="primary" disabled={form.pending}>
          保存
        </Button>
      </FormColumn>
    </form>
  );
}

export { ProfileEditor };
