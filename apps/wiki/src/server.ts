import { ManagedRuntime } from "effect";
import { env } from "cloudflare:workers";
import { routes } from "./telemetry-routes.ts";
import { serveApp } from "@template/runtime/worker";
import { wikiLayer } from "@template/runtime/wiki";
import { wikiRoute } from "./routing.ts";

const runtime = ManagedRuntime.make(wikiLayer(env, routes));

// oxlint-disable-next-line import/no-default-export
export default serveApp(runtime, wikiRoute);
