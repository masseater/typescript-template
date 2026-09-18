import { beginProcessSpan, endProcessSpan } from "./process-span.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { isMainThread } from "node:worker_threads";

const parameters = new URL(import.meta.url).searchParams;
const directory = parameters.get("run");
const endpoint = parameters.get("endpoint");
const microsecondsPerMillisecond = 1000;

const span =
  directory === null || !isMainThread
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
  process.env["TRACEPARENT"] = span.traceparent;
  if (endpoint !== null) {
    // oxlint-disable-next-line node/no-process-env
    process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] = endpoint;
  }
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
