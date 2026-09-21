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
const runtime = workerRuntime(() => {
  const base = appLayer(env, service, routes);
  return Layer.mergeAll(base, memberRequirementLayer(env).pipe(Layer.provide(base)));
});

export { reporting, runtime };
