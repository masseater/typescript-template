import { createFileRoute } from "@tanstack/react-router";
import { Page, Status, useSession } from "@template/ui";
import { MFASettings, SignOutButton } from "@template/ui/auth";

export const Route = createFileRoute("/security")({ component: Security });
function Security() {
  const { session, loading, error } = useSession();
  return (
    <Page title="管理者の認証設定">
      {loading ? (
        <Status>読み込み中です。</Status>
      ) : session ? (
        <>
          <MFASettings session={session} />
          <SignOutButton />
        </>
      ) : (
        <a href="/login">ログインしてください。</a>
      )}
      {error && <Status error>{error}</Status>}
    </Page>
  );
}
