import { InviteAcceptance } from "@repo/auth-ui";
import { Page } from "@repo/ui";

import type { ReactElement } from "react";

function InvitePage({ token }: Readonly<{ token: string }>): ReactElement {
  return (
    <Page title="招待を受ける">
      <InviteAcceptance token={token} />
    </Page>
  );
}

export { InvitePage };
