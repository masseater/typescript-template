import { Effect } from "effect";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { test } from "vite-plus/test";

import { browserHeaders } from "./client-address.ts";
import { type JourneyEnvironment, startJourneyEnvironment } from "./environment.ts";
import { type JourneyFailure } from "./journey-failure.ts";
import { pageStep } from "./screens.ts";

const launchedBrowser = (): Effect.Effect<Browser, JourneyFailure> =>
  pageStep(() => chromium.launch());

const closeBrowser = (browser: Browser): Promise<void> =>
  Effect.runPromise(pageStep(() => browser.close()));

type Cleanup = (dispose: () => Promise<void>) => void;

const scheduleBrowserClose = (browser: Browser, onCleanup: Cleanup): void => {
  onCleanup(() => closeBrowser(browser));
};

const openedSession = (browser: Browser): Effect.Effect<BrowserContext, JourneyFailure> =>
  pageStep(() => browser.newContext({ extraHTTPHeaders: browserHeaders(), locale: "ja-JP" }));

const closeSession = (session: BrowserContext): Promise<void> =>
  Effect.runPromise(pageStep(() => session.close()));

const scheduleSessionClose = (session: BrowserContext, onCleanup: Cleanup): void => {
  onCleanup(() => closeSession(session));
};

const scheduleStop = (environment: JourneyEnvironment, onCleanup: Cleanup): void => {
  onCleanup(() => Effect.runPromise(environment.stop));
};

const openedPage = (session: BrowserContext): Effect.Effect<Page, JourneyFailure> =>
  pageStep(() => session.newPage());

const journeyTest = test
  .extend("browser", { scope: "worker" }, ({}, { onCleanup }) =>
    Effect.runPromise(
      Effect.gen(function* launchBrowser() {
        const browser = yield* launchedBrowser();
        scheduleBrowserClose(browser, onCleanup);
        return browser;
      }),
    ),
  )
  .extend("environment", { scope: "worker" }, ({}, { onCleanup }) =>
    Effect.runPromise(
      Effect.gen(function* launchEnvironment() {
        const environment = yield* startJourneyEnvironment();
        scheduleStop(environment, onCleanup);
        return environment;
      }),
    ),
  )
  .extend("page", ({ browser }, { onCleanup }) =>
    Effect.runPromise(
      Effect.gen(function* openPage() {
        const session = yield* openedSession(browser);
        scheduleSessionClose(session, onCleanup);
        return yield* openedPage(session);
      }),
    ),
  );

export { journeyTest };
