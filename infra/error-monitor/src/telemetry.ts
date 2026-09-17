import * as v from "valibot";

const groupKeys = ["error.fingerprint", "service", "event", "error.type"] as const;
const group = v.object({ key: v.string(), value: v.union([v.string(), v.number(), v.boolean()]) });
const envelope = v.object({
  success: v.literal(true),
  result: v.looseObject({
    calculations: v.optional(
      v.array(
        v.looseObject({
          aggregates: v.array(
            v.looseObject({ count: v.number(), groups: v.optional(v.array(group)) }),
          ),
        }),
      ),
      [],
    ),
  }),
});

export interface ErrorGroup {
  fingerprint: string;
  service: string;
  event: string;
  type: string;
  count: number;
}

export async function fetchErrorGroups(
  accountId: string,
  token: string,
  from: number,
  to: number,
): Promise<ErrorGroup[]> {
  if (!/^[a-f0-9]{32}$/.test(accountId)) throw new Error("telemetry_account_invalid");
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/observability/telemetry/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        queryId: "error-monitor",
        timeframe: { from, to },
        view: "calculations",
        parameters: {
          datasets: [],
          filters: [{ key: "error.fingerprint", operation: "exists", type: "string" }],
          calculations: [{ operator: "count", alias: "events" }],
          groupBys: groupKeys.map((value) => ({ type: "string", value })),
          limit: 50,
        },
      }),
      signal: AbortSignal.timeout(15_000),
      redirect: "manual",
    },
  );
  if (!response.ok) throw new Error("telemetry_http_failed");
  const parsed = v.safeParse(envelope, await response.json());
  if (!parsed.success) throw new Error("telemetry_response_invalid");
  return parsed.output.result.calculations.flatMap((calculation) =>
    calculation.aggregates.flatMap((aggregate) => {
      const values = Object.fromEntries(
        (aggregate.groups ?? []).map((item) => [item.key, String(item.value)]),
      );
      const fingerprint = values["error.fingerprint"];
      if (!fingerprint || !/^[0-9a-f]{8}$/.test(fingerprint)) return [];
      return [
        {
          fingerprint,
          service: values["service"] ?? "unknown",
          event: values["event"] ?? "unknown",
          type: values["error.type"] ?? "Error",
          count: aggregate.count,
        },
      ];
    }),
  );
}
