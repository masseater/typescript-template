import type { ReactElement } from "react";

import { MFASettings } from "./mfa";
import { Page } from "./shared/ui/page";
import { Status } from "./shared/ui/status";
import { SignOutButton } from "./sign-out-button";
import { useSession } from "./use-session";

function SecurityPage({
  signedOutPath,
  title,
}: Readonly<{ signedOutPath?: string; title: string }>): ReactElement {
  const { session, loading, error } = useSession();
  return (
    <Page title={title}>
      {loading && <Status variant="pending">読み込み中です。</Status>}
      {!loading && session && (
        <>
          <MFASettings session={session} />
          <SignOutButton destination={signedOutPath} />
        </>
      )}
      {!loading && !session && <a href="/login">ログインしてください。</a>}
      {(error ?? "") !== "" && <Status variant="error">{error}</Status>}
    </Page>
  );
}

export { SecurityPage };
