import { Button, Field, TextareaField } from "@template/ui/ui";
import type { ProfileForm } from "#profile-form.ts";
import type { ReactElement } from "react";

const nameMaxLength = 100;
const profileMaxLength = 2000;

function ProfileEditor({ form }: Readonly<{ form: ProfileForm }>): ReactElement {
  return (
    <form onSubmit={form.handleSubmit} aria-busy={form.pending}>
      <div className="flex w-full max-w-md flex-col gap-4">
        <Field
          label="ユーザー名"
          name="name"
          required
          maxLength={nameMaxLength}
          value={form.name}
          onChange={form.handleNameChange}
        />
        <TextareaField
          label="自己紹介"
          name="profile"
          maxLength={profileMaxLength}
          value={form.profile}
          onChange={form.handleProfileChange}
        />
        <Button type="submit" variant="primary" disabled={form.pending}>
          保存
        </Button>
      </div>
    </form>
  );
}

export { ProfileEditor };
