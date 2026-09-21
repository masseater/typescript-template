import { FieldValidationMessageProvider } from "@repo/ui";
import { Outlet, createRootRoute } from "@tanstack/react-router";

import styles from "#app/styles.css?url";
import { MemberShell, memberAppHead, memberMeasurementId } from "#shared/analytics/index.ts";
import { serviceName } from "#shared/config/index.ts";
import { fieldValidationMessages, getLocale } from "#shared/i18n/index.ts";
import { routes } from "#shared/telemetry/index.ts";

import type { ReactElement } from "react";

const Route = createRootRoute({
  component: (): ReactElement => {
    const locale = getLocale();
    return (
      <MemberShell lang={locale} routes={routes}>
        <FieldValidationMessageProvider messages={fieldValidationMessages(locale)}>
          <Outlet />
        </FieldValidationMessageProvider>
      </MemberShell>
    );
  },
  head: () => memberAppHead(serviceName, styles, memberMeasurementId()),
});

export { Route };
