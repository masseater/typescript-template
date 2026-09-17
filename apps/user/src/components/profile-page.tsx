import { Page, Status } from "@template/ui/ui";
import { ProfileEditor } from "#components/profile-editor.tsx";
import type { ReactElement } from "react";
import { SignOutButton } from "@template/ui/auth";
import { getRouteApi } from "@tanstack/react-router";
import { useProfileForm } from "#profile-form.ts";
import { useSession } from "@template/ui";

const route = getRouteApi("/");

function ProfilePage(): ReactElement {
  const { session, loading, error: sessionError } = useSession();
  const form = useProfileForm(route.useLoaderData());
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
