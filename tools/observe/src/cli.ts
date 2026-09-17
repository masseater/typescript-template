import { parseArgs } from "node:util";
import * as v from "valibot";
import { queryExplorer, requestTelemetry, structuredMessage } from "./explorer.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    app: { type: "string", default: "http://127.0.0.1:3001/" },
    minutes: { type: "string", default: "15" },
    limit: { type: "string", default: "100" },
    level: { type: "string" },
    "request-id": { type: "string" },
    "trace-id": { type: "string" },
    help: { type: "boolean", default: false },
  },
});

if (values.help) {
  console.info(
    JSON.stringify({
      commands: ["logs", "traces", "trace", "request"],
      flags: ["--app", "--minutes", "--limit", "--level", "--request-id", "--trace-id"],
      source: "Cloudflare Local Explorer of the running app",
      readOnly: true,
    }),
  );
} else {
  try {
    const input = v.parse(
      v.object({
        command: v.picklist(["logs", "traces", "trace", "request"]),
        minutes: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(1440)),
        limit: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(500)),
        level: v.optional(v.picklist(["debug", "info", "log", "warn", "error"])),
        requestId: v.optional(v.string()),
        traceId: v.optional(v.pipe(v.string(), v.regex(/^[0-9a-f]{32}$/))),
      }),
      {
        command: positionals[0],
        minutes: Number(values.minutes),
        limit: Number(values.limit),
        level: values.level,
        requestId: values["request-id"],
        traceId: values["trace-id"],
      },
    );
    if (positionals.length !== 1) throw new Error("Specify one query command");
    const since = Date.now() - input.minutes * 60_000;
    const data =
      input.command === "request"
        ? await requestTelemetry(values.app, v.parse(v.string(), input.requestId))
        : input.command === "trace"
          ? await queryExplorer(
              values.app,
              "SELECT trace_id, span_id, parent_id, service, name, kind, start_ms, duration_ms, outcome, error, json(attributes) AS attributes FROM spans WHERE trace_id = ? ORDER BY start_ms LIMIT 2000",
              [v.parse(v.string(), input.traceId)],
            )
          : input.command === "traces"
            ? await queryExplorer(
                values.app,
                "SELECT trace_id, service, name, start_ms, duration_ms, outcome, error, json(attributes) AS attributes FROM spans WHERE parent_id IS NULL AND start_ms >= ? ORDER BY start_ms DESC LIMIT ?",
                [since, input.limit],
              )
            : (
                await queryExplorer(
                  values.app,
                  `SELECT trace_id, span_id, ts_ms, level, message FROM logs WHERE ts_ms >= ?${input.level ? " AND level = ?" : ""} ORDER BY ts_ms DESC LIMIT ?`,
                  input.level ? [since, input.level, input.limit] : [since, input.limit],
                )
              ).map(({ message, ...row }) => ({
                ...row,
                event: structuredMessage(message) ?? null,
              }));
    console.info(
      JSON.stringify({
        ok: true,
        command: input.command,
        observedAt: new Date().toISOString(),
        data,
      }),
    );
  } catch {
    console.error(
      JSON.stringify({
        ok: false,
        event: "observability.query_failed",
        remediation:
          "Check arguments and that --app points at a running local app on a loopback origin. Use --help for read-only query commands.",
      }),
    );
    process.exitCode = 1;
  }
}
