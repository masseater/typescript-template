import { googleAnalyticsConnectSrc, googleAnalyticsScriptSrc } from "@repo/config";
import { cspNonceHeader } from "@repo/runtime/security";
import { startRoute } from "@repo/runtime/worker";
import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { googleAnalyticsBootstrap } from "./bootstrap.ts";
import { memberAppHead } from "./head.ts";

const measurementId = "G-DEVSERVERMEASURE";
const origin = "https://member.example.test";

describe("service-member analytics document output", () => {
  it("names google analytics hosts in csp only when analytics is configured", async () => {
    const enabled = startRoute(
      {
        fetch: (rendered: Request): Response =>
          new Response("<!DOCTYPE html>", {
            headers: {
              "content-type": "text/html; charset=utf-8",
              "x-rendered-nonce": rendered.headers.get(cspNonceHeader) ?? "",
            },
          }),
      },
      { googleAnalytics: true },
    );
    const disabled = startRoute({
      fetch: (): Response =>
        new Response("<!DOCTYPE html>", {
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
    });
    const enabledPolicy =
      (await Effect.runPromise(enabled(new Request(`${origin}/`)))).headers.get(
        "content-security-policy",
      ) ?? "";
    const disabledPolicy =
      (await Effect.runPromise(disabled(new Request(`${origin}/`)))).headers.get(
        "content-security-policy",
      ) ?? "";
    for (const host of googleAnalyticsConnectSrc) {
      expect(enabledPolicy).toContain(host);
    }
    for (const host of googleAnalyticsScriptSrc) {
      expect(enabledPolicy).toContain(host);
    }
    for (const host of googleAnalyticsConnectSrc) {
      expect(disabledPolicy).not.toContain(host);
    }
  });

  it("describes gtag scripts in the head only when a measurement id is configured", () => {
    const configured = memberAppHead("Service", "/styles.css", measurementId);
    const absent = memberAppHead("Service", "/styles.css", undefined);
    expect(configured.scripts?.[0]?.src).toContain(measurementId);
    expect(configured.scripts?.[1]?.children).toBe(googleAnalyticsBootstrap(measurementId));
    expect(absent.scripts).toBeUndefined();
  });
});
