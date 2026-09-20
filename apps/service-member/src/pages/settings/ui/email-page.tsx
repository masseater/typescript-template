import { EmailChangeForm } from "@repo/auth-ui";
import { Page } from "@repo/ui";

import type { Session } from "#entities/session/index.ts";
import type { ReactElement } from "react";

function EmailPage({ session }: Readonly<{ session: Session }>): ReactElement {
  return (
    <Page title="メールアドレスの変更">
      <EmailChangeForm securityHref="/settings/security" session={session} />
    </Page>
  );
}

export { EmailPage };
