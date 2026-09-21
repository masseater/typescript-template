import { APPLICATION } from "@repo/config";
import { appLayer } from "@repo/runtime/bindings";
import { workerRuntime } from "@repo/runtime/worker";
import { env } from "cloudflare:workers";

import { routes } from "#shared/telemetry/index.ts";

import type { Reporting } from "@repo/observability";

const service = APPLICATION.admin;
const reporting: Reporting = { service };
const runtime = workerRuntime(() => appLayer({ env: env, audience: service, routes: routes }));

export { reporting, runtime };
