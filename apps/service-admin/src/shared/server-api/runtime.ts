import { APPLICATION } from "@repo/config";
import { appLayer } from "@repo/runtime";
import { workerRuntime } from "@repo/runtime/worker";
import { env } from "cloudflare:workers";

import { routes } from "#shared/telemetry/index.ts";

import type { Reporting } from "@repo/observability";

const service = APPLICATION.admin;
const reporting: Reporting = { service };
const runtime = workerRuntime(() => appLayer(env, service, routes));

export { reporting, runtime };
