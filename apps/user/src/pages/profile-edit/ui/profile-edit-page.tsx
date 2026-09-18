import { useNavigate, useRouter } from "@tanstack/react-router";
import type { ReactElement } from "react";

import type { Profile } from "#pages/profile-edit/api/profile.ts";
import { useProfileForm } from "#pages/profile-edit/model/profile-form.ts";
import { Field, FormColumn, Page, Status, useToast } from "@template/ui";

import { ProfileEditor } from "./profile-editor.tsx";

function ProfileEditPage({ initial }: Readonly<{ initial: Profile }>): ReactElement {
  const navigate = useNavigate();
  const router = useRouter();
  const notify = useToast();
  async function showSaved(): Promise<void> {
    await router.invalidate();
    await navigate({ params: { id: initial.id }, to: "/users/$id" });
    notify("success", "プロフィールを保存しました。");
  }
  const form = useProfileForm(initial, showSaved);
  return (
    <Page title="プロフィールの編集">
      <FormColumn>
        <Field label="メールアドレス" name="email" type="email" readOnly value={initial.email} />
      </FormColumn>
      <ProfileEditor form={form} homeId={initial.id} />
      {form.error !== "" && <Status variant="error">{form.error}</Status>}
    </Page>
  );
}

export { ProfileEditPage };
