import { AsyncResult } from "effect/unstable/reactivity";

import { resultError } from "./request";

type ResultValue<Settled> =
  Settled extends AsyncResult.AsyncResult<infer Value, unknown> ? Value : never;

type ListedValue<Settled> = ResultValue<Settled> extends readonly (infer Listed)[] ? Listed : never;

const resultValue = <Settled extends object>(
  settled: Settled,
): ResultValue<Settled> | undefined => {
  const attempt = settled as AsyncResult.AsyncResult<ResultValue<Settled>, unknown>;
  return AsyncResult.isSuccess(attempt) ? attempt.value : undefined;
};

const settledValue = <Settled extends object>(
  settled: Settled,
): ResultValue<Settled> | undefined => {
  const attempt = settled as AsyncResult.AsyncResult<ResultValue<Settled>, unknown>;
  return attempt.waiting ? undefined : resultValue(settled);
};

const firstResultError = (...settledResults: readonly object[]): string | undefined => {
  return settledResults.map(resultError).find((failure) => failure !== undefined);
};

export { firstResultError, resultValue, settledValue };
export type { ListedValue, ResultValue };
