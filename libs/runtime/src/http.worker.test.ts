import { httpStatus } from "@repo/observability";
import { describe, expect, it } from "vite-plus/test";

import { apiRoot, createApi } from "./http.ts";

const app = createApi(apiRoot).get("/probe", () => ({ probed: true }));
const generateCode: (body: string) => unknown = globalThis.Function;

describe("worker api", () => {
  it("evaluates where code generation from strings is refused", () => {
    expect.hasAssertions();
    expect(() => generateCode("return 1")).toThrow(EvalError);
  });

  it("answers a route", () => {
    expect.hasAssertions();
    return Promise.resolve(app.fetch(new Request(`http://worker.test${apiRoot}/probe`))).then(
      (response) => expect(response.json()).resolves.toStrictEqual({ probed: true }),
    );
  });

  it("answers an unknown route", () => {
    expect.hasAssertions();
    return Promise.resolve(app.fetch(new Request(`http://worker.test${apiRoot}/absent`))).then(
      (response) => {
        expect(response.status).toBe(httpStatus.notFound);
      },
    );
  });
});
