import { Outlet } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { RootProvider } from "fumadocs-ui/provider/tanstack";
import { translations } from "#/lib/translations.ts";

const i18n = { locale: "ja", translations };

function WikiProvider(): ReactElement {
  return (
    <RootProvider i18n={i18n}>
      <Outlet />
    </RootProvider>
  );
}

export { WikiProvider };
