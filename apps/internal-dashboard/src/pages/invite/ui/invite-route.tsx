import { STATUS_VARIANT, StatusMessage } from "@repo/ui";
import { getRouteApi } from "@tanstack/react-router";

import { InvitePage } from "./invite-page.tsx";

import type { ReactElement } from "react";

const route = getRouteApi("/invite/$token");

function InvitePending(): ReactElement {
  return <StatusMessage variant={STATUS_VARIANT.pending}>招待を確認しています。</StatusMessage>;
}

function InviteRoute(): ReactElement {
  const { token } = route.useParams();
  const invitation = route.useLoaderData();
  return <InvitePage token={token} invitation={invitation} />;
}

export { InvitePending, InviteRoute };
