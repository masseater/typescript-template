import { Outlet, useRouter } from "@tanstack/react-router";
import { RootProvider } from "fumadocs-ui/provider/tanstack";

import { translations } from "#shared/i18n/index.ts";

import type { ReactElement } from "react";

const i18n = { locale: "ja", translations };

function WikiProvider(): ReactElement {
  const nonce = useRouter().options.ssr?.nonce;
  return (
    <RootProvider i18n={i18n} theme={nonce === undefined ? {} : { nonce }}>
      <Outlet />
    </RootProvider>
  );
}

export { WikiProvider };
