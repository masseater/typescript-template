import { Outlet, useRouter } from "@tanstack/react-router";
import { RootProvider } from "fumadocs-ui/provider/tanstack";

import { translations } from "#shared/i18n/index.ts";
import { WikiSearchDialog } from "#shared/ui/wiki-search-dialog.tsx";

import type { ReactElement } from "react";

const i18n = { locale: "ja", translations };

function WikiProvider(): ReactElement {
  const nonce = useRouter().options.ssr?.nonce;
  return (
    <RootProvider
      i18n={i18n}
      search={{ SearchDialog: WikiSearchDialog }}
      theme={nonce === undefined ? {} : { nonce }}
    >
      <Outlet />
    </RootProvider>
  );
}

export { WikiProvider };
