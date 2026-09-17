import { Page, Status } from "./shared/ui";
import { MFASettings } from "./mfa";
import type { ReactElement } from "react";
import { SignOutButton } from "./sign-out-button";
import { useSession } from "./use-session";

function SecurityPage({ title }: Readonly<{ title: string }>): ReactElement {
  const { session, loading, error } = useSession();
  return (
    <Page title={title}>
      {loading && <Status variant="pending">読み込み中です。</Status>}
      {!loading && session && (
        <>
          <MFASettings session={session} />
          <SignOutButton />
        </>
      )}
      {!loading && !session && <a href="/login">ログインしてください。</a>}
      {(error ?? "") !== "" && <Status variant="error">{error}</Status>}
    </Page>
  );
}

export { SecurityPage };
