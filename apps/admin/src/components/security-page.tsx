import { MFASettings, SignOutButton } from "@template/ui/auth";
import { Page, Status, useSession } from "@template/ui";
import type { ReactElement } from "react";

function SecurityPage(): ReactElement {
  const { session, loading, error } = useSession();
  return (
    <Page title="管理者の認証設定">
      {loading && <Status>読み込み中です。</Status>}
      {!loading && session && (
        <>
          <MFASettings session={session} />
          <SignOutButton />
        </>
      )}
      {!loading && !session && <a href="/login">ログインしてください。</a>}
      {(error ?? "") !== "" && <Status error>{error}</Status>}
    </Page>
  );
}

export { SecurityPage };
