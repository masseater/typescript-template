import { Button, Stack, Textarea } from "smarthr-ui";
import { Field } from "@template/ui";
import type { ProfileForm } from "#profile-form.ts";
import type { ReactElement } from "react";
import { useId } from "react";

const nameMaxLength = 100;
const profileMaxLength = 2000;

function ProfileEditor({ form }: Readonly<{ form: ProfileForm }>): ReactElement {
  const profileId = useId();
  return (
    <form onSubmit={form.handleSubmit} aria-busy={form.pending}>
      <Stack>
        <Field
          label="ユーザー名"
          name="name"
          required
          maxLength={nameMaxLength}
          value={form.name}
          onChange={form.handleNameChange}
        />
        <label htmlFor={profileId}>自己紹介</label>
        <Textarea
          id={profileId}
          name="profile"
          maxLength={profileMaxLength}
          value={form.profile}
          onChange={form.handleProfileChange}
        />
        <Button type="submit" variant="primary" disabled={form.pending}>
          保存
        </Button>
      </Stack>
    </form>
  );
}

export { ProfileEditor };
