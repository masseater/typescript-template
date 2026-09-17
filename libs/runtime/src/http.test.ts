import { apiResponse, readJson, secureResponse } from "./http.ts";
import { describe, expect, it } from "vitest";
import { number, parse } from "valibot";

const origin = "http://localhost:3001";
const maximumBodyBytes = 16_384;
const status = { badRequest: 400, created: 201 };

describe("json mutation requests", () => {
  it("reads a bounded same-origin JSON mutation", async () => {
    expect.hasAssertions();
    const body = { name: "利用者", profile: "自己紹介です。" };
    const request = new Request(`${origin}/api/profile`, {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json", origin },
      method: "PATCH",
    });
    await expect(readJson(request, origin)).resolves.toStrictEqual(body);
  });

  it.for([
    { body: "{}", origin: "https://other.example.test", statusCode: 403, type: "application/json" },
    { body: "{}", origin, statusCode: 415, type: "text/plain" },
    { body: "{", origin, statusCode: 400, type: "application/json" },
    {
      body: "x".repeat(maximumBodyBytes + 1),
      origin,
      statusCode: 413,
      type: "application/json",
    },
  ])("rejects mutation with status $statusCode", async (mutation) => {
    expect.hasAssertions();
    const request = new Request(`${origin}/api/profile`, {
      body: mutation.body,
      headers: { "content-type": mutation.type, origin: mutation.origin },
      method: "PATCH",
    });
    await expect(readJson(request, origin)).rejects.toMatchObject({
      statusCode: mutation.statusCode,
    });
  });
});

describe("api responses", () => {
  it("returns validation errors without echoing submitted values", async () => {
    expect.hasAssertions();
    const response = await apiResponse(async () =>
      parse(number(), await Promise.resolve("private-profile-text")),
    );
    expect(response.status).toBe(status.badRequest);
    await expect(response.json()).resolves.toStrictEqual({ error: "入力内容を確認してください。" });
  });

  it("keeps status and body while preventing cached private responses", async () => {
    expect.hasAssertions();
    const response = secureResponse(Response.json({ ready: true }, { status: status.created }));
    expect(response.status).toBe(status.created);
    await expect(response.json()).resolves.toStrictEqual({ ready: true });
    expect(Object.fromEntries(response.headers)).toMatchObject({
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      "x-frame-options": "DENY",
    });
  });
});
