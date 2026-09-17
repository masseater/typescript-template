import handler from "@tanstack/react-start/server-entry";
import { createAppWorker } from "@template/runtime/worker";
import { routes } from "./telemetry-routes.ts";

export default createAppWorker({ audience: "user", routes, handler });
