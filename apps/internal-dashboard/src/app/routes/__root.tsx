import { FieldValidationMessageProvider, ToastProvider } from "@repo/ui";
import { AppShell, appHead } from "@repo/ui/shell";
import { createRootRoute } from "@tanstack/react-router";

import styles from "#app/styles.css?url";
import { serviceName } from "#shared/config/index.ts";
import { fieldValidationMessages } from "#shared/i18n/index.ts";
import { routes } from "#shared/telemetry/index.ts";
import { WikiProvider } from "./-wiki-provider.tsx";

import type { ReactElement } from "react";

const Route = createRootRoute({
  component: (): ReactElement => (
    <AppShell routes={routes} themedDocument>
      <FieldValidationMessageProvider messages={fieldValidationMessages}>
        <ToastProvider>
          <WikiProvider />
        </ToastProvider>
      </FieldValidationMessageProvider>
    </AppShell>
  ),
  head: () => appHead(serviceName, styles),
});

export { Route };
