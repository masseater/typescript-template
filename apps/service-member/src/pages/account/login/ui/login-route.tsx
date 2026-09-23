import { getRouteApi } from "@tanstack/react-router";

import { LoginPage } from "./login-page.tsx";

import type { ReactElement } from "react";

const route = getRouteApi("/_public/login");

function LoginRoute(): ReactElement {
  const { redirect } = route.useSearch();
  return <LoginPage destination={redirect ?? "/"} />;
}

export { LoginRoute };
