import { LoginPage } from "#pages/login/index.ts";
import type { ReactElement } from "react";
import { getRouteApi } from "@tanstack/react-router";

const route = getRouteApi("/_public/login");

function LoginRoute(): ReactElement {
  const { redirect } = route.useSearch();
  return <LoginPage destination={redirect ?? "/"} />;
}

export { LoginRoute };
