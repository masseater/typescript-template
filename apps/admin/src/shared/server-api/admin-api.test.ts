import { Effect, ManagedRuntime } from "effect";
import { apiRoutes, compileApi } from "@template/runtime/http";
import { assert, it } from "@effect/vitest";
import { Miniflare } from "miniflare";
import { adminRoutes } from "./admin-api.ts";
import { appLayer } from "@template/runtime";
import { httpStatus } from "@template/observability";
import { referenceCoverage } from "@template/runtime/testing";
import { routes } from "#shared/telemetry/index.ts";

const origin = "http://localhost:3002";

const adminEnvironment = Effect.acquireRelease(
  Effect.promise(async () => {
    const runtime = new Miniflare({
      workers: [
        {
          bindings: {
            APP_ORIGIN: origin,
            AUTH_SECRET: "admin-api-reference-test-secret-0123456789",
            EMAIL_FROM: "no-reply@example.test",
            MAILPIT_URL: "http://127.0.0.1:8025",
          },
          d1Databases: ["DB"],
          modules: true,
          script: "export default { fetch() { return new Response(null, { status: 404 }); } };",
          serviceBindings: {
            ASSETS: () => new Response(undefined, { status: httpStatus.notFound }),
          },
        },
      ],
    });
    return { bindings: await runtime.getBindings(), runtime };
  }),
  ({ runtime }) => Effect.promise(async () => runtime.dispose()),
);

it.live("the admin api reference is served only to an admin session", () =>
  Effect.scoped(
    Effect.gen(function* program() {
      const { bindings } = yield* adminEnvironment;
      const runtime = ManagedRuntime.make(appLayer(bindings, "admin", routes));
      const app = compileApi(adminRoutes(apiRoutes(runtime)));
      const [page, missing] = yield* Effect.promise(async () =>
        Promise.all([
          app.fetch(new Request(`${origin}/api/docs`)),
          app.fetch(new Request(`${origin}/api/docs/missing`)),
        ]),
      );
      const coverage = yield* referenceCoverage(app);
      assert.deepStrictEqual(
        [page.status, coverage.status, missing.status],
        [httpStatus.unauthorized, httpStatus.unauthorized, httpStatus.notFound],
      );
    }),
  ),
);
