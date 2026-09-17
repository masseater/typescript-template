import { Outlet } from "@tanstack/react-router";
import type { ReactElement } from "react";

function PublicFrame(): ReactElement {
  return (
    <div className="flex min-h-screen flex-col items-center gap-4 px-4 py-12">
      <p className="text-lg leading-tight font-bold text-foreground">管理画面</p>
      <div className="w-full max-w-md rounded-lg border border-border bg-card shadow-sm">
        <Outlet />
      </div>
    </div>
  );
}

export { PublicFrame };
