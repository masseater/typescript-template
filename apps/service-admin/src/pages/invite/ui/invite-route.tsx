import { getRouteApi } from "@tanstack/react-router";

import { InvitePage } from "./invite-page.tsx";

import type { ReactElement } from "react";

const route = getRouteApi("/_public/invite/$token");

function InviteRoute(): ReactElement {
  const { token } = route.useParams();
  const invitation = route.useLoaderData();
  return <InvitePage token={token} invitation={invitation} />;
}

export { InviteRoute };
