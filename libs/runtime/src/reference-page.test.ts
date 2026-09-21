import { assert, describe, it } from "@effect/vitest";
import { APPLICATION, scalarReferencePath } from "@repo/config";
import { Telemetry, httpStatus } from "@repo/observability";
import { readScalarReference } from "@repo/vite-config";
import { Effect, Layer, Schema } from "effect";
import { chromium } from "playwright";

import { AppOrigin, apiDocs, apiRoot, apiRoutes, createApi } from "./http.ts";
import { workerRuntime } from "./worker-runtime.ts";

import type { Browser, Page, Request as BrowserRequest } from "playwright";

const renderTimeout = 20_000;
const testTimeout = 60_000;
const ProfileView = Schema.Struct({
  email: Schema.String,
  id: Schema.String,
  name: Schema.String,
  profile: Schema.String,
});
const stored = { email: "reader@example.test", id: "user-1", name: "reader", profile: "自己紹介" };
const hostedFeatures = ["Ask AI", "Share", "Deploy", "Generate MCP"] as const;

interface Visit {
  readonly foreign: readonly string[];
  readonly hostedButtons: number;
  readonly rendered: boolean;
  readonly violations: readonly string[];
}

function referenceApp(origin: string) {
  const context = Layer.succeed(AppOrigin, origin).pipe(
    Layer.provideMerge(
      Telemetry.layer({ release: "test", routes: {}, serviceName: APPLICATION.user }),
    ),
  );
  const api = apiRoutes(
    workerRuntime(() => context),
    { service: APPLICATION.user },
  );
  return createApi(apiRoot)
    .use(apiDocs(APPLICATION.user))
    .get("/profile", ...api.route({ response: ProfileView }, () => Effect.succeed(stored), {}));
}

async function fulfill(
  page: Page,
  app: ReturnType<typeof referenceApp>,
  origin: string,
): Promise<void> {
  const scalar = await readScalarReference();
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) {
      await route.abort();
      return;
    }
    if (url.pathname === scalarReferencePath) {
      await route.fulfill({
        body: scalar,
        contentType: "text/javascript",
        status: httpStatus.ok,
      });
      return;
    }
    const reply = await app.fetch(new Request(url, { method: route.request().method() }));
    await route.fulfill({
      body: Buffer.from(await reply.arrayBuffer()),
      headers: Object.fromEntries(reply.headers),
      status: reply.status,
    });
  });
}

const browser = Effect.acquireRelease(
  Effect.promise(async () => chromium.launch()),
  (launched: Browser) => Effect.promise(async () => launched.close()),
);

function visit(launched: Browser, origin: string): Effect.Effect<Visit> {
  return Effect.promise(async () => {
    const page = await launched.newPage();
    const foreign: string[] = [];
    const app = referenceApp(origin);
    page.on("request", (request: BrowserRequest) => {
      if (new URL(request.url()).origin !== origin) {
        foreign.push(request.url());
      }
    });
    await fulfill(page, app, origin);
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (event) => {
        if (!URL.canParse(event.blockedURI)) {
          return;
        }
        document.documentElement.dataset["violations"] =
          `${document.documentElement.dataset["violations"] ?? ""} ${event.blockedURI}`.trim();
      });
    });
    await page.goto(`${origin}${apiRoot}/docs`);
    const rendered = await page
      .getByText("/api/profile")
      .first()
      .waitFor({ timeout: renderTimeout })
      .then(() => true)
      .catch(() => false);
    await page.waitForLoadState("networkidle");
    const hostedButtons = await page
      .getByRole("button", { name: new RegExp(hostedFeatures.join("|"), "u") })
      .count();
    const violations = (await page.locator("html").getAttribute("data-violations")) ?? "";
    await page.close();
    return {
      foreign,
      hostedButtons,
      rendered,
      violations: violations.split(" ").filter(Boolean),
    };
  });
}

describe("the api reference page in a browser", () => {
  it.live(
    "renders the document without reaching any origin but its own",
    () =>
      Effect.scoped(
        Effect.gen(function* program() {
          const result = yield* visit(yield* browser, "http://127.0.0.1:4177");
          assert.deepStrictEqual(result, {
            foreign: [],
            hostedButtons: 0,
            rendered: true,
            violations: [],
          });
        }),
      ),
    testTimeout,
  );
});
