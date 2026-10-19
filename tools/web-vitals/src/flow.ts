import { Launcher } from "chrome-launcher";
import { Array, Data, Effect, Option } from "effect";
import { startFlow } from "lighthouse";
import { launch } from "puppeteer-core";
import type { Browser, Page } from "puppeteer-core";

class BrowserError extends Data.TaggedError("BrowserError")<{ readonly cause: unknown }> {}

const attempt = <Value>(evaluate: () => Promise<Value>): Effect.Effect<Value, BrowserError> =>
  Effect.tryPromise({ try: evaluate, catch: (cause) => new BrowserError({ cause }) });

const openBrowser = (chromeFlags: readonly string[]): Effect.Effect<Browser, BrowserError> =>
  Effect.gen(function* open() {
    const installation = yield* Effect.try({
      try: () => Launcher.getFirstInstallation(),
      catch: (cause) => new BrowserError({ cause }),
    });
    const executablePath = yield* Option.fromNullishOr(installation).pipe(
      Effect.fromOption,
      Effect.mapError(
        () =>
          new BrowserError({
            cause: "Chrome が見つからない。CHROME_PATH に実行ファイルを指定する",
          }),
      ),
    );
    return yield* attempt(() => launch({ executablePath, args: [...chromeFlags] }));
  });

const withoutHash = (url: string): string => {
  const parsed = new URL(url);
  parsed.hash = "";
  return parsed.href;
};

const hrefsOn = (page: Page): Effect.Effect<readonly string[], BrowserError> =>
  attempt(() =>
    page.$$eval("a[href]", (anchors) =>
      anchors.filter((anchor) => anchor.origin === location.origin).map((anchor) => anchor.href),
    ),
  );

const linksOn = (page: Page): Effect.Effect<readonly string[], BrowserError> =>
  Effect.map(hrefsOn(page), (hrefs) =>
    Array.dedupe(hrefs.map((href) => withoutHash(href))).filter(
      (href) => href !== withoutHash(page.url()),
    ),
  );

const clickLink = (page: Page, target: string): Effect.Effect<void, BrowserError> =>
  Effect.gen(function* click() {
    const anchors = yield* attempt(() => page.$$("a[href]"));
    const hrefs = yield* attempt(() =>
      Promise.all(anchors.map((anchor) => anchor.evaluate((element) => element.href))),
    );
    const index = yield* Array.findFirstIndex(hrefs, (href) => withoutHash(href) === target).pipe(
      Effect.fromOption,
      Effect.mapError(() => new BrowserError({ cause: `${target} へのリンクが見つからない` })),
    );
    const anchor = yield* Array.get(anchors, index).pipe(
      Effect.fromOption,
      Effect.mapError(() => new BrowserError({ cause: `${target} へのリンクが見つからない` })),
    );
    yield* attempt(() =>
      Promise.all([
        page.waitForFunction(
          (href) =>
            location.href.replace(location.hash, "") === href && document.readyState === "complete",
          {},
          target,
        ),
        anchor.click(),
      ]),
    );
  });

const measureFlow = Effect.fn("web-vitals.flow")(function* measureFlow(
  urls: readonly string[],
  chromeFlags: readonly string[],
) {
  const browser = yield* Effect.acquireRelease(openBrowser(chromeFlags), (opened) =>
    Effect.promise(() => opened.close()),
  );
  const page = yield* attempt(() => browser.newPage());
  const flow = yield* attempt(() => startFlow(page, { name: "web-vitals" }));
  for (const url of urls) {
    yield* attempt(() => flow.navigate(url, { name: `load ${url}` })).pipe(
      Effect.withSpan("web-vitals.load", { attributes: { url } }),
    );
    for (const link of yield* linksOn(page)) {
      yield* Effect.gen(function* transition() {
        yield* attempt(() => page.goto(url, { waitUntil: "load" }));
        yield* attempt(() => flow.startTimespan({ name: `${url} -> ${link}` }));
        yield* clickLink(page, link);
        yield* attempt(() => flow.endTimespan());
      }).pipe(Effect.withSpan("web-vitals.transition", { attributes: { from: url, to: link } }));
    }
  }
  const result = yield* attempt(() => flow.createFlowResult()).pipe(
    Effect.withSpan("web-vitals.audit"),
  );
  const html = yield* attempt(() => flow.generateReport());
  return { result, html };
}, Effect.scoped);

export { measureFlow };
