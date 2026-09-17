import { ButtonLink, NavigationLink } from "@template/ui/ui";
import type { ReactElement } from "react";
import { serviceName } from "#shared/config/index.ts";
import { useLocation } from "@tanstack/react-router";

function PublicHeader(): ReactElement {
  const { pathname } = useLocation();
  return (
    <header className="flex w-full flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-3 shadow-sm">
      <div className="mr-auto">
        <NavigationLink to="/" variant="brand">
          {serviceName}
        </NavigationLink>
      </div>
      {pathname !== "/login" && <ButtonLink to="/login">ログイン</ButtonLink>}
      {pathname !== "/signup" && (
        <ButtonLink to="/signup" variant="primary">
          新規登録
        </ButtonLink>
      )}
    </header>
  );
}

export { PublicHeader };
