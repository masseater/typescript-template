import { wikiLayer, wikiService } from "@repo/runtime/wiki";
import { workerRuntime } from "@repo/runtime/worker";
import { env } from "cloudflare:workers";

import { routes } from "#shared/telemetry/index.ts";

import type { Reporting } from "@repo/observability";

const reporting: Reporting = { service: wikiService };
const runtime = workerRuntime(() => wikiLayer(env, routes));

export { reporting, runtime };
