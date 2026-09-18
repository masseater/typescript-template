import { beginProcessSpan, endProcessSpan } from "./process-span.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { isMainThread } from "node:worker_threads";

const parameters = new URL(import.meta.url).searchParams;
const directory = parameters.get("run");
const endpoint = parameters.get("endpoint");
const workerdSdk = parameters.get("workerd");
const microsecondsPerMillisecond = 1000;

const span =
  directory === null || endpoint === null || workerdSdk === null || !isMainThread
    ? undefined
    : await beginProcessSpan({
        directory,
        // oxlint-disable-next-line node/no-process-env
        inherited: process.env["TRACEPARENT"],
        pid: process.pid,
        ppid: process.ppid,
      });

if (span !== undefined) {
  // oxlint-disable-next-line node/no-process-env
  Object.assign(process.env, {
    OTEL_EXPORTER_OTLP_ENDPOINT: endpoint,
    PERF_TRACE_DIRECTORY: directory,
    PERF_WORKERD_SDK: workerdSdk,
    TRACEPARENT: span.traceparent,
  });
  process.once("exit", (code) => {
    const cpu = process.cpuUsage();
    endProcessSpan(span, {
      argv: process.argv,
      cpuSystemMilliseconds: cpu.system / microsecondsPerMillisecond,
      cpuUserMilliseconds: cpu.user / microsecondsPerMillisecond,
      cwd: process.cwd(),
      endMilliseconds: performance.timeOrigin + performance.now(),
      exitCode: code,
      maxRssKilobytes: process.resourceUsage().maxRSS,
      startMilliseconds: performance.timeOrigin,
    });
  });
}
