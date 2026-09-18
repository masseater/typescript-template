import { serveWorker, startRoute } from "@repo/runtime/worker";
import handler from "@tanstack/react-start/server-entry";
import { Effect } from "effect";
import { noop } from "es-toolkit";

import { reporting, runtime } from "#shared/server-api/index.ts";

const worker = serveWorker(runtime, startRoute(handler), reporting);
const background = {
  passThroughOnException: noop,
  props: {},
  waitUntil: (work: Promise<unknown>): void => {
    void work;
  },
};
const server = {
  fetch: async (request: Request): Promise<Response> =>
    worker.fetch(request, undefined, background),
};

async function ready(): Promise<void> {
  await runtime.runPromise(Effect.void);
}

async function dispose(): Promise<void> {
  await runtime.dispose();
}

export { dispose, ready };
// oxlint-disable-next-line import/no-default-export
export default server;
