import { dashboardStaff } from "@repo/db";
import { Effect, Schema } from "effect";

import { AuditPageQuery, TrendQuery } from "#shared/contracts/index.ts";

import type { WikiServices } from "#shared/wiki/index.ts";
import type { McpServer } from "@modelcontextprotocol/server";
import type { Context } from "effect";

const EmptyInput = Schema.toStandardJSONSchemaV1(Schema.toStandardSchemaV1(Schema.Struct({})));
const AuditToolInput = Schema.toStandardJSONSchemaV1(Schema.toStandardSchemaV1(AuditPageQuery));
const TrendToolInput = Schema.toStandardJSONSchemaV1(Schema.toStandardSchemaV1(TrendQuery));

function registerDashboardTools(server: McpServer, context: Context.Context<WikiServices>): void {
  server.registerTool(
    "overview_metrics",
    {
      description: "Read aggregate service metrics for the internal dashboard overview.",
      inputSchema: EmptyInput,
    },
    async () => {
      const overview = await Effect.runPromiseWith(context)(dashboardStaff.overview());
      return {
        content: [{ text: JSON.stringify(overview), type: "text" as const }],
      };
    },
  );
  server.registerTool(
    "metric_trend",
    {
      description: "Read aggregate metric trends over daily or weekly buckets.",
      inputSchema: TrendToolInput,
    },
    async (input) => {
      const trend = await Effect.runPromiseWith(context)(dashboardStaff.metricTrend(input));
      return {
        content: [{ text: JSON.stringify(trend), type: "text" as const }],
      };
    },
  );
  server.registerTool(
    "audit_log",
    {
      description: "Read paginated audit events without personal identifiers.",
      inputSchema: AuditToolInput,
    },
    async (input) => {
      const events = await Effect.runPromiseWith(context)(dashboardStaff.auditEvents(input));
      return {
        content: [{ text: JSON.stringify(events), type: "text" as const }],
      };
    },
  );
}

export { registerDashboardTools };
