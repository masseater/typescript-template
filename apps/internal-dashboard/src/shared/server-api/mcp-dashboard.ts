import { dashboardStaff } from "@repo/db";
import { Effect, Schema } from "effect";

import { AuditPageQuery, TrendQuery } from "#shared/contracts/index.ts";

import type { WikiServices } from "#shared/wiki/index.ts";
import type { McpServer } from "@modelcontextprotocol/server";
import type { Context } from "effect";

const EmptyInput = Schema.toStandardJSONSchemaV1(Schema.toStandardSchemaV1(Schema.Struct({})));
const AuditToolInput = Schema.toStandardJSONSchemaV1(Schema.toStandardSchemaV1(AuditPageQuery));
const TrendToolInput = Schema.toStandardJSONSchemaV1(Schema.toStandardSchemaV1(TrendQuery));

const JsonUnknown = Schema.fromJsonString(Schema.Unknown);

const encodeToolResult = (value: unknown): Promise<{ content: [{ text: string; type: "text" }] }> =>
  Schema.encodePromise(JsonUnknown)(value).then((text) => ({
    content: [{ text, type: "text" as const }],
  }));

function registerDashboardTools(server: McpServer, context: Context.Context<WikiServices>): void {
  server.registerTool(
    "overview_metrics",
    {
      description: "Read aggregate service metrics for the internal dashboard overview.",
      inputSchema: EmptyInput,
    },
    () => Effect.runPromiseWith(context)(dashboardStaff.overview()).then(encodeToolResult),
  );
  server.registerTool(
    "metric_trend",
    {
      description: "Read aggregate metric trends over daily or weekly buckets.",
      inputSchema: TrendToolInput,
    },
    (input) =>
      Effect.runPromiseWith(context)(dashboardStaff.metricTrend(input)).then(encodeToolResult),
  );
  server.registerTool(
    "audit_log",
    {
      description: "Read paginated audit events without personal identifiers.",
      inputSchema: AuditToolInput,
    },
    (input) =>
      Effect.runPromiseWith(context)(dashboardStaff.auditEvents(input)).then(encodeToolResult),
  );
}

export { registerDashboardTools };
