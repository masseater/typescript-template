import { getRouteApi } from "@tanstack/react-router";

import { LoginPage } from "#pages/login/index.ts";

import type { ReactElement } from "react";

const route = getRouteApi("/_public/login");

const LoginRoute = (): ReactElement => {
  const { redirect } = route.useSearch();
  return <LoginPage destination={redirect ?? "/"} />;
};

export { LoginRoute };
