import { describe, expect, it } from "vite-plus/test";
import { ensure, inStage, object, string } from "./support.ts";
import { verifyBrowserSignals, verifyCorrelation, verifyJourneyTelemetry } from "./telemetry.ts";
import type { AdminJourney } from "./journey-admin.ts";
import type { BrowserSession } from "./browser.ts";
import type { Stack } from "./stack.ts";
import type { UserJourney } from "./journey-user.ts";
import { adminJourney } from "./journey-admin.ts";
import { createStack } from "./stack.ts";
import { httpStatus } from "./http.ts";
import { totpLogin } from "./journey-auth.ts";
import { userJourney } from "./journey-user.ts";

type CompletedJourney = UserJourney & AdminJourney;

function forbiddenValues(journey: CompletedJourney): string[] {
  const { alice, bob, originalEnrollment, owner, profile, restoredEnrollment, stack } = journey;
  return [
    profile,
    owner.email,
    alice.email,
    bob.email,
    owner.password,
    alice.password,
    bob.password,
    stack.basicPassword,
    restoredEnrollment.uri,
    originalEnrollment.uri,
    ...originalEnrollment.backupCodes,
    ...restoredEnrollment.backupCodes,
  ];
}

async function verifyBrowserException(journey: CompletedJourney): Promise<void> {
  const { aliceBrowser, started } = journey;
  await aliceBrowser.evaluate(
    'setTimeout(() => { throw new Error("E2E browser exception privacy canary"); }, 0); true',
  );
  const [tabList] = await aliceBrowser.commands(["tab", "list"]);
  const tabs = tabList?.["tabs"];
  ensure(Array.isArray(tabs), "E2E_BROWSER_TABS_MISSING");
  const activeTab: unknown = tabs.find((entry: unknown) => object(entry)["active"] === true);
  const applicationTab = string(object(activeTab)["tabId"]);
  await aliceBrowser.commands(["tab", "new", "about:blank"], ["tab", applicationTab]);
  await verifyBrowserSignals("user", started);
}

async function verifyTelemetry(journey: CompletedJourney): Promise<void> {
  const { admin, alice, aliceBrowser, stack } = journey;
  await totpLogin(
    aliceBrowser,
    { account: alice, origin: stack.userOrigin },
    journey.restoredEnrollment.uri,
  );
  const forbidden = forbiddenValues(journey);
  const profile = await aliceBrowser.api("/api/profile");
  await verifyCorrelation(profile, { forbidden, service: "user" });
  const users = await admin.api("/api/users");
  await verifyCorrelation(users, { forbidden, service: "admin" });
  const participants: readonly Readonly<{ browser: BrowserSession; service: "user" | "admin" }>[] =
    [
      { browser: journey.anonymous, service: "user" },
      { browser: journey.ownerUser, service: "user" },
      { browser: aliceBrowser, service: "user" },
      { browser: journey.bobBrowser, service: "user" },
      { browser: admin, service: "admin" },
      { browser: journey.recoveringAdmin, service: "admin" },
    ];
  await verifyJourneyTelemetry(participants, forbidden, journey.started);
  await verifyBrowserException(journey);
}

async function adminStatusWithoutUserWorker(journey: CompletedJourney): Promise<number> {
  await journey.stack.stopUser();
  const response = await journey.admin.api("/api/users");
  return response.status;
}

async function adminStillServes(journey: CompletedJourney): Promise<void> {
  await journey.admin.open(journey.stack.adminOrigin, "/");
  await journey.admin.commands(["wait", "tbody tr"]);
}

async function completeJourney(stack: Stack): Promise<CompletedJourney> {
  const user = await userJourney(stack);
  const admin = await adminJourney(user);
  const journey = { ...user, ...admin };
  await inStage("real-telemetry", verifyTelemetry, journey);
  return journey;
}

describe("isolated real Workers", () => {
  it("covers registration, verified email, authorization, MFA, admin lifecycle and correlated telemetry", async () => {
    expect.hasAssertions();
    const stack = await createStack();
    try {
      const journey = await completeJourney(stack);
      const status = await inStage("worker-isolation", adminStatusWithoutUserWorker, journey);
      expect(status).toBe(httpStatus.ok);
      await inStage("worker-isolation", adminStillServes, journey);
    } finally {
      await stack.cleanup();
    }
  });
});
