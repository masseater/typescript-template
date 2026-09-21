import { APPLICATION } from "@repo/config";
import { appLayer } from "@repo/runtime/bindings";
import { workerRuntime } from "@repo/runtime/worker";
import { env } from "cloudflare:workers";
import { Layer } from "effect";

import { routes } from "#shared/telemetry/index.ts";
import { memberRequirementLayer } from "./member-requirement-layer.ts";

import type { Reporting } from "@repo/observability";

const service = APPLICATION.user;
const reporting: Reporting = { service };
const runtime = workerRuntime(() =>
  Layer.mergeAll(appLayer(env, service, routes), memberRequirementLayer(env)),
);

export { reporting, runtime };
