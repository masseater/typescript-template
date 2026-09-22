import { ButtonLink, NavigationLink } from "@repo/ui";
import { useLocation } from "@tanstack/react-router";

import { serviceName } from "#shared/config/index.ts";
import { m } from "#shared/i18n/index.ts";
import { LocaleSwitch } from "#shared/ui/locale-switch.tsx";
import { publicContentTrack } from "../model/public-content-track.ts";

import type { ReactElement } from "react";

function PublicHeader(): ReactElement {
  const { pathname } = useLocation();
  const track = publicContentTrack(pathname);
  return (
    <header className="w-full border-b border-border bg-card shadow-sm">
      <div className={`mx-auto flex w-full ${track} flex-wrap items-center gap-2 px-4 py-3`}>
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
      </div>
    </header>
  );
}

export { PublicHeader };
