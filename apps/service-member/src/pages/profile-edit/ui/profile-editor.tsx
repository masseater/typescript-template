import { Field, FormColumn } from "@repo/ui";

import { maximumNameLength, maximumProfileLength } from "#shared/contracts/index.ts";
import { ProfileActions } from "./profile-actions.tsx";
import { SocialLinksEditor } from "./social-links-editor.tsx";

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
        <SocialLinksEditor values={form.socialLinks} onChange={form.handleSocialLinksChange} />
        <ProfileActions blocked={form.blocked} homeId={homeId} />
      </FormColumn>
    </form>
  );
}

export { ProfileEditor };
