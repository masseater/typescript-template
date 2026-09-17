import { createFileRoute } from "@tanstack/react-router";
import { Page, Status, UIProvider, useSession } from "@template/ui";
import { MFASettings, SignOutButton } from "@template/ui/auth";
import uiStyles from "@template/ui/styles.css?url";

export const Route = createFileRoute("/security")({
  head: () => ({ links: [{ rel: "stylesheet", href: uiStyles }] }),
  component: Security,
});

function Security() {
  return (
    <UIProvider>
      <Page title="Wiki の認証設定">
        <SecuritySettings />
      </Page>
    </UIProvider>
  );
}

function SecuritySettings() {
  const { session, loading, error } = useSession();
  if (loading) return <Status>読み込み中です。</Status>;
  if (error) return <Status error>{error}</Status>;
  if (!session) return <a href="/login">ログインしてください。</a>;
  return (
    <>
      <MFASettings session={session} />
      <SignOutButton />
    </>
  );
}
