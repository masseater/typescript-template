import { Page, Status } from "@template/ui/ui";
import { ProfileEditor } from "./profile-editor.tsx";
import type { ProfileView } from "@template/runtime/contracts";
import type { ReactElement } from "react";
import { SignOutButton } from "@template/ui/auth";
import { useProfileForm } from "#pages/profile/model/profile-form.ts";
import { useSession } from "@template/ui";

type ProfileData = typeof ProfileView.Type;

interface ProfilePageProps {
  readonly profile: Readonly<ProfileData> | undefined;
  readonly save: (name: string, profile: string) => Promise<ProfileData>;
}

function ProfilePage({ profile, save }: ProfilePageProps): ReactElement {
  const { session, loading, error: sessionError } = useSession();
  const form = useProfileForm(profile, save);
  const shownError = form.error === "" ? sessionError : form.error;
  return (
    <Page title="プロフィール">
      {loading && <Status variant="pending">読み込み中です。</Status>}
      {!loading && !session && <a href="/login">ログインしてください。</a>}
      {session && <p>{session.user.email}</p>}
      {session && form.ready && <ProfileEditor form={form} />}
      {session && <SignOutButton />}
      {form.message !== "" && <Status variant="success">{form.message}</Status>}
      {(shownError ?? "") !== "" && <Status variant="error">{shownError}</Status>}
    </Page>
  );
}

export { ProfilePage };
