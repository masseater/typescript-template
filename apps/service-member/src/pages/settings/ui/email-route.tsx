import { getRouteApi } from "@tanstack/react-router";

import { EmailPage } from "./email-page.tsx";

import type { ReactElement } from "react";

const route = getRouteApi("/_member/settings/email");

function EmailRoute(): ReactElement {
  const { session } = route.useRouteContext();
  return <EmailPage session={session} />;
}

export { EmailRoute };
