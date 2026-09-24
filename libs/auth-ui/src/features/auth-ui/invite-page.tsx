import { Page } from "@repo/ui";
import { type ReactElement } from "react";

import { InviteAcceptance } from "./invite-acceptance.tsx";
import { type Invitation } from "./invite-preview.ts";

const InvitePage = ({
  invitation,
  token,
}: Readonly<{ invitation: Invitation; token: string }>): ReactElement => (
  <Page title="招待を受ける">
    <InviteAcceptance endpoint="/api/invite" invitation={invitation} token={token} />
  </Page>
);

export { InvitePage };
