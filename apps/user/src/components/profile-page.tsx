import { Page, Status, useSession } from "@template/ui";
import { ProfileEditor } from "#components/profile-editor.tsx";
import type { ReactElement } from "react";
import { SignOutButton } from "@template/ui/auth";
import { useProfileForm } from "#profile-form.ts";

function ProfilePage(): ReactElement {
  const { session, loading, error: sessionError } = useSession();
  const form = useProfileForm(session?.user.id);
  const shownError = form.error === "" ? sessionError : form.error;
  return (
    <Page title="プロフィール">
      {loading && <Status>読み込み中です。</Status>}
      {!loading && !session && <a href="/login">ログインしてください。</a>}
      {session && <p>{session.user.email}</p>}
      {session && form.ready && <ProfileEditor form={form} />}
      {session && <SignOutButton />}
      {form.message !== "" && <Status>{form.message}</Status>}
      {(shownError ?? "") !== "" && <Status error>{shownError}</Status>}
    </Page>
  );
}

export { ProfilePage };
