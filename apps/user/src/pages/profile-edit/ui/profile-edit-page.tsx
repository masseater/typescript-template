import { Page, Status } from "@template/ui";
import { ProfileForm } from "./profile-form.tsx";
import type { ReactElement } from "react";
import { useViewerProfile } from "#entities/profile/index.ts";

function ProfileEditPage(): ReactElement {
  const profile = useViewerProfile();
  return (
    <Page title="プロフィールの編集">
      {profile === undefined ? (
        <Status variant="error">プロフィールを取得できませんでした。</Status>
      ) : (
        <ProfileForm profile={profile} />
      )}
    </Page>
  );
}

export { ProfileEditPage };
