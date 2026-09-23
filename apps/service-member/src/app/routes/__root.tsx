import { LocalizedAppShell, appHead } from "@repo/ui/shell";
import { createRootRoute } from "@tanstack/react-router";

import styles from "#app/styles.css?url";
import { serviceName } from "#shared/config/index.ts";
import { fieldValidationMessages, getLocale } from "#shared/i18n/index.ts";
import { routes } from "#shared/telemetry/index.ts";

import type { ReactElement } from "react";

const Route = createRootRoute({
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
