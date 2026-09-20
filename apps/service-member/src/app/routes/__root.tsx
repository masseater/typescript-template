import { Outlet, createRootRoute } from "@tanstack/react-router";

import styles from "#app/styles.css?url";
import { MemberShell, memberAppHead, memberMeasurementId } from "#shared/analytics/index.ts";
import { serviceName } from "#shared/config/index.ts";
import { routes } from "#shared/telemetry/index.ts";

import type { ReactElement } from "react";

const Route = createRootRoute({
  component: (): ReactElement => (
    <MemberShell routes={routes}>
      <Outlet />
    </MemberShell>
  ),
  head: () => memberAppHead(serviceName, styles, memberMeasurementId()),
});

export { Route };
