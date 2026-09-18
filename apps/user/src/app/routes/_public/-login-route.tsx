import { getRouteApi } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { LoginPage } from "#pages/login/index.ts";

const route = getRouteApi("/_public/login");

function LoginRoute(): ReactElement {
  const { redirect } = route.useSearch();
  return <LoginPage destination={redirect ?? "/"} />;
}

export { LoginRoute };
