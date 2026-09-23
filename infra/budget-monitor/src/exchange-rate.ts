import { Effect, Schema } from "effect";

import { BudgetFailure, fail } from "./config.ts";

const MILLISECONDS_PER_DAY = 86_400_000;
const MAX_RATE_AGE_DAYS = 7;
const exchangeRateEndpoint = "https://api.frankfurter.dev/v1/latest";
const exchangeRateQuery = new URLSearchParams({ base: "USD", symbols: "JPY" });

const RateDate = Schema.String.check(
  Schema.makeFilter(
    (value: string) =>
      /^\d{4}-\d{2}-\d{2}$/u.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)),
  ),
);
const ExchangeRate = Schema.Struct({
  base: Schema.Literal("USD"),
  date: RateDate,
  rates: Schema.Struct({
    JPY: Schema.Number.check(Schema.isFinite(), Schema.isGreaterThan(0)),
  }),
});

function responseInvalid(): BudgetFailure {
  return new BudgetFailure({ code: "exchange_rate_response_invalid" });
}

const requestRate = (fetchImpl: typeof fetch): Effect.Effect<Response, BudgetFailure> =>
  Effect.tryPromise({
    catch: () => new BudgetFailure({ code: "exchange_rate_http_failed" }),
    try: (signal) =>
      fetchImpl(`${exchangeRateEndpoint}?${exchangeRateQuery.toString()}`, {
        headers: { Accept: "application/json" },
        redirect: "manual",
        signal,
      }),
  });

const fetchJpyPerUsd = Effect.fn("fetchJpyPerUsd")(function* fetchJpyPerUsd(now: number) {
  const response = yield* requestRate(fetch);
  if (!response.ok) {
    return yield* fail("exchange_rate_http_failed");
  }
  const body = yield* Effect.tryPromise(() => response.json()).pipe(
    Effect.mapError(responseInvalid),
  );
  const quote = yield* Schema.decodeUnknownEffect(ExchangeRate)(body).pipe(
    Effect.mapError(responseInvalid),
  );
  if (now - Date.parse(`${quote.date}T00:00:00Z`) > MAX_RATE_AGE_DAYS * MILLISECONDS_PER_DAY) {
    return yield* fail("exchange_rate_stale");
  }
  return quote.rates.JPY;
});

export { fetchJpyPerUsd };
