import { dashboardStaff } from "@repo/db/dashboard-staff";
import { Effect, Schema } from "effect";

import { AuditPageQuery, TrendQuery } from "#shared/contracts/index.ts";

import type { WikiServices } from "#shared/wiki/index.ts";
import type { McpServer } from "@modelcontextprotocol/server";
import type { Context } from "effect";

const AuditToolInput = Schema.Struct({
  action: AuditPageQuery.fields.action,
  actorId: AuditPageQuery.fields.actorId,
  limit: AuditPageQuery.fields.limit,
  offset: AuditPageQuery.fields.offset,
  targetId: AuditPageQuery.fields.targetId,
});

const TrendToolInput = TrendQuery;

function registerDashboardTools(server: McpServer, context: Context.Context<WikiServices>): void {
  server.registerTool(
    "overview_metrics",
    {
      description: "Read aggregate service metrics for the internal dashboard overview.",
      inputSchema: Schema.Struct({}),
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
      const query = await Effect.runPromise(Schema.decodeUnknownEffect(TrendToolInput)(input));
      const trend = await Effect.runPromiseWith(context)(dashboardStaff.metricTrend(query));
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
      const page = await Effect.runPromise(Schema.decodeUnknownEffect(AuditToolInput)(input));
      const events = await Effect.runPromiseWith(context)(dashboardStaff.auditEvents(page));
      return {
        content: [{ text: JSON.stringify(events), type: "text" as const }],
      };
    },
  );
}

export { registerDashboardTools };
