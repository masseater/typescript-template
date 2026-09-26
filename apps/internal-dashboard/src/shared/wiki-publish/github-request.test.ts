import { describe, expectTypeOf, test } from "vite-plus/test";

import type { Redacted } from "effect";
import type { GitHubCall } from "./github-request.ts";

type Target = Readonly<{ path: string; step: string; token: Redacted.Redacted }>;
type Body = Readonly<{ state: string }>;

describe("GitHubCall", () => {
  test("a write names its body", () => {
    expectTypeOf<Target & Readonly<{ body: Body; method: "POST" }>>().toExtend<GitHubCall>();
    expectTypeOf<Target & Readonly<{ body: Body; method: "PATCH" }>>().toExtend<GitHubCall>();
    expectTypeOf<Target & Readonly<{ method: "POST" }>>().not.toExtend<GitHubCall>();
    expectTypeOf<Target & Readonly<{ method: "PATCH" }>>().not.toExtend<GitHubCall>();
  });

  test("a read sends no body", () => {
    expectTypeOf<Target & Readonly<{ method: "GET" }>>().toExtend<GitHubCall>();
    expectTypeOf<Target & Readonly<{ body: Body; method: "GET" }>>().not.toExtend<GitHubCall>();
  });
});
