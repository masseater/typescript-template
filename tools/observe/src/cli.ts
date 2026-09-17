import {
  integer,
  maxValue,
  minValue,
  number,
  object,
  optional,
  parse,
  picklist,
  pipe,
  regex,
  string,
} from "valibot";
import { queryExplorer, requestTelemetry, withEvent } from "./explorer.ts";
import type { InferOutput } from "valibot";
// oxlint-disable-next-line import/no-nodejs-modules
import { parseArgs } from "node:util";

const commands = ["logs", "traces", "trace", "request"] as const;
const minutesPerDay = 1440;
const maxQueryLimit = 500;
const millisecondsPerMinute = 60_000;

const traceIdSchema = pipe(string(), regex(/^[0-9a-f]{32}$/u));
const inputSchema = object({
  command: picklist(commands),
  level: optional(picklist(["debug", "info", "log", "warn", "error"])),
  limit: pipe(number(), integer(), minValue(1), maxValue(maxQueryLimit)),
  minutes: pipe(number(), integer(), minValue(1), maxValue(minutesPerDay)),
  requestId: optional(string()),
  traceId: optional(traceIdSchema),
});

type QueryInput = InferOutput<typeof inputSchema>;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    app: { default: "http://127.0.0.1:3001/", type: "string" },
    help: { default: false, type: "boolean" },
    level: { type: "string" },
    limit: { default: "100", type: "string" },
    minutes: { default: "15", type: "string" },
    "request-id": { type: "string" },
    "trace-id": { type: "string" },
  },
});

async function queryLogs(app: string, input: QueryInput, since: number): Promise<unknown> {
  const levelFilter = input.level === undefined ? "" : " AND level = ?";
  const params =
    input.level === undefined ? [since, input.limit] : [since, input.level, input.limit];
  const rows = await queryExplorer(
    app,
    `SELECT trace_id, span_id, ts_ms, level, message FROM logs WHERE ts_ms >= ?${levelFilter} ORDER BY ts_ms DESC LIMIT ?`,
    params,
  );
  return rows.map((row: Readonly<Record<string, unknown>>) => withEvent(row));
}

async function runQuery(app: string, input: QueryInput): Promise<unknown> {
  const since = Date.now() - input.minutes * millisecondsPerMinute;
  if (input.command === "request") {
    return requestTelemetry(app, parse(string(), input.requestId));
  }
  if (input.command === "trace") {
    return queryExplorer(
      app,
      "SELECT trace_id, span_id, parent_id, service, name, kind, start_ms, duration_ms, outcome, error, json(attributes) AS attributes FROM spans WHERE trace_id = ? ORDER BY start_ms LIMIT 2000",
      [parse(string(), input.traceId)],
    );
  }
  if (input.command === "traces") {
    return queryExplorer(
      app,
      "SELECT trace_id, service, name, start_ms, duration_ms, outcome, error, json(attributes) AS attributes FROM spans WHERE parent_id IS NULL AND start_ms >= ? ORDER BY start_ms DESC LIMIT ?",
      [since, input.limit],
    );
  }
  return queryLogs(app, input, since);
}

if (values.help) {
  process.stdout.write(
    `${JSON.stringify({
      commands,
      flags: ["--app", "--minutes", "--limit", "--level", "--request-id", "--trace-id"],
      readOnly: true,
      source: "Cloudflare Local Explorer of the running app",
    })}\n`,
  );
} else {
  try {
    const input = parse(inputSchema, {
      command: positionals[0],
      level: values.level,
      limit: Number(values.limit),
      minutes: Number(values.minutes),
      requestId: values["request-id"],
      traceId: values["trace-id"],
    });
    if (positionals.length !== 1) {
      throw new Error("Specify one query command");
    }
    const data = await runQuery(values.app, input);
    process.stdout.write(
      `${JSON.stringify({
        command: input.command,
        data,
        observedAt: new Date().toISOString(),
        ok: true,
      })}\n`,
    );
  } catch {
    process.stderr.write(
      `${JSON.stringify({
        event: "observability.query_failed",
        ok: false,
        remediation:
          "Check arguments and that --app points at a running local app on a loopback origin. Use --help for read-only query commands.",
      })}\n`,
    );
    process.exitCode = 1;
  }
}
