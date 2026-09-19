import { MFASettings } from "./mfa";
import { Page } from "./shared/ui/page";
import { StatusMessage } from "./shared/ui/status";
import { STATUS_VARIANT } from "./shared/ui/status-variants.ts";
import { SignOutButton } from "./sign-out-button";
import { useSession } from "./use-session";

import type { ReactElement } from "react";

const SecurityPage = ({
  signedOutPath,
  title,
}: Readonly<{ signedOutPath?: string; title: string }>): ReactElement => {
  const { session, loading, error } = useSession();
  return (
    <Page title={title}>
      {loading && <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>}
      {!loading && session && (
        <>
          <MFASettings session={session} />
          <SignOutButton destination={signedOutPath} />
        </>
      )}
      {!loading && !session && <a href="/login">ログインしてください。</a>}
      {error !== undefined && (
        <StatusMessage variant={STATUS_VARIANT.failure}>{error}</StatusMessage>
      )}
    </Page>
  );
};

export { SecurityPage };
