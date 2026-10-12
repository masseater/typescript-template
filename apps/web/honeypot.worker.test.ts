import { expect, test } from "vite-plus/test";

import type { HoneypotEnv } from "./edge-guard.ts";
import worker from "./honeypot.worker.ts";

const recorder = (): Readonly<{ points: AnalyticsEngineDataPoint[]; env: HoneypotEnv }> => {
  const points: AnalyticsEngineDataPoint[] = [];
  return {
    points,
    env: {
      HONEYPOT: {
        writeDataPoint: (point) => {
          points.push(point ?? {});
        },
      },
    },
  };
};

const probe = (
  url: string,
  init: Readonly<{ method: string; headers: Readonly<Record<string, string>> }>,
  cf?: Readonly<Record<string, unknown>>,
): Request => Object.defineProperty(new Request(url, init), "cf", { value: cf });

test("records the probe and answers 404", () => {
  const { points, env } = recorder();
  const response = worker.fetch(
    probe(
      "https://masseater.dev/.env?x=1",
      { method: "GET", headers: { "cf-connecting-ip": "192.0.2.1", "user-agent": "scanner" } },
      { country: "NL", asn: "14061", asOrganization: "DigitalOcean" },
    ),
    env,
  );
  expect(response).toMatchObject({ status: 404 });
  expect(points).toStrictEqual([
    {
      indexes: ["/.env"],
      blobs: [
        "masseater.dev",
        "/.env",
        "?x=1",
        "GET",
        "192.0.2.1",
        "NL",
        "14061",
        "DigitalOcean",
        "scanner",
      ],
    },
  ]);
});

test("records empty fields when the edge omits them", () => {
  const { points, env } = recorder();
  worker.fetch(probe("https://masseater.dev/wp-login.php", { method: "POST", headers: {} }), env);
  expect(points).toStrictEqual([
    {
      indexes: ["/wp-login.php"],
      blobs: ["masseater.dev", "/wp-login.php", "", "POST", "", "", "", "", ""],
    },
  ]);
});
