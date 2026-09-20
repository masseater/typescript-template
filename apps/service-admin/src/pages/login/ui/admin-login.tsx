import { redirectTarget } from "@repo/auth-ui";
import { LoginPage } from "@repo/auth-ui";
import { useLocation } from "@tanstack/react-router";

import type { ReactElement } from "react";

function AdminLogin(): ReactElement {
  const { searchStr } = useLocation();
  function goToRedirect(): void {
    const target = redirectTarget(new URLSearchParams(searchStr).get("redirect"));
    globalThis.location.assign(target === "/" ? "/members" : target);
  }
  return <LoginPage title="管理者ログイン" signUp={false} onAuthenticated={goToRedirect} />;
}

export { AdminLogin };
