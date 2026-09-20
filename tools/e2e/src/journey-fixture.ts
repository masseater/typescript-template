import { chromium } from "playwright";
import { test } from "vite-plus/test";

import { agentUserAgent } from "./agent-user-agent.ts";
import { browserHeaders } from "./client-address.ts";
import { startJourneyEnvironment } from "./environment.ts";
import { installVirtualAuthenticator } from "./passkey.ts";

const journeyTest = test
  .extend("browser", { scope: "worker" }, async ({}, { onCleanup }) => {
    const browser = await chromium.launch({
      args: ["--disable-dev-shm-usage", "--enable-features=WebAuthentication"],
    });
    onCleanup(async () => {
      await browser.close();
    });
    return browser;
  })
  .extend("environment", { scope: "worker" }, async ({}, { onCleanup }) => {
    const environment = await startJourneyEnvironment();
    onCleanup(async () => {
      await environment.stop();
    });
    return environment;
  })
  .extend("page", async ({ browser }, { onCleanup }) => {
    const session = await browser.newContext({
      extraHTTPHeaders: browserHeaders(),
      locale: "ja-JP",
      userAgent: agentUserAgent,
    });
    await installVirtualAuthenticator(session);
    onCleanup(async () => {
      await session.close();
    });
    return session.newPage();
  });

export { journeyTest };
