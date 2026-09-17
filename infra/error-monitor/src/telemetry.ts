import {
  array,
  boolean,
  literal,
  looseObject,
  number,
  object,
  optional,
  safeParse,
  string,
  union,
} from "valibot";

interface ErrorGroup {
  readonly fingerprint: string;
  readonly service: string;
  readonly event: string;
  readonly type: string;
  readonly count: number;
}

interface QueryWindow {
  readonly accountId: string;
  readonly token: string;
  readonly from: number;
  readonly to: number;
}

type GroupValue = Readonly<{ key: string; value: string | number | boolean }>;
type Aggregate = Readonly<{ count: number; groups?: readonly GroupValue[] | undefined }>;
type Calculation = Readonly<{ aggregates: readonly Aggregate[] }>;

const REQUEST_TIMEOUT_MS = 15_000;
const QUERY_LIMIT = 50;
const groupKeys = ["error.fingerprint", "service", "event", "error.type"] as const;
const scalar = union([string(), number(), boolean()]);
const groupValue = object({ key: string(), value: scalar });
const aggregate = looseObject({ count: number(), groups: optional(array(groupValue)) });
const calculation = looseObject({ aggregates: array(aggregate) });
const calculations = array(calculation);
const envelope = object({
  result: looseObject({ calculations: optional(calculations, []) }),
  success: literal(true),
});

function errorGroup(item: Aggregate): ErrorGroup[] {
  const values = new Map(
    (item.groups ?? []).map((entry: GroupValue) => [entry.key, String(entry.value)]),
  );
  const fingerprint = values.get("error.fingerprint");
  if (fingerprint === undefined || !/^[0-9a-f]{8}$/u.test(fingerprint)) {
    return [];
  }
  return [
    {
      count: item.count,
      event: values.get("event") ?? "unknown",
      fingerprint,
      service: values.get("service") ?? "unknown",
      type: values.get("error.type") ?? "Error",
    },
  ];
}

function queryBody(window: QueryWindow): string {
  return JSON.stringify({
    parameters: {
      calculations: [{ alias: "events", operator: "count" }],
      datasets: [],
      filters: [{ key: "error.fingerprint", operation: "exists", type: "string" }],
      groupBys: groupKeys.map((value) => ({ type: "string", value })),
      limit: QUERY_LIMIT,
    },
    queryId: "error-monitor",
    timeframe: { from: window.from, to: window.to },
    view: "calculations",
  });
}

async function fetchErrorGroups(window: QueryWindow): Promise<ErrorGroup[]> {
  if (!/^[a-f0-9]{32}$/u.test(window.accountId)) {
    throw new Error("telemetry_account_invalid");
  }
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${window.accountId}/workers/observability/telemetry/query`,
    {
      body: queryBody(window),
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${window.token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );
  if (!response.ok) {
    throw new Error("telemetry_http_failed");
  }
  const body: unknown = await response.json();
  const parsed = safeParse(envelope, body);
  if (!parsed.success) {
    throw new Error("telemetry_response_invalid");
  }
  return parsed.output.result.calculations.flatMap((entry: Calculation) =>
    entry.aggregates.flatMap((item: Aggregate) => errorGroup(item)),
  );
}

export { fetchErrorGroups };
export type { ErrorGroup };
