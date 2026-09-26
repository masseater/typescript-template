import { APPLICATION, httpStatus } from "@repo/config";
import { Telemetry } from "@repo/observability";
import { Effect, Layer, Schema } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { AppOrigin, apiDocs, apiRoot, apiRoutes, createApi } from "./http.ts";
import { workerRuntime } from "./worker-runtime.ts";

const origin = "http://localhost";
const ProfileView = Schema.Struct({
  email: Schema.String,
  id: Schema.String,
  name: Schema.String,
  profile: Schema.String,
});
const OpenApiPaths = Schema.Struct({
  paths: Schema.Record(Schema.String, Schema.Record(Schema.String, Schema.Unknown)),
});
const ServedRoute = Schema.Struct({
  hooks: Schema.Struct({
    detail: Schema.optionalKey(Schema.Struct({ hide: Schema.optionalKey(Schema.Boolean) })),
  }),
  method: Schema.String,
  path: Schema.String,
});

describe("an api that serves its own reference", () => {
  const it = test.extend("coverage", () =>
    Effect.runPromise(
      Effect.gen(function* coverageProgram() {
        const appContext = Layer.succeed(AppOrigin, origin).pipe(
          Layer.provideMerge(
            Telemetry.layer({ release: "test", routes: {}, serviceName: APPLICATION.serviceMember }),
          ),
        );
        const api = apiRoutes(
          workerRuntime(() => appContext),
          { service: APPLICATION.serviceMember },
        );
        const app = createApi(apiRoot)
          .use(apiDocs(APPLICATION.serviceMember))
          .get(
            "/profile",
            ...api.route(
              { response: ProfileView },
              () =>
                Effect.succeed({
                  email: "reader@example.test",
                  id: "user-1",
                  name: "reader",
                  profile: "自己紹介",
                }),
              {},
            ),
          );
        const answered = yield* Effect.promise(() =>
          app.handle(new Request(`${origin}${apiRoot}/docs/json`)),
        );
        const reference = yield* Schema.decodeUnknownEffect(OpenApiPaths)(
          yield* Effect.promise(() => answered.json()),
        );
        const servedRoutes = yield* Schema.decodeEffect(Schema.Array(ServedRoute))(app.routes);
        return {
          documented: Object.entries(reference.paths)
            .flatMap(([routePath, operations]) =>
              Object.keys(operations).map(
                (operationMethod) => `${operationMethod.toUpperCase()} ${routePath}`,
              ),
            )
            .toSorted((left, right) => left.localeCompare(right)),
          served: servedRoutes
            .filter((servedRoute) => servedRoute.hooks.detail?.hide !== true)
            .map((servedRoute) => `${servedRoute.method} ${servedRoute.path}`)
            .toSorted((left, right) => left.localeCompare(right)),
          status: answered.status,
        };
      }),
    ));

  it("documents every route it serves", ({ coverage }) => {
    expect(coverage).toStrictEqual({
      documented: ["GET /api/profile"],
      served: ["GET /api/profile"],
      status: httpStatus.ok,
    });
  });
});
