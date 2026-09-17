import * as v from "valibot";
import { expect, test } from "vite-plus/test";
import { alertEnvironment } from "./index.ts";

const alerts = v.object(alertEnvironment);

test("splits verified operator addresses", () => {
  expect(
    v.parse(alerts, {
      ALERT_FROM: "alerts@example.com",
      ALERT_TO: "operator@example.com,oncall@example.com",
    }),
  ).toEqual({
    ALERT_FROM: "alerts@example.com",
    ALERT_TO: ["operator@example.com", "oncall@example.com"],
  });
});

test.each([
  { ALERT_FROM: "alerts@example.com", ALERT_TO: "private-not-an-address" },
  { ALERT_FROM: "", ALERT_TO: "operator@example.com" },
])("refuses invalid alert addresses: %j", (input) => {
  expect(v.is(alerts, input)).toBe(false);
});
