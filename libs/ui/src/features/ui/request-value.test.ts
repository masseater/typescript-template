import { Cause } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { describe, expect, test } from "vite-plus/test";

import { firstResultError, resultValue, settledValue } from "./request-value.ts";

describe("resultValue", () => {
  const it = test
    .extend("theRefreshingValue", () => resultValue(AsyncResult.success(3, { waiting: true })))
    .extend("theInitialValue", () => resultValue(AsyncResult.initial<number, Error>(true)))
    .extend("theFailedValue", () =>
      resultValue(AsyncResult.failure(Cause.fail(new Error("取得できませんでした。")))),
    );

  it("gives the value of a success even while it refreshes", ({ theRefreshingValue }) => {
    expect.hasAssertions();
    expect(theRefreshingValue).toBe(3);
  });

  it("gives nothing before the first success", ({ theInitialValue }) => {
    expect.hasAssertions();
    expect(theInitialValue).toBe(undefined);
  });

  it("gives nothing after a failure", ({ theFailedValue }) => {
    expect.hasAssertions();
    expect(theFailedValue).toBe(undefined);
  });
});

describe("settledValue", () => {
  const it = test
    .extend("theSettledValue", () => settledValue(AsyncResult.success(3)))
    .extend("theRefreshingValue", () => settledValue(AsyncResult.success(3, { waiting: true })));

  it("gives the value of a settled success", ({ theSettledValue }) => {
    expect.hasAssertions();
    expect(theSettledValue).toBe(3);
  });

  it("gives nothing while a success refreshes", ({ theRefreshingValue }) => {
    expect.hasAssertions();
    expect(theRefreshingValue).toBe(undefined);
  });
});

describe("firstResultError", () => {
  const it = test
    .extend("theFirstFailure", () =>
      firstResultError(
        AsyncResult.success(1),
        AsyncResult.failure(Cause.fail(new Error("最初の失敗"))),
        AsyncResult.failure(Cause.fail(new Error("次の失敗"))),
      ))
    .extend("theQuietFailure", () =>
      firstResultError(AsyncResult.success(1), AsyncResult.initial<number, Error>(true)),
    );

  it("reports the first failure among the results", ({ theFirstFailure }) => {
    expect.hasAssertions();
    expect(theFirstFailure).toBe("最初の失敗");
  });

  it("reports nothing while every result succeeds or waits", ({ theQuietFailure }) => {
    expect.hasAssertions();
    expect(theQuietFailure).toBe(undefined);
  });
});
