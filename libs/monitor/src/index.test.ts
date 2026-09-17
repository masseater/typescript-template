import { describe, expect, it } from "vite-plus/test";
import { is, object, parse } from "valibot";
import { alertEnvironment } from "./index.ts";

const alerts = object(alertEnvironment);

describe("monitor alert environment", () => {
  it("splits verified operator addresses", () => {
    expect.hasAssertions();
    expect(
      parse(alerts, {
        ALERT_FROM: "alerts@example.com",
        ALERT_TO: "operator@example.com,oncall@example.com",
      }),
    ).toStrictEqual({
      ALERT_FROM: "alerts@example.com",
      ALERT_TO: ["operator@example.com", "oncall@example.com"],
    });
  });

  it.each([
    { ALERT_FROM: "alerts@example.com", ALERT_TO: "private-not-an-address" },
    { ALERT_FROM: "", ALERT_TO: "operator@example.com" },
  ])("refuses invalid alert addresses: %j", (input: Readonly<Record<string, string>>) => {
    expect.hasAssertions();
    expect(is(alerts, input)).toBe(false);
  });
});
