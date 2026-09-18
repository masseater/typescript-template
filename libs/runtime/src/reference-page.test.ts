import { AppOrigin, apiDocs, apiRoot, apiRoutes, compileApi, createApi } from "./http.ts";
import { Effect, Layer, ManagedRuntime } from "effect";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { Telemetry, httpStatus } from "@template/observability";
import { assert, describe, it } from "@effect/vitest";
import type { Browser } from "playwright";
import { ProfileView } from "./contracts.ts";
import type { Request as BrowserRequest } from "playwright";
import { chromium } from "playwright";
// oxlint-disable-next-line import/no-nodejs-modules
import { createServer } from "node:http";
import { readScalarReference } from "@template/config/vite";
import { scalarReferencePath } from "@template/config";

const loopback = "127.0.0.1";
const renderTimeout = 20_000;
const testTimeout = 60_000;
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
    Layer.provideMerge(Telemetry.layer({ release: "test", routes: {}, serviceName: "user" })),
  );
  const api = apiRoutes(ManagedRuntime.make(context));
  return compileApi(
    createApi(apiRoot)
      .use(apiDocs("user"))
      .get("/profile", ...api.route({ response: ProfileView }, () => Effect.succeed(stored), {})),
  );
}

async function answer(
  app: ReturnType<typeof referenceApp>,
  origin: string,
  request: Readonly<IncomingMessage>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  response: ServerResponse,
): Promise<void> {
  const path = request.url ?? "/";
  if (path === scalarReferencePath) {
    response.writeHead(httpStatus.ok, { "content-type": "text/javascript" });
    response.end(await readScalarReference());
    return;
  }
  const reply = await app.fetch(new Request(`${origin}${path}`, { method: request.method }));
  response.writeHead(reply.status, Object.fromEntries(reply.headers));
  response.end(Buffer.from(await reply.arrayBuffer()));
}

function listen(): Effect.Effect<{ readonly origin: string; readonly server: Server }> {
  return Effect.callback((resume) => {
    const server = createServer();
    server.listen(0, loopback, () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      resume(Effect.succeed({ origin: `http://${loopback}:${String(port)}`, server }));
    });
  });
}

const referenceServer = Effect.acquireRelease(
  listen().pipe(
    Effect.tap(({ origin, server }) =>
      Effect.sync(() => {
        const app = referenceApp(origin);
        server.on("request", (request: IncomingMessage, response: ServerResponse) => {
          answer(app, origin, request, response).catch(() => {
            response.writeHead(httpStatus.internalServerError).end();
          });
        });
      }),
    ),
  ),
  ({ server }) =>
    Effect.callback<void>((resume) => {
      server.close(() => {
        resume(Effect.void);
      });
    }),
);

const browser = Effect.acquireRelease(
  Effect.promise(async () => chromium.launch()),
  (launched: Browser) => Effect.promise(async () => launched.close()),
);

function visit(launched: Browser, origin: string): Effect.Effect<Visit> {
  return Effect.promise(async () => {
    const page = await launched.newPage();
    const foreign: string[] = [];
    page.on("request", (request: BrowserRequest) => {
      if (new URL(request.url()).origin !== origin) {
        foreign.push(request.url());
      }
    });
    await page.route(
      (url) => url.origin !== origin,
      async (route) => route.abort(),
    );
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
          const { origin } = yield* referenceServer;
          const result = yield* visit(yield* browser, origin);
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
