import { InviteAcceptance, type Invitation } from "@repo/auth-ui";
import { Page } from "@repo/ui";

import type { ReactElement } from "react";

function InvitePage({
  invitation,
  token,
}: Readonly<{ invitation: Invitation; token: string }>): ReactElement {
  return (
    <Page title="招待を受ける">
      <InviteAcceptance endpoint="/api/invite" invitation={invitation} token={token} />
    </Page>
  );
}

export { InvitePage };
