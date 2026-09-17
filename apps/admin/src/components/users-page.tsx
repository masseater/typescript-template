import { Page, Status } from "@template/ui/ui";
import type { ReactElement } from "react";
import { SignOutButton } from "@template/ui/auth";
import { UserDirectory } from "#components/user-directory.tsx";
import { useSession } from "@template/ui";
import { useUserManagement } from "#user-management.ts";

function UsersPage(): ReactElement {
  const { session, loading, error: sessionError } = useSession();
  const authorized = session?.strong === true && session.user.role === "admin";
  const management = useUserManagement(authorized);
  const shownError = management.error === "" ? sessionError : management.error;
  return (
    <Page title="ユーザー管理">
      {loading && <Status variant="pending">読み込み中です。</Status>}
      {!loading && !session && <a href="/login">管理者ログインへ</a>}
      {session && !authorized && <a href="/security">追加認証を完了してください。</a>}
      {authorized && management.data && (
        <UserDirectory list={management.data} management={management} />
      )}
      {session && <SignOutButton />}
      {management.message !== "" && <Status variant="success">{management.message}</Status>}
      {(shownError ?? "") !== "" && <Status variant="error">{shownError}</Status>}
    </Page>
  );
}

export { UsersPage };
