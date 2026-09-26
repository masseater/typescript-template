import { japaneseFieldValidationMessages } from "@repo/ui";
import { AppShell, appHead } from "@repo/ui/shell";
import { createRootRouteWithContext } from "@tanstack/react-router";

import styles from "#app/styles.css?url";
import { productName } from "#shared/config/index.ts";
import { routes } from "#shared/telemetry/index.ts";
import { WikiProvider } from "./-wiki-provider.tsx";

import type { QueryClient } from "@tanstack/react-query";
import type { ReactElement } from "react";

const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: (): ReactElement => (
    <AppShell
      fieldValidationMessages={japaneseFieldValidationMessages}
      routes={routes}
      themedDocument
    >
      <WikiProvider />
    </AppShell>
  ),
  head: () => appHead(productName, styles),
});

export { Route };
