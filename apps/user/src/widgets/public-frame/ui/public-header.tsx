import { Link, useLocation } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { buttonVariants } from "@template/ui/ui";
import { serviceName } from "#shared/config/index.ts";

function PublicHeader(): ReactElement {
  const { pathname } = useLocation();
  return (
    <header className="flex w-full flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-3 shadow-sm">
      <Link to="/" className="mr-auto text-lg leading-tight font-bold text-foreground no-underline">
        {serviceName}
      </Link>
      {pathname !== "/login" && (
        <Link to="/login" className={buttonVariants({ variant: "secondary" })}>
          ログイン
        </Link>
      )}
      {pathname !== "/signup" && (
        <Link to="/signup" className={buttonVariants({ variant: "primary" })}>
          新規登録
        </Link>
      )}
    </header>
  );
}

export { PublicHeader };
