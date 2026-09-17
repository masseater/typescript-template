import { createAppWorker } from "@template/runtime/worker";
import handler from "@tanstack/react-start/server-entry";
import { routes } from "#telemetry-routes.ts";

const worker = createAppWorker({ audience: "admin", handler, routes });

// oxlint-disable-next-line import/no-default-export
export default worker;
