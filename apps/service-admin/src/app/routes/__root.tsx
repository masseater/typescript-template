import { LocalizedAppShell, appHead } from "@repo/ui/shell";
import { createRootRouteWithContext } from "@tanstack/react-router";

import styles from "#app/styles.css?url";
import { serviceName } from "#shared/config/index.ts";
import { fieldValidationMessages, getLocale } from "#shared/i18n/index.ts";
import { routes } from "#shared/telemetry/index.ts";

import type { QueryClient } from "@tanstack/react-query";
import type { ReactElement } from "react";

const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: (): ReactElement => (
    <LocalizedAppShell
      fieldValidationMessages={fieldValidationMessages}
      getLocale={getLocale}
      routes={routes}
    />
  ),
  head: () => appHead(serviceName, styles),
});

export { Route };
