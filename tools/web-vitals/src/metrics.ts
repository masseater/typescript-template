import { Array, Option, String, pipe } from "effect";
import type { FlowResult } from "lighthouse";

const PASSING_SCORE = 0.9;
const SCORE_DIGITS = 2;
const SHIFT_DIGITS = 3;
const LABEL_WIDTH = 4;
const VALUE_WIDTH = 9;

const milliseconds = (value: number): string => `${Math.round(value).toString()}ms`;

const unitless = (value: number): string => value.toFixed(SHIFT_DIGITS);

const METRICS = [
  { audit: "largest-contentful-paint", label: "LCP", core: true, format: milliseconds },
  { audit: "interaction-to-next-paint", label: "INP", core: true, format: milliseconds },
  { audit: "cumulative-layout-shift", label: "CLS", core: true, format: unitless },
  { audit: "first-contentful-paint", label: "FCP", core: false, format: milliseconds },
  { audit: "server-response-time", label: "TTFB", core: false, format: milliseconds },
  { audit: "total-blocking-time", label: "TBT", core: false, format: milliseconds },
] as const;

type Metric = (typeof METRICS)[number];

interface Measurement {
  readonly metric: Metric;
  readonly value: number;
  readonly score: number;
}

interface StepVitals {
  readonly name: string;
  readonly measurements: readonly Measurement[];
}

const measurementOf = (step: FlowResult.Step, metric: Metric): Option.Option<Measurement> =>
  Option.fromNullishOr(step.lhr.audits[metric.audit]).pipe(
    Option.flatMap((result) =>
      Option.all({
        value: Option.fromNullishOr(result.numericValue),
        score: Option.fromNullishOr(result.score),
      }),
    ),
    Option.map(({ value, score }) => ({ metric, value, score })),
  );

const vitalsOf = (flow: FlowResult): readonly StepVitals[] =>
  pipe(
    flow.steps,
    Array.map((step) => ({
      name: step.name,
      measurements: pipe(
        METRICS,
        Array.map((metric) => measurementOf(step, metric)),
        Array.getSomes,
      ),
    })),
  );

const isPoor = (measurement: Measurement): boolean =>
  measurement.metric.core && measurement.score < PASSING_SCORE;

const failuresOf = (steps: readonly StepVitals[]): readonly string[] =>
  pipe(
    steps,
    Array.flatMap((step) =>
      pipe(
        step.measurements,
        Array.filter(isPoor),
        Array.map((measurement) => `${step.name}: ${measurement.metric.label}`),
      ),
    ),
  );

const lineOf = (measurement: Measurement): string => {
  const label = pipe(measurement.metric.label, String.padEnd(LABEL_WIDTH));
  const value = pipe(measurement.metric.format(measurement.value), String.padStart(VALUE_WIDTH));
  return pipe(
    [`  ${label}`, value, `  score ${measurement.score.toFixed(SCORE_DIGITS)}`],
    Array.join(" "),
  );
};

const tableOf = (steps: readonly StepVitals[]): string =>
  pipe(
    steps,
    Array.flatMap((step) => [step.name, ...pipe(step.measurements, Array.map(lineOf))]),
    Array.join("\n"),
  );

const summarize = (
  flow: FlowResult,
): { readonly table: string; readonly failures: readonly string[] } => {
  const steps = vitalsOf(flow);
  return { table: tableOf(steps), failures: failuresOf(steps) };
};

export { summarize };
