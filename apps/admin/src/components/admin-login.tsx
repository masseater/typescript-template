import { LoginPage } from "@template/ui/auth";
import type { ReactElement } from "react";
import { redirectTarget } from "@template/ui";
import { useCallback } from "react";
import { useLocation } from "@tanstack/react-router";

function AdminLogin(): ReactElement {
  const { searchStr } = useLocation();
  const goToRedirect = useCallback(() => {
    globalThis.location.assign(redirectTarget(new URLSearchParams(searchStr).get("redirect")));
  }, [searchStr]);
  return <LoginPage title="管理者ログイン" signUp={false} onAuthenticated={goToRedirect} />;
}

export { AdminLogin };
