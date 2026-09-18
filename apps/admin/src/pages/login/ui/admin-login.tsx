import { useLocation } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { redirectTarget } from "@repo/ui";
import { LoginPage } from "@repo/ui/auth";

function AdminLogin(): ReactElement {
  const { searchStr } = useLocation();
  function goToRedirect(): void {
    globalThis.location.assign(redirectTarget(new URLSearchParams(searchStr).get("redirect")));
  }
  return <LoginPage title="管理者ログイン" signUp={false} onAuthenticated={goToRedirect} />;
}

export { AdminLogin };
