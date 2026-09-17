import {
  commands,
  maxQueryLimit,
  minutesPerDay,
  queryGrafana,
  queryPath,
  services,
  severities,
} from "./query.ts";
import { integer, maxValue, minValue, number, object, parse, picklist, pipe } from "valibot";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    expression: { type: "string" },
    grafana: { default: "http://127.0.0.1:3100", type: "string" },
    help: { default: false, type: "boolean" },
    limit: { default: "100", type: "string" },
    minutes: { default: "15", type: "string" },
    "request-id": { type: "string" },
    service: { default: "user-server", type: "string" },
    severity: { type: "string" },
    "trace-id": { type: "string" },
  },
});

function presentValue(value: string | undefined): string | undefined {
  return value === "" ? undefined : value;
}

if (values.help) {
  process.stdout.write(
    `${JSON.stringify({
      commands,
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
    })}\n`,
  );
} else {
  try {
    const schema = object({
      command: picklist(commands),
      limit: pipe(number(), integer(), minValue(1), maxValue(maxQueryLimit)),
      minutes: pipe(number(), integer(), minValue(1), maxValue(minutesPerDay)),
      service: picklist(services),
    });
    const parsed = parse(schema, {
      command: positionals[0],
      limit: Number(values.limit),
      minutes: Number(values.minutes),
      service: values.service,
    });
    if (positionals.length !== 1) {
      throw new Error("Specify one query command");
    }
    const input = {
      ...parsed,
      expression: presentValue(values.expression),
      requestId: presentValue(values["request-id"]),
      severity:
        values.severity === undefined ? undefined : parse(picklist(severities), values.severity),
      traceId: presentValue(values["trace-id"]),
    };
    const data = await queryGrafana(values.grafana, queryPath(input, Date.now()));
    process.stdout.write(
      `${JSON.stringify({
        command: parsed.command,
        data,
        observedAt: new Date().toISOString(),
        ok: true,
        service: parsed.service,
      })}\n`,
    );
  } catch {
    process.stderr.write(
      `${JSON.stringify({
        event: "observability.query_failed",
        ok: false,
        remediation:
          "Check arguments, LGTM health and datasource availability. Use --help for read-only query commands.",
      })}\n`,
    );
    process.exitCode = 1;
  }
}
