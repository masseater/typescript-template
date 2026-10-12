import { adopt } from "alchemy/AdoptPolicy";
import { AnalyticsEngine, Ruleset, Workers, Zone } from "alchemy/Cloudflare";
import type { InferEnv } from "alchemy/Cloudflare";
import { Effect } from "effect";

import { APP_NAME } from "./app-name.ts";

const SCANNER_PATH_FRAGMENTS = [
  ".php",
  ".asp",
  ".jsp",
  ".cgi",
  ".sql",
  ".bak",
  "/wp-",
  "/cgi-bin/",
  "/phpmyadmin",
  "/actuator",
  "/vendor/",
] as const;

const HONEYPOT_PATHS = ["/.env", "/wp-login.php"] as const;

const PATH = "lower(http.request.uri.path)";

const scannerExpression = (domain: string): string => {
  const honeypot = `(http.host eq "${domain}" and http.request.uri.path in {${HONEYPOT_PATHS.map((path) => `"${path}"`).join(" ")}})`;
  const probes = [
    ...SCANNER_PATH_FRAGMENTS.map((fragment) => `${PATH} contains "${fragment}"`),
    `(${PATH} contains "/." and not starts_with(${PATH}, "/.well-known/"))`,
  ].join(" or ");
  return `(${probes}) and not ${honeypot}`;
};

const honeypot = Effect.fn("honeypot")(function* honeypot(
  domain: string,
  compatibility: Readonly<{ date: string }>,
) {
  const HONEYPOT = yield* AnalyticsEngine.Dataset("Honeypot", {
    dataset: `${APP_NAME.replaceAll("-", "_")}_honeypot`,
  });
  return yield* Workers.Worker("Honeypot", {
    name: `${APP_NAME}-honeypot`,
    main: "./honeypot.worker.ts",
    compatibility,
    logpush: true,
    env: { HONEYPOT },
    routes: HONEYPOT_PATHS.map((path) => ({ pattern: `${domain}${path}`, zoneName: domain })),
  });
});

const edgeGuard = Effect.fn("edgeGuard")(function* edgeGuard(
  domain: string,
  compatibility: Readonly<{ date: string }>,
) {
  const zone = yield* Zone.Zone("Zone", { name: domain }).pipe(adopt(true));
  yield* Ruleset.Ruleset("ScannerBlock", {
    zone,
    name: `${APP_NAME}-scanner-block`,
    phase: "http_request_firewall_custom",
    rules: [
      {
        description: "Block vulnerability scanner probes",
        expression: scannerExpression(domain),
        action: "block",
      },
    ],
  });
  return yield* honeypot(domain, compatibility);
});

type HoneypotEnv = InferEnv<ReturnType<typeof honeypot>>;

export type { HoneypotEnv };
export { edgeGuard };
