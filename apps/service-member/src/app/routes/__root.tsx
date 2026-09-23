import { TanStackDevtools } from "@tanstack/react-devtools";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";

import styles from "#app/styles.css?url";
import { MemberShell, memberAppHead, memberMeasurementId } from "#shared/analytics/index.ts";
import { serviceName } from "#shared/config/index.ts";
import { fieldValidationMessages, getLocale } from "#shared/i18n/index.ts";
import { routes } from "#shared/telemetry/index.ts";

import type { QueryClient } from "@tanstack/react-query";
import type { ReactElement } from "react";

const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: (): ReactElement => {
    const locale = getLocale();
    return (
      <MemberShell
        fieldValidationMessages={fieldValidationMessages(locale)}
        lang={locale}
        routes={routes}
      >
        <Outlet />
        <TanStackDevtools
          plugins={[{ name: "TanStack Query", render: <ReactQueryDevtoolsPanel /> }]}
        />
      </MemberShell>
    );
  },
  head: () => memberAppHead(serviceName, styles, memberMeasurementId()),
});

export { Route };
