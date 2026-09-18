import { Field, FormColumn, Page, Status } from "@template/ui";
import { ProfileEditor } from "./profile-editor.tsx";
import type { ReactElement } from "react";
import { useViewerProfile } from "#entities/profile/index.ts";

const title = "プロフィールの編集";

function ProfileEditPage(): ReactElement {
  const { loading, profile, save } = useViewerProfile();
  if (loading) {
    return (
      <Page title={title}>
        <Status variant="pending">プロフィールを読み込んでいます。</Status>
      </Page>
    );
  }
  if (profile === undefined) {
    return (
      <Page title={title}>
        <Status variant="error">プロフィールを取得できませんでした。</Status>
      </Page>
    );
  }
  return (
    <Page title={title}>
      <FormColumn>
        <Field label="メールアドレス" name="email" type="email" readOnly value={profile.email} />
      </FormColumn>
      <ProfileEditor profile={profile} onSave={save} />
    </Page>
  );
}

export { ProfileEditPage };
