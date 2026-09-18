import { Schema } from "effect";

const IntegerText = Schema.Union([Schema.String, Schema.Number]);
const AnyValue = Schema.Struct({
  boolValue: Schema.optionalKey(Schema.Boolean),
  doubleValue: Schema.optionalKey(Schema.Number),
  intValue: Schema.optionalKey(IntegerText),
  stringValue: Schema.optionalKey(Schema.String),
});
const KeyValue = Schema.Struct({ key: Schema.String, value: AnyValue });
const KeyValues = Schema.Array(KeyValue);
const Span = Schema.Struct({
  attributes: Schema.optionalKey(KeyValues),
  endTimeUnixNano: Schema.String,
  name: Schema.String,
  parentSpanId: Schema.optionalKey(Schema.String),
  spanId: Schema.String,
  startTimeUnixNano: Schema.String,
});
const ScopeSpans = Schema.Struct({ spans: Schema.Array(Span) });
const ResourceSpans = Schema.Struct({
  resource: Schema.Struct({ attributes: KeyValues }),
  scopeSpans: Schema.Array(ScopeSpans),
});
const TempoTrace = Schema.Struct({
  trace: Schema.Struct({ resourceSpans: Schema.Array(ResourceSpans) }),
});

type Attributes = typeof KeyValues.Type;

interface TimedSpan {
  readonly attributes: Attributes;
  readonly end: number;
  readonly key: string;
  readonly parentSpanId: string;
  readonly service: string;
  readonly spanId: string;
  readonly start: number;
}

type Totals = Readonly<Record<string, number>>;

interface RunMeasurement {
  readonly command: string;
  readonly complete: boolean;
  readonly cpuMilliseconds: Totals;
  readonly durationMilliseconds: number;
  readonly exitCode: ReturnType<typeof attribute>;
  readonly revision: string;
  readonly selfMilliseconds: Totals;
  readonly startupMilliseconds: Totals;
  readonly traceId: string;
  readonly wallMilliseconds: Totals;
}

interface Distribution {
  readonly max: number;
  readonly median: number;
  readonly min: number;
  readonly p95: number;
}

const nanosecondsPerMillisecond = 1_000_000n;
const MEDIAN = 0.5;
const PERCENTILE_95 = 0.95;
const REVISION_LENGTH = 12;

function attribute(attributes: Attributes, key: string): boolean | number | string | undefined {
  const value = attributes.find((entry) => entry.key === key)?.value;
  if (value?.intValue !== undefined) {
    return Number(value.intValue);
  }
  return value?.stringValue ?? value?.doubleValue ?? value?.boolValue;
}

function milliseconds(nanoseconds: string): number {
  return Number(BigInt(nanoseconds) / nanosecondsPerMillisecond);
}

function timedSpans(trace: typeof TempoTrace.Type): readonly TimedSpan[] {
  return trace.trace.resourceSpans.flatMap((resourceSpan) => {
    const service = String(attribute(resourceSpan.resource.attributes, "service.name") ?? "");
    return resourceSpan.scopeSpans
      .flatMap((scope) => scope.spans)
      .map((span) => ({
        attributes: span.attributes ?? [],
        end: milliseconds(span.endTimeUnixNano),
        key: `${service}:${span.name}`,
        parentSpanId: span.parentSpanId ?? "",
        service,
        spanId: span.spanId,
        start: milliseconds(span.startTimeUnixNano),
      }));
  });
}

function coveredMilliseconds(children: readonly TimedSpan[], parent: TimedSpan): number {
  const intervals = children
    .map((child) => [Math.max(child.start, parent.start), Math.min(child.end, parent.end)] as const)
    .filter(([start, end]) => end > start)
    .toSorted((left, right) => left[0] - right[0]);
  let covered = 0;
  let reach = parent.start;
  for (const [start, end] of intervals) {
    covered += Math.max(0, end - Math.max(start, reach));
    reach = Math.max(reach, end);
  }
  return covered;
}

function totals(entries: readonly (readonly [string, number])[]): Totals {
  const summed: Record<string, number> = {};
  for (const [key, value] of entries) {
    summed[key] = (summed[key] ?? 0) + value;
  }
  return summed;
}

function cpuMilliseconds(span: TimedSpan): number {
  return (
    Number(attribute(span.attributes, "process.cpu.user_ms") ?? 0) +
    Number(attribute(span.attributes, "process.cpu.system_ms") ?? 0)
  );
}

function parentTotals(
  spans: readonly TimedSpan[],
): Pick<RunMeasurement, "selfMilliseconds" | "startupMilliseconds"> {
  const parents = spans.flatMap((span) => {
    const children = spans.filter((child) => child.parentSpanId === span.spanId);
    return children.length === 0 ? [] : [{ children, span }];
  });
  return {
    selfMilliseconds: totals(
      parents.map(({ children, span }) => [
        span.key,
        span.end - span.start - coveredMilliseconds(children, span),
      ]),
    ),
    startupMilliseconds: totals(
      parents.map(({ children, span }) => [
        span.key,
        Math.min(...children.map((child) => child.start)) - span.start,
      ]),
    ),
  };
}

function revisionOf(trace: typeof TempoTrace.Type): string {
  const resource =
    trace.trace.resourceSpans.find(
      (resourceSpan) => attribute(resourceSpan.resource.attributes, "service.name") === "vp",
    )?.resource.attributes ?? [];
  const revision = String(attribute(resource, "vcs.ref.head.revision") ?? "");
  const dirty = attribute(resource, "vcs.worktree.dirty") === true ? "+dirty" : "";
  return `${revision.slice(0, REVISION_LENGTH)}${dirty}`;
}

function measure(traceId: string, trace: typeof TempoTrace.Type): RunMeasurement | undefined {
  const spans = timedSpans(trace);
  const root = spans.find((span) => span.service === "vp" && span.parentSpanId === "");
  if (root === undefined) {
    return undefined;
  }
  const measured = spans.filter((span) => span !== root);
  return {
    command: root.key.slice(root.service.length + 1),
    complete:
      attribute(root.attributes, "perf.process.unreadable") === 0 &&
      attribute(root.attributes, "perf.process.orphaned") === 0 &&
      attribute(root.attributes, "perf.summary") !== "unreadable",
    cpuMilliseconds: totals(
      measured.flatMap((span) => {
        const cpu = cpuMilliseconds(span);
        return cpu > 0 ? [[span.key, cpu] as const] : [];
      }),
    ),
    durationMilliseconds: root.end - root.start,
    exitCode: attribute(root.attributes, "process.exit.code"),
    revision: revisionOf(trace),
    ...parentTotals(measured),
    traceId,
    wallMilliseconds: totals(measured.map((span) => [span.key, span.end - span.start])),
  };
}

function distribution(values: readonly number[]): Distribution {
  const sorted = values.toSorted((left, right) => left - right);
  function at(ratio: number): number {
    return sorted[Math.min(sorted.length - 1, Math.ceil(ratio * sorted.length) - 1)] ?? 0;
  }
  return {
    max: sorted.at(-1) ?? 0,
    median: at(MEDIAN),
    min: sorted[0] ?? 0,
    p95: at(PERCENTILE_95),
  };
}

function metric(
  group: readonly RunMeasurement[],
  name: string,
  select: (run: RunMeasurement) => Totals,
): Distribution | undefined {
  const values = group.flatMap((run) => {
    const value = select(run)[name];
    return value === undefined ? [] : [value];
  });
  return values.length === 0 ? undefined : distribution(values);
}

function spanDistributions(group: readonly RunMeasurement[]): readonly unknown[] {
  const names = [...new Set(group.flatMap((run) => Object.keys(run.wallMilliseconds)))];
  return names
    .map((name) => ({
      cpu: metric(group, name, (run) => run.cpuMilliseconds),
      name,
      runs: group.filter((run) => run.wallMilliseconds[name] !== undefined).length,
      self: metric(group, name, (run) => run.selfMilliseconds),
      startup: metric(group, name, (run) => run.startupMilliseconds),
      wall: metric(group, name, (run) => run.wallMilliseconds),
    }))
    .toSorted((left, right) => (right.wall?.median ?? 0) - (left.wall?.median ?? 0));
}

function summarize(runs: readonly RunMeasurement[]): readonly unknown[] {
  const groups = Map.groupBy(
    runs,
    (run) => `${run.command} ${run.revision} ${String(run.exitCode)} ${String(run.complete)}`,
  );
  return [...groups.values()].map((group) => ({
    command: group[0]?.command,
    complete: group[0]?.complete,
    duration: distribution(group.map((run) => run.durationMilliseconds)),
    exitCode: group[0]?.exitCode,
    revision: group[0]?.revision,
    runs: group.length,
    spans: spanDistributions(group),
    traceIds: group.map((run) => run.traceId),
  }));
}

export { measure, summarize, TempoTrace };
export type { RunMeasurement };
