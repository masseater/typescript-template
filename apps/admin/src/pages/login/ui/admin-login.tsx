import { useLocation } from "@tanstack/react-router";
import { redirectTarget } from "@template/ui";
import { LoginPage } from "@template/ui/auth";

import type { ReactElement } from "react";

const AdminLogin = (): ReactElement => {
  const { searchStr } = useLocation();
  const goToRedirect = (): void => {
    globalThis.location.assign(redirectTarget(new URLSearchParams(searchStr).get("redirect")));
  };
  return <LoginPage title="管理者ログイン" signUp={false} onAuthenticated={goToRedirect} />;
};

export { AdminLogin };
