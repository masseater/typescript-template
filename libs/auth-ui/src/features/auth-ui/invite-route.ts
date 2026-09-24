import { createElement, type ReactElement } from "react";

import { InvitePage } from "./invite-page.tsx";
import { type Invitation } from "./invite-preview.ts";

const inviteRoute = (
  route: Readonly<{
    useLoaderData: () => Invitation;
    useParams: () => Readonly<{ token: string }>;
  }>,
): (() => ReactElement) => {
  const InviteRoute = (): ReactElement =>
    createElement(InvitePage, {
      invitation: route.useLoaderData(),
      token: route.useParams().token,
    });
  return InviteRoute;
};

export { inviteRoute };
