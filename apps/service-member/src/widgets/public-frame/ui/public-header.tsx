import { ButtonLink, NavigationLink } from "@repo/ui";
import { useLocation } from "@tanstack/react-router";

import { serviceName } from "#shared/config/index.ts";
import { m } from "#shared/i18n/index.ts";
import { LocaleSwitch } from "#shared/ui/locale-switch.tsx";

import type { ReactElement } from "react";

function PublicHeader(): ReactElement {
  const { pathname } = useLocation();
  return (
    <header className="flex w-full flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-3 shadow-sm">
      <div className="mr-auto">
        <NavigationLink to="/" variant="brand">
          {serviceName}
        </NavigationLink>
      </div>
      <LocaleSwitch />
      {pathname !== "/login" && <ButtonLink to="/login">{m.login_link()}</ButtonLink>}
      {pathname !== "/signup" && (
        <ButtonLink to="/signup" variant="primary">
          {m.signup_link()}
        </ButtonLink>
      )}
    </header>
  );
}

export { PublicHeader };
