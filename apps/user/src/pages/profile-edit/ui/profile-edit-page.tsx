import { Field, Page, Status, useNotify } from "@template/ui/ui";
import type { Profile } from "#pages/profile-edit/api/profile.ts";
import { ProfileEditor } from "./profile-editor.tsx";
import type { ReactElement } from "react";
import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useProfileForm } from "#pages/profile-edit/model/profile-form.ts";

function ProfileEditPage({ initial }: Readonly<{ initial: Profile }>): ReactElement {
  const navigate = useNavigate();
  const notify = useNotify();
  const showSaved = useCallback(async (): Promise<void> => {
    await navigate({ params: { id: initial.id }, to: "/users/$id" });
    notify("プロフィールを保存しました。");
  }, [initial.id, navigate, notify]);
  const form = useProfileForm(initial, showSaved);
  return (
    <Page title="プロフィールの編集">
      <div className="flex w-full max-w-md flex-col">
        <Field label="メールアドレス" name="email" type="email" readOnly value={initial.email} />
      </div>
      <ProfileEditor form={form} homeId={initial.id} />
      {form.error !== "" && <Status variant="error">{form.error}</Status>}
    </Page>
  );
}

export { ProfileEditPage };
