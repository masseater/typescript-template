import { describe, expect, it } from "vite-plus/test";

import { describeOffer } from "./offer-text.ts";

describe("describeOffer", () => {
  it("prints a monthly yen price without dividing the zero-decimal amount", () => {
    expect.hasAssertions();
    expect(
      describeOffer({ currency: "jpy", interval: "month", intervalCount: 1, unitAmount: 980 }),
    ).toBe("月額 ￥980");
  });

  it("turns minor units into a decimal price for currencies that have them", () => {
    expect.hasAssertions();
    expect(
      describeOffer({ currency: "usd", interval: "year", intervalCount: 1, unitAmount: 4900 }),
    ).toBe("年額 $49.00");
  });

  it("spells out intervals longer than one unit", () => {
    expect.hasAssertions();
    expect(
      describeOffer({ currency: "jpy", interval: "month", intervalCount: 3, unitAmount: 2500 }),
    ).toBe("3か月ごと ￥2,500");
  });
});
