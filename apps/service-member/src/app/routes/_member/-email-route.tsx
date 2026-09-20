import { getRouteApi } from "@tanstack/react-router";

import { EmailPage } from "#pages/settings/index.ts";

import type { ReactElement } from "react";

const route = getRouteApi("/_member/settings/email");

function EmailRoute(): ReactElement {
  const { session } = route.useRouteContext();
  return <EmailPage session={session} />;
}

export { EmailRoute };
