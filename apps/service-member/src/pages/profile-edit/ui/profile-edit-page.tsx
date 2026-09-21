import { Field, FormColumn, Page, STATUS_VARIANT, StatusMessage, useToast } from "@repo/ui";
import { useNavigate, useRouter } from "@tanstack/react-router";

import { useProfileForm } from "#pages/profile-edit/model/profile-form.ts";
import { PhotoEditor } from "./photo-editor.tsx";
import { ProfileEditor } from "./profile-editor.tsx";

import type { Profile } from "#entities/profile/index.ts";
import type { ReactElement } from "react";

function ProfileEditPage({ initial }: Readonly<{ initial: Profile }>): ReactElement {
  const navigate = useNavigate();
  const router = useRouter();
  const notify = useToast();
  async function showSaved(): Promise<void> {
    await router.invalidate();
    await navigate({ params: { id: initial.id }, to: "/users/$id" });
    notify("success", "プロフィールを保存しました。");
  }
  const formState = useProfileForm(initial, showSaved);
  return (
    <Page title="プロフィールの編集">
      <FormColumn>
        <Field label="メールアドレス" name="email" type="email" readOnly value={initial.email} />
      </FormColumn>
      <PhotoEditor profile={initial} />
      <ProfileEditor formState={formState} homeId={initial.id} />
      {formState.error !== "" && (
        <StatusMessage variant={STATUS_VARIANT.failure}>{formState.error}</StatusMessage>
      )}
    </Page>
  );
}

export { ProfileEditPage };
