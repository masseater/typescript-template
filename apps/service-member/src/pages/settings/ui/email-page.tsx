import { EmailChangeForm, type SessionView } from "@repo/auth-ui";
import { Page } from "@repo/ui";

import type { ReactElement } from "react";

function EmailPage({ session }: Readonly<{ session: SessionView }>): ReactElement {
  return (
    <Page title="メールアドレスの変更">
      <EmailChangeForm securityHref="/settings/security" session={session} />
    </Page>
  );
}

export { EmailPage };
