import { maximumNameLength, maximumProfileLength } from "@repo/runtime/contracts";
import { Field, FormColumn } from "@repo/ui";

import { ProfileActions } from "./profile-actions.tsx";

import type { ProfileForm } from "#pages/profile-edit/model/profile-form.ts";
import type { ReactElement } from "react";

function ProfileEditor({
  form,
  homeId,
}: Readonly<{ form: ProfileForm; homeId: string }>): ReactElement {
  return (
    <form onSubmit={form.handleSubmit} aria-busy={form.pending}>
      <FormColumn>
        <Field
          label="ユーザー名"
          name="name"
          required
          maxLength={maximumNameLength}
          value={form.name}
          onValueChange={form.handleNameChange}
        />
        <Field
          multiline
          label="自己紹介"
          name="profile"
          maxLength={maximumProfileLength}
          value={form.profile}
          onValueChange={form.handleProfileChange}
        />
        <p className="text-sm leading-normal text-muted-foreground">
          残り {maximumProfileLength - form.profile.length} 文字
        </p>
        <ProfileActions homeId={homeId} pending={form.pending} />
      </FormColumn>
    </form>
  );
}

export { ProfileEditor };
