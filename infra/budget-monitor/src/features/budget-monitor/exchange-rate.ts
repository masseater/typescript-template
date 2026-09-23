import { Duration, Effect, Schema } from "effect";

import { BudgetFailure, fail } from "./config.ts";

const maximumRateAge = Duration.toMillis(Duration.days(7));
const exchangeRateEndpoint = "https://api.frankfurter.dev/v1/latest";
const exchangeRateQuery = new URLSearchParams({ base: "USD", symbols: "JPY" });

const RateDate = Schema.String.check(
  Schema.makeFilter(
    (rateDay: string) =>
      /^\d{4}-\d{2}-\d{2}$/u.test(rateDay) && !Number.isNaN(Date.parse(`${rateDay}T00:00:00Z`)),
  ),
);
const ExchangeRate = Schema.Struct({
  base: Schema.Literal("USD"),
  date: RateDate,
  rates: Schema.Struct({
    JPY: Schema.Number.check(Schema.isFinite(), Schema.isGreaterThan(0)),
  }),
});

const responseInvalid = (): BudgetFailure =>
  new BudgetFailure({ code: "exchange_rate_response_invalid" });

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

const fetchJpyPerUsd = Effect.fn("fetchJpyPerUsd")(function* fetchJpyPerUsd(observedAt: number) {
  const rateResponse = yield* requestRate(fetch);
  if (!rateResponse.ok) {
    return yield* fail("exchange_rate_http_failed");
  }
  const rateBody = yield* Effect.tryPromise(() => rateResponse.json()).pipe(
    Effect.mapError(responseInvalid),
  );
  const quote = yield* Schema.decodeUnknownEffect(ExchangeRate)(rateBody).pipe(
    Effect.mapError(responseInvalid),
  );
  if (observedAt - Date.parse(`${quote.date}T00:00:00Z`) > maximumRateAge) {
    return yield* fail("exchange_rate_stale");
  }
  return quote.rates.JPY;
});

export { fetchJpyPerUsd };
