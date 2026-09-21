import { redirectTarget } from "@repo/auth-ui";
import { LoginPage } from "@repo/auth-ui";
import { useLocation } from "@tanstack/react-router";

import { m } from "#shared/i18n/index.ts";
import { LocaleSwitch } from "#shared/ui/locale-switch.tsx";

import type { ReactElement } from "react";

function AdminLogin(): ReactElement {
  const { searchStr } = useLocation();
  function goToRedirect(): void {
    const target = redirectTarget(new URLSearchParams(searchStr).get("redirect"));
    globalThis.location.assign(target === "/" ? "/members" : target);
  }
  return (
    <div className="flex flex-col items-center gap-4">
      <LocaleSwitch />
      <LoginPage title={m.admin_login_title()} signUp={false} onAuthenticated={goToRedirect} />
    </div>
  );
}

export { AdminLogin };
