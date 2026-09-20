import { chromium } from "playwright";
import { test } from "vite-plus/test";

import { agentUserAgent } from "./agent-user-agent.ts";
import { browserHeaders } from "./client-address.ts";
import { startJourneyEnvironment } from "./environment.ts";
import { enableVirtualAuthenticator } from "./passkey.ts";

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
    const page = await session.newPage();
    await enableVirtualAuthenticator(page);
    onCleanup(async () => {
      await session.close();
    });
    return page;
  });

export { journeyTest };
