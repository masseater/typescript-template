import { Layer, ManagedRuntime } from "effect";
import { Interviewer } from "@template/interview";
import { appLayer } from "@template/runtime";
import { env } from "cloudflare:workers";
import { routes } from "./telemetry-routes.ts";

const runtime = ManagedRuntime.make(
  Layer.merge(appLayer(env, "user", routes), Interviewer.fromEnvironment(env)),
);

export { runtime };
