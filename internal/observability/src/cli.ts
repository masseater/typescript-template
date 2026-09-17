import { parseArgs } from "node:util";
import * as v from "valibot";
import { queryGrafana, queryPath } from "./query.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    grafana: { type: "string", default: "http://127.0.0.1:3100" },
    service: { type: "string", default: "user-server" },
    minutes: { type: "string", default: "15" },
    limit: { type: "string", default: "100" },
    severity: { type: "string" },
    "request-id": { type: "string" },
    "trace-id": { type: "string" },
    expression: { type: "string" },
    help: { type: "boolean", default: false },
  },
});

if (values.help) {
  console.info(
    JSON.stringify({
      commands: ["doctor", "logs", "metrics", "exemplars", "traces", "trace"],
      flags: [
        "--grafana",
        "--service",
        "--minutes",
        "--limit",
        "--severity",
        "--request-id",
        "--trace-id",
        "--expression",
      ],
      readOnly: true,
    }),
  );
} else {
  try {
    const schema = v.object({
      command: v.picklist(["doctor", "logs", "metrics", "exemplars", "traces", "trace"]),
      service: v.picklist(["user-server", "user-browser", "admin-server", "admin-browser"]),
      minutes: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(1440)),
      limit: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(500)),
    });
    const parsed = v.parse(schema, {
      command: positionals[0],
      service: values.service,
      minutes: Number(values.minutes),
      limit: Number(values.limit),
    });
    if (positionals.length !== 1) throw new Error("Specify one query command");
    const severity =
      values.severity === undefined
        ? undefined
        : v.parse(v.picklist(["INFO", "ERROR"]), values.severity);
    const input = {
      ...parsed,
      ...(severity ? { severity } : {}),
      ...(values["request-id"] ? { requestId: values["request-id"] } : {}),
      ...(values["trace-id"] ? { traceId: values["trace-id"] } : {}),
      ...(values.expression ? { expression: values.expression } : {}),
    };
    const data = await queryGrafana(values.grafana, queryPath(input, Date.now()));
    console.info(
      JSON.stringify({
        ok: true,
        command: parsed.command,
        service: parsed.service,
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
          "Check arguments, LGTM health and datasource availability. Use --help for read-only query commands.",
      }),
    );
    process.exitCode = 1;
  }
}
