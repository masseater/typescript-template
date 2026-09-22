import { assert, it } from "@effect/vitest";
import { APPLICATION } from "@repo/config";
import { Telemetry, httpStatus } from "@repo/observability";
import { Effect, Layer, Schema } from "effect";

import { AppOrigin, apiDocs, apiRoot, apiRoutes, createApi } from "./http.ts";
import { referenceCoverage } from "./reference-coverage.ts";
import { workerRuntime } from "./worker-runtime.ts";

const ProfileView = Schema.Struct({
  email: Schema.String,
  id: Schema.String,
  name: Schema.String,
  profile: Schema.String,
});
const stored = { email: "reader@example.test", id: "user-1", name: "reader", profile: "自己紹介" };
const origin = "http://localhost";

it.effect("documents every route the api serves", () =>
  Effect.gen(function* program() {
    const context = Layer.succeed(AppOrigin, origin).pipe(
      Layer.provideMerge(
        Telemetry.layer({ release: "test", routes: {}, serviceName: APPLICATION.user }),
      ),
    );
    const api = apiRoutes(workerRuntime(() => context), { service: APPLICATION.user });
    const app = createApi(apiRoot)
      .use(apiDocs(APPLICATION.user))
      .get("/profile", ...api.route({ response: ProfileView }, () => Effect.succeed(stored), {}));
    const coverage = yield* referenceCoverage(app);
    assert.strictEqual(coverage.status, httpStatus.ok);
    assert.deepStrictEqual(coverage.documented, coverage.served);
    assert.includeMembers([...coverage.documented], ["GET /api/profile"]);
  }),
);
